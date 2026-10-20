/*
  Ticket booking UI. Plain JavaScript, no build step.
  Talks to the Spring Boot API on the same origin:
    GET  /api/concessions/preview     POST /api/bookings        GET /api/bookings/{id}
    POST /api/payments/order          POST /api/payments/verify GET /api/payments/booking/{id}
    GET  /api/refunds/preview/{id}    POST /api/refunds         GET /api/refunds/booking/{id}
*/
(() => {
  'use strict';

  const RUPEE = '₹';
  const MINUS = '−';

  const CATEGORY_LABELS = {
    GENERAL: 'General',
    SENIOR_CITIZEN: 'Senior citizen',
    STUDENT: 'Student',
    CHILD: 'Child',
    DIFFERENTLY_ABLED: 'Differently abled',
    ARMED_FORCES: 'Armed forces'
  };
  const TICKET_STATUS = { PENDING_PAYMENT: 'pending', CONFIRMED: 'confirmed', CANCELLED: 'cancelled' };
  const REFUND_STATUS = { PENDING: 'In progress', PROCESSED: 'Processed', FAILED: 'Failed. Contact support.' };
  const PAYMENT_STATUS = { CREATED: 'Not paid', PAID: 'Paid', REFUNDED: 'Refunded' };

  const $ = (selector, root = document) => root.querySelector(selector);

  // ---------- Helpers ----------

  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  const money = value => {
    const n = Number(value);
    return RUPEE + n.toLocaleString('en-IN', {
      minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
      maximumFractionDigits: 2
    });
  };

  const percent = value => Number(value) + '%';

  const formatDeparture = value => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true
    });
  };

  const pad = n => String(n).padStart(2, '0');
  const toLocalInput = d =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  const remember = id => { try { localStorage.setItem('lastBookingId', String(id)); } catch (e) { /* storage unavailable */ } };
  const recall = () => { try { return localStorage.getItem('lastBookingId') || ''; } catch (e) { return ''; } };

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  class ApiError extends Error {
    constructor(message, status, fields) {
      super(message);
      this.status = status;
      this.fields = fields;
    }
  }

  async function api(method, url, body) {
    let res;
    try {
      res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (e) {
      throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok) {
      throw new ApiError((data && data.error) || `Something went wrong (error ${res.status}). Try again.`, res.status, data && data.fields);
    }
    return data;
  }

  function toast(text, tone = 'info') {
    const el = document.createElement('div');
    el.className = 'toast';
    el.dataset.tone = tone;
    el.textContent = text;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), tone === 'error' ? 8000 : 5000);
  }

  function setBtnBusy(btn, busy, label) {
    if (busy) {
      if (!btn.classList.contains('is-busy')) btn.dataset.idle = btn.textContent;
      btn.classList.add('is-busy');
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      btn.textContent = label;
    } else if (btn.classList.contains('is-busy')) {
      btn.classList.remove('is-busy');
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      btn.textContent = btn.dataset.idle || btn.textContent;
    }
  }

  function confirmDialog({ title, body, confirmLabel, cancelLabel, danger }) {
    const dialog = $('#confirm-dialog');
    if (typeof dialog.showModal !== 'function') {
      return Promise.resolve(window.confirm(`${title}\n\n${body}`));
    }
    $('#cd-title').textContent = title;
    $('#cd-body').textContent = body;
    $('#cd-ok').textContent = confirmLabel;
    $('#cd-ok').className = 'btn ' + (danger ? 'btn-danger' : 'btn-primary');
    $('#cd-cancel').textContent = cancelLabel;
    dialog.returnValue = '';
    return new Promise(resolve => {
      dialog.addEventListener('close', () => resolve(dialog.returnValue === 'ok'), { once: true });
      dialog.showModal();
    });
  }

  // ---------- The ticket ----------

  function ticketHTML(t) {
    const stamps = {
      pending: ['Awaiting payment', 'warn'],
      confirmed: ['Confirmed', 'ok'],
      cancelled: ['Cancelled', 'bad']
    };
    const stamp = stamps[t.status];
    const hasBase = t.base != null;
    const discounted = hasBase && Number(t.discount) > 0;
    const categoryLabel = CATEGORY_LABELS[t.category] || t.category || '';
    const totalLabel = { draft: 'You pay', pending: 'Amount due', confirmed: 'Paid', cancelled: 'Paid' }[t.status];

    const rows = [];
    if (hasBase) {
      rows.push(`<div><dt>Base fare</dt><dd class="${discounted ? 'is-struck' : ''}">${money(t.base)}</dd></div>`);
      rows.push(discounted
        ? `<div class="concession"><dt>${esc(categoryLabel)} concession (${percent(t.percent)} off)</dt><dd>${MINUS}${money(t.discount)}</dd></div>`
        : '<div><dt>Concession</dt><dd>None</dd></div>');
    } else {
      rows.push('<div><dt>Enter a fare to see your price.</dt></div>');
    }
    if (t.refund != null) {
      rows.push(`<div class="concession"><dt>Refund (${percent(t.refundPercent)} of fare paid)</dt><dd>${money(t.refund)}</dd></div>`);
    }

    const stop = (value, fallback) =>
      value ? `<span class="stop">${esc(value)}</span>` : `<span class="stop is-empty">${fallback}</span>`;

    return `
      <article class="ticket${t.updating ? ' is-updating' : ''}" data-status="${t.status}" aria-label="Ticket">
        <div class="ticket-main">
          ${t.bookingId ? `<p class="booking-no">Booking ${esc(t.bookingId)}</p>` : ''}
          ${stamp ? `<span class="stamp${t.animate ? ' land' : ''}" data-tone="${stamp[1]}">${stamp[0]}</span>` : ''}
          <div class="route">
            ${stop(t.origin, 'Starting point')}
            <span class="line" aria-hidden="true"></span>
            ${stop(t.destination, 'Destination')}
          </div>
          <dl class="facts">
            <div class="wide"><dt>Departs</dt><dd>${t.departure ? esc(formatDeparture(t.departure)) : '<span class="is-empty">Not set</span>'}</dd></div>
            <div><dt>Passenger</dt><dd>${t.passenger ? esc(t.passenger) : '<span class="is-empty">Not entered</span>'}</dd></div>
            <div><dt>Fare type</dt><dd>${esc(categoryLabel)}</dd></div>
          </dl>
        </div>
        <div class="ticket-stub">
          <dl class="fare-lines">${rows.join('')}</dl>
          <div class="total"><span>${totalLabel}</span><strong>${t.total != null ? money(t.total) : `${RUPEE}—`}</strong></div>
        </div>
      </article>`;
  }

  function ticketFromBooking(b, extra) {
    return Object.assign({
      status: TICKET_STATUS[b.status] || 'pending',
      bookingId: b.id,
      origin: b.origin,
      destination: b.destination,
      departure: b.departureTime,
      passenger: b.passengerName,
      category: b.category,
      base: b.baseFare,
      percent: b.concessionPercent,
      discount: b.concessionAmount,
      total: b.finalAmount
    }, extra);
  }

  // ---------- Razorpay Checkout ----------

  async function openCheckout(booking, ctx) {
    if (typeof window.Razorpay !== 'function') {
      throw new Error("The payment window didn't load. Check your internet connection and reload the page.");
    }
    const order = await api('POST', '/api/payments/order', { bookingId: booking.id });
    const rzp = new window.Razorpay({
      key: order.keyId,
      amount: order.amountInPaise,
      currency: order.currency,
      order_id: order.orderId,
      name: 'Ticket booking',
      description: `${booking.origin} to ${booking.destination}`,
      prefill: { name: booking.passengerName, email: booking.email, contact: booking.phone },
      theme: { color: '#18212C' },
      modal: { ondismiss: () => ctx.onClosed() },
      handler: response => ctx.onPaid(response)
    });
    rzp.on('payment.failed', r => ctx.onFailed(r && r.error));
    rzp.open();
  }

  async function pollForConfirmation(bookingId) {
    for (let i = 0; i < 10; i++) {
      await sleep(3000);
      try {
        const fresh = await api('GET', `/api/bookings/${bookingId}`);
        if (fresh.status === 'CONFIRMED') return fresh;
      } catch (e) { /* keep trying */ }
    }
    return null;
  }

  async function confirmPayment(booking, response, ui) {
    ui.paid = true;
    ui.busy(true, 'Confirming payment');
    ui.message('Confirming your payment. Keep this page open.', 'info');
    try {
      await api('POST', '/api/payments/verify', {
        razorpayOrderId: response.razorpay_order_id,
        razorpayPaymentId: response.razorpay_payment_id,
        razorpaySignature: response.razorpay_signature
      });
      const fresh = await api('GET', `/api/bookings/${booking.id}`);
      ui.confirmed(fresh, response.razorpay_payment_id);
    } catch (err) {
      if (err.status === 400 || err.status === 404) {
        ui.message(`We couldn't verify this payment. If money left your account, contact support with booking number ${booking.id} and payment ID ${response.razorpay_payment_id}.`, 'error');
      } else {
        const fresh = await pollForConfirmation(booking.id);
        if (fresh) {
          ui.confirmed(fresh, response.razorpay_payment_id);
        } else {
          ui.message(`Your payment went through, but booking ${booking.id} isn't confirmed yet. Don't pay again. Check its status under Manage booking in a few minutes.`, 'warn');
        }
      }
    } finally {
      ui.busy(false);
    }
  }

  async function payForBooking(booking, ui) {
    let failure = null;
    ui.busy(true, 'Opening payment');
    try {
      await openCheckout(booking, {
        onFailed: error => {
          failure = (error && error.description) || 'The payment failed.';
          ui.message(`${failure} Select Pay to try again.`, 'error');
        },
        onClosed: () => {
          if (ui.paid) return;
          ui.message(
            failure ? `${failure} Select Pay to try again.` : "Payment wasn't completed. Select Pay to try again.",
            failure ? 'error' : 'info'
          );
        },
        onPaid: response => confirmPayment(booking, response, ui)
      });
    } catch (err) {
      ui.message(err.message, 'error');
    } finally {
      ui.busy(false);
    }
  }

  // ---------- Form validation ----------

  const RULES = {
    passengerName: v => (v.trim().length >= 2 ? '' : "Enter the passenger's full name."),
    email: v => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'Enter a valid email address, like name@example.com.'),
    phone: v => (/^\+?\d{10,13}$/.test(v.replace(/[\s-]/g, '')) ? '' : 'Enter a 10-digit mobile number.'),
    origin: v => (v.trim() ? '' : 'Enter where the journey starts.'),
    destination: (v, f) => {
      if (!v.trim()) return 'Enter where the journey ends.';
      return v.trim().toLowerCase() === f.origin.value.trim().toLowerCase()
        ? 'The destination must be different from the starting point.' : '';
    },
    departureTime: v => {
      if (!v) return 'Choose a departure date and time.';
      return new Date(v) <= new Date() ? 'Departure must be in the future.' : '';
    },
    baseFare: v => (parseFloat(v) >= 1 ? '' : `Enter a fare of ${RUPEE}1 or more.`)
  };

  function setError(formEl, name, message) {
    const input = formEl.elements[name];
    const out = $('#e-' + name);
    if (!input || !out) return;
    out.textContent = message;
    out.hidden = !message;
    if (message) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', 'e-' + name);
    } else {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }
  }

  function validateField(formEl, name) {
    const message = RULES[name](formEl.elements[name].value, formEl.elements);
    setError(formEl, name, message);
    return message;
  }

  function validateForm(formEl) {
    let firstInvalid = null;
    Object.keys(RULES).forEach(name => {
      if (validateField(formEl, name) && !firstInvalid) firstInvalid = formEl.elements[name];
    });
    if (firstInvalid) firstInvalid.focus();
    return !firstInvalid;
  }

  // ---------- Book view ----------

  const form = $('#book-form');
  const payBtn = $('#pay-btn');
  const bookState = { booking: null, signature: '' };
  const preview = { data: null, stale: false, seq: 0, timer: null };

  function formValues() {
    const f = form.elements;
    return {
      passengerName: f.passengerName.value.trim(),
      email: f.email.value.trim(),
      phone: f.phone.value.trim(),
      origin: f.origin.value.trim(),
      destination: f.destination.value.trim(),
      departureTime: f.departureTime.value,
      category: f.category.value,
      baseFare: Number(f.baseFare.value)
    };
  }

  function setDepartureDefaults() {
    const input = form.elements.departureTime;
    const d = new Date(Date.now() + 3 * 864e5);
    d.setMinutes(0, 0, 0);
    input.value = toLocalInput(d);
    input.min = toLocalInput(new Date());
  }

  function updatePayButton(total) {
    const label = total != null ? `Pay ${money(total)}` : 'Pay';
    if (payBtn.classList.contains('is-busy')) payBtn.dataset.idle = label;
    else payBtn.textContent = label;
  }

  function renderBookTicket() {
    const v = formValues();
    let ticket;
    if (bookState.booking && bookState.signature === JSON.stringify(v)) {
      ticket = ticketFromBooking(bookState.booking, { status: 'pending' });
    } else {
      const p = preview.data;
      ticket = {
        status: 'draft',
        origin: v.origin,
        destination: v.destination,
        departure: v.departureTime,
        passenger: v.passengerName,
        category: v.category,
        base: p ? p.baseFare : null,
        percent: p ? p.percent : 0,
        discount: p ? p.concessionAmount : 0,
        total: p ? p.finalAmount : null,
        updating: preview.stale
      };
    }
    $('#ticket-book').innerHTML = ticketHTML(ticket);
    updatePayButton(ticket.total);
  }

  async function fetchPreview() {
    const base = parseFloat(form.elements.baseFare.value);
    const category = form.elements.category.value;
    if (!(base >= 1)) {
      preview.data = null;
      preview.stale = false;
      renderBookTicket();
      return;
    }
    const seq = ++preview.seq;
    try {
      const result = await api('GET', `/api/concessions/preview?category=${encodeURIComponent(category)}&baseFare=${encodeURIComponent(base)}`);
      if (seq !== preview.seq) return;
      preview.data = result;
    } catch (err) {
      if (seq !== preview.seq) return;
      showPayMessage(err.message, 'error');
    }
    preview.stale = false;
    renderBookTicket();
  }

  function schedulePreview() {
    preview.stale = true;
    clearTimeout(preview.timer);
    preview.timer = setTimeout(fetchPreview, 250);
  }

  function showPayMessage(text, tone = 'info') {
    const el = $('#pay-message');
    el.textContent = text;
    el.dataset.tone = tone;
    el.hidden = false;
  }

  function clearPayMessage() {
    const el = $('#pay-message');
    el.hidden = true;
    el.textContent = '';
  }

  function showConfirmation(booking, paymentId) {
    form.hidden = true;
    $('#pay-area').hidden = true;
    const panel = $('#confirmation');
    panel.innerHTML = `
      <h1 tabindex="-1">Booking confirmed</h1>
      <p class="lede">We received ${esc(money(booking.finalAmount))} for your journey from ${esc(booking.origin)} to ${esc(booking.destination)}. Keep your booking number to check or cancel this booking later.</p>
      <dl class="rows">
        <div class="strong"><dt>Booking number</dt><dd>${esc(booking.id)}</dd></div>
        <div><dt>Amount paid</dt><dd>${esc(money(booking.finalAmount))}</dd></div>
        <div><dt>Payment ID</dt><dd>${esc(paymentId)}</dd></div>
      </dl>
      <div class="actions">
        <a class="btn btn-secondary" href="#/manage/${esc(booking.id)}">Manage this booking</a>
        <button class="btn btn-secondary" type="button" id="book-another">Book another ticket</button>
      </div>`;
    panel.hidden = false;
    $('#ticket-book').innerHTML = ticketHTML(ticketFromBooking(booking, { status: 'confirmed', animate: true }));
    $('h1', panel).focus();
    $('#book-another').addEventListener('click', resetBooking);
  }

  function resetBooking() {
    bookState.booking = null;
    bookState.signature = '';
    form.reset();
    setDepartureDefaults();
    Object.keys(RULES).forEach(name => setError(form, name, ''));
    preview.data = null;
    preview.stale = false;
    clearPayMessage();
    $('#confirmation').hidden = true;
    form.hidden = false;
    $('#pay-area').hidden = false;
    renderBookTicket();
    form.elements.passengerName.focus();
  }

  form.addEventListener('input', event => {
    const name = event.target.name;
    if (name in RULES && event.target.getAttribute('aria-invalid') === 'true') validateField(form, name);
    if (name === 'baseFare' || name === 'category') schedulePreview();
    renderBookTicket();
  });

  form.addEventListener('focusout', event => {
    if (event.target.name in RULES) validateField(form, event.target.name);
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (payBtn.classList.contains('is-busy')) return;
    clearPayMessage();
    if (!validateForm(form)) return;

    const ui = {
      paid: false,
      busy: (busy, label) => setBtnBusy(payBtn, busy, label),
      message: showPayMessage,
      confirmed: showConfirmation
    };

    ui.busy(true, 'Preparing booking');
    try {
      if (preview.stale) await fetchPreview();
      const values = formValues();
      const signature = JSON.stringify(values);
      if (!bookState.booking || bookState.signature !== signature) {
        bookState.booking = await api('POST', '/api/bookings', values);
        bookState.signature = signature;
        remember(bookState.booking.id);
        renderBookTicket();
      }
    } catch (err) {
      ui.busy(false);
      if (err.fields) {
        Object.keys(err.fields).forEach(name => setError(form, name, err.fields[name]));
        showPayMessage('Check the highlighted fields and try again.', 'error');
      } else {
        showPayMessage(err.message, 'error');
      }
      return;
    }
    ui.busy(false);
    await payForBooking(bookState.booking, ui);
  });

  // ---------- Manage view ----------

  const findForm = $('#find-form');
  const manageLayout = $('#manage-layout');
  const manageDetail = $('#manage-detail');
  const manageAside = $('#manage-aside');
  const EMPTY_MANAGE = '<p class="empty">Enter your booking number to check its status, pay, or cancel and get a refund.</p>';
  let manageSeq = 0;

  function showManageEmpty() {
    manageLayout.classList.add('single');
    manageAside.hidden = true;
    manageDetail.innerHTML = EMPTY_MANAGE;
  }

  async function loadManage(id) {
    const seq = ++manageSeq;
    setError(findForm, 'bookingId', '');
    manageDetail.innerHTML = '<p class="empty">Looking up your booking.</p>';
    try {
      const booking = await api('GET', `/api/bookings/${id}`);
      const [payments, refunds] = await Promise.all([
        api('GET', `/api/payments/booking/${id}`),
        api('GET', `/api/refunds/booking/${id}`)
      ]);
      let quote = null;
      if (booking.status === 'CONFIRMED') {
        try { quote = await api('GET', `/api/refunds/preview/${id}`); } catch (e) { quote = null; }
      }
      if (seq !== manageSeq) return;
      remember(id);
      renderManage(booking, payments, refunds, quote);
    } catch (err) {
      if (seq !== manageSeq) return;
      showManageEmpty();
      if (err.status === 404) {
        setError(findForm, 'bookingId', `We couldn't find booking ${id}. Check the number and try again.`);
      } else {
        toast(err.message, 'error');
      }
    }
  }

  function renderManage(booking, payments, refunds, quote) {
    const id = booking.id;
    const status = TICKET_STATUS[booking.status];
    const payment = payments.find(p => p.status === 'PAID' || p.status === 'REFUNDED');
    const lastRefund = refunds[0];

    $('#ticket-manage').innerHTML = ticketHTML(ticketFromBooking(booking, {
      refund: lastRefund ? lastRefund.amount : null,
      refundPercent: lastRefund ? lastRefund.refundPercent : null
    }));
    manageLayout.classList.remove('single');
    manageAside.hidden = false;

    let html = '';

    if (booking.status === 'PENDING_PAYMENT') {
      html += `
        <section class="panel">
          <h2>Payment</h2>
          <p class="note">This booking hasn't been paid yet. Pay ${esc(money(booking.finalAmount))} to confirm it.</p>
          <button class="btn btn-primary" type="button" id="pay-pending">Pay ${esc(money(booking.finalAmount))}</button>
          <p class="message" id="manage-message" role="status" hidden></p>
        </section>`;
    }

    if (booking.status === 'CONFIRMED') {
      if (!quote) {
        html += `
          <section class="panel">
            <h2>Cancel and refund</h2>
            <p class="note">We can't work out your refund right now. Try again in a moment.</p>
          </section>`;
      } else if (Number(quote.refundAmount) <= 0) {
        html += `
          <section class="panel">
            <h2>Cancel and refund</h2>
            <p class="note">${esc(quote.note)}. This booking can't be refunded.</p>
          </section>`;
      } else {
        const chargePercent = Math.round((100 - Number(quote.refundPercent)) * 100) / 100;
        html += `
          <section class="panel">
            <h2>Cancel and refund</h2>
            <dl class="rows">
              <div><dt>Amount paid</dt><dd>${esc(money(quote.paidAmount))}</dd></div>
              <div><dt>Cancellation charge (${esc(percent(chargePercent))})</dt><dd>${MINUS}${esc(money(quote.cancellationCharge))}</dd></div>
              <div class="strong"><dt>You get back (${esc(percent(quote.refundPercent))})</dt><dd>${esc(money(quote.refundAmount))}</dd></div>
            </dl>
            <p class="note">${esc(quote.note)}. The refund goes to the original payment method.</p>
            <button class="btn btn-outline-danger" type="button" id="cancel-btn">Cancel booking</button>
          </section>`;
      }
    }

    if (booking.status === 'CANCELLED' && refunds.length) {
      html += `<section class="panel"><h2>Refund</h2>${refunds.map(r => `
        <dl class="rows">
          <div class="strong"><dt>Refund amount (${esc(percent(r.refundPercent))})</dt><dd>${esc(money(r.amount))}</dd></div>
          <div><dt>Status</dt><dd>${esc(REFUND_STATUS[r.status] || r.status)}</dd></div>
          <div><dt>Refund ID</dt><dd>${esc(r.razorpayRefundId)}</dd></div>
        </dl>`).join('')}
        <p class="note">Refunds usually reach the original payment method in 5 to 7 working days.</p>
      </section>`;
    }

    if (payment) {
      html += `
        <section class="panel">
          <h2>Payment</h2>
          <dl class="rows">
            <div><dt>Payment ID</dt><dd>${esc(payment.razorpayPaymentId)}</dd></div>
            <div><dt>Status</dt><dd>${esc(PAYMENT_STATUS[payment.status] || payment.status)}</dd></div>
          </dl>
        </section>`;
    }

    manageDetail.innerHTML = html;

    const cancelBtn = $('#cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', async () => {
        const confirmed = await confirmDialog({
          title: 'Cancel this booking?',
          body: `You will get ${money(quote.refundAmount)} back (${percent(quote.refundPercent)} of ${money(quote.paidAmount)}). A cancelled booking can't be restored.`,
          confirmLabel: 'Cancel and refund',
          cancelLabel: 'Keep booking',
          danger: true
        });
        if (!confirmed) return;
        setBtnBusy(cancelBtn, true, 'Cancelling booking');
        try {
          const refund = await api('POST', '/api/refunds', { bookingId: id, reason: 'Passenger cancelled' });
          toast(`Booking cancelled. Refund of ${money(refund.amount)} started.`, 'ok');
        } catch (err) {
          toast(err.message, 'error');
        }
        loadManage(id);
      });
    }

    const payPending = $('#pay-pending');
    if (payPending) {
      const messageEl = $('#manage-message');
      const ui = {
        paid: false,
        busy: (busy, label) => setBtnBusy(payPending, busy, label),
        message: (text, tone) => { messageEl.textContent = text; messageEl.dataset.tone = tone; messageEl.hidden = false; },
        confirmed: () => { toast('Booking confirmed.', 'ok'); loadManage(id); }
      };
      payPending.addEventListener('click', () => payForBooking(booking, ui));
    }
  }

  findForm.addEventListener('submit', event => {
    event.preventDefault();
    const value = findForm.elements.bookingId.value.trim();
    if (!/^\d+$/.test(value)) {
      setError(findForm, 'bookingId', 'Enter the booking number, like 12.');
      findForm.elements.bookingId.focus();
      return;
    }
    const target = '#/manage/' + value;
    if (location.hash === target) loadManage(value);
    else location.hash = target;
  });

  // ---------- Routing ----------

  function route() {
    const match = (location.hash || '#/book').match(/^#\/manage(?:\/(\d+))?$/);
    const manage = Boolean(match);
    $('#view-book').hidden = manage;
    $('#view-manage').hidden = !manage;
    document.title = manage ? 'Manage booking' : 'Book a ticket';
    document.querySelectorAll('[data-nav]').forEach(a => {
      if (a.dataset.nav === (manage ? 'manage' : 'book')) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    if (!manage) return;

    const id = match[1];
    findForm.elements.bookingId.value = id || recall();
    if (id) loadManage(id);
    else showManageEmpty();
  }

  // ---------- Start ----------

  async function labelCategories() {
    const select = form.elements.category;
    await Promise.all(Object.keys(CATEGORY_LABELS).map(async key => {
      try {
        const r = await api('GET', `/api/concessions/preview?category=${key}&baseFare=100`);
        if (Number(r.percent) > 0) {
          const option = select.querySelector(`option[value="${key}"]`);
          if (option) option.textContent = `${CATEGORY_LABELS[key]} (${percent(r.percent)} off)`;
        }
      } catch (e) { /* keep plain labels */ }
    }));
  }

  function init() {
    form.elements.category.innerHTML = Object.keys(CATEGORY_LABELS)
      .map(key => `<option value="${key}">${CATEGORY_LABELS[key]}</option>`).join('');
    setDepartureDefaults();
    renderBookTicket();
    labelCategories();
    window.addEventListener('hashchange', route);
    route();
  }

  init();
})();
