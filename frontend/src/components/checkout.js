import { api } from '../api';

/**
 * Pays for a HELD booking with Razorpay Checkout (Team 4).
 *
 *   1. POST /api/payments/order {pnr}: the payments app reads the amount from
 *      the booking and opens a Razorpay order (or reuses the open one).
 *   2. Razorpay's popup takes the payment.
 *   3. POST /api/payments/verify: the payments app checks the signature and
 *      confirms the booking in the same transaction.
 *
 * Resolves with the verified payment: status PAID when the booking is now
 * CONFIRMED, or REFUNDED when it could no longer be confirmed (e.g. the hold
 * expired meanwhile) and the money went straight back. Resolves with null if
 * the customer closes the popup; rejects when the order or verification
 * fails, or the customer closes the popup after a failed attempt.
 */
export async function payForBooking({ pnr, user }) {
  if (!window.Razorpay) {
    throw new Error('The payment gateway did not load. Check your internet connection and reload the page.');
  }
  const order = await api.createPaymentOrder(pnr);

  return new Promise((resolve, reject) => {
    // Razorpay keeps its popup open after a failed attempt so the customer can
    // retry; the failure is only reported if they then give up.
    let lastFailure = null;
    const rzp = new window.Razorpay({
      key: order.keyId,
      amount: order.amountInPaise,
      currency: order.currency,
      name: 'Railway Reservation',
      description: `Ticket PNR ${pnr}`,
      order_id: order.orderId,
      prefill: { name: user?.name, email: user?.email, contact: user?.phone },
      theme: { color: '#1d68ed' },
      handler: (response) => {
        api.verifyPayment({
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        }).then(resolve, reject);
      },
      modal: { ondismiss: () => (lastFailure ? reject(lastFailure) : resolve(null)) },
    });
    rzp.on('payment.failed', (resp) => {
      lastFailure = new Error(`Payment failed: ${resp.error?.description || resp.error?.reason || 'unknown reason'}`);
    });
    rzp.open();
  });
}
