import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Button, Alert, CircularProgress, Chip,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Checkbox,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Divider, LinearProgress
} from '@mui/material';
import PaymentIcon from '@mui/icons-material/Payment';
import TimerIcon from '@mui/icons-material/TimerOutlined';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import TrainIcon from '@mui/icons-material/Train';
import GroupIcon from '@mui/icons-material/GroupsOutlined';
import ReceiptIcon from '@mui/icons-material/ReceiptLongOutlined';
import { api, bookingApi } from '../../api';
import { payForBooking } from '../../components/checkout';
import { navigate } from '../../router';
import {
  DetailGrid, DetailItem, GlassSection, IconTile, LoadingCard, Mono, PageHeader, StatPill
} from '../../components/ui';
import {
  BOOKING_STATUS_COLOR, PASSENGER_STATUS_COLOR, formatDate, formatDateTime, mmss, rupees, useCountdown
} from './format';
import { useConcessionRules } from './concessions';

const HOLD_MS = 15 * 60 * 1000;

/**
 * One booking (/pnr/{pnr}): PNR status for everyone allowed to see it, and
 * for the owner of an unpaid booking the review step, with the 15-minute
 * hold countdown and the hand-off to Team 4's payment.
 *
 * Cancelling depends on whether the booking was paid:
 *   HELD (unpaid)     -> booking-service, POST /api/bookings/{pnr}/cancel
 *   CONFIRMED (paid)  -> Team 4, POST /api/refunds, which cancels and refunds
 *                        in one transaction
 */
export default function BookingPage({ pnr, user }) {
  const [booking, setBooking] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [history, setHistory] = useState({ payments: [], refunds: [] });
  const [selected, setSelected] = useState([]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [message, setMessage] = useState(null);
  const concessions = useConcessionRules();

  const load = useCallback(async () => {
    try {
      const data = await bookingApi.get(pnr);
      setBooking(data);
      setLoadError(null);
      setSelected((ids) => ids.filter((id) => data.passengers.some((p) => p.passengerId === id && p.status !== 'CANCELLED')));
    } catch (err) {
      setLoadError(err.message);
    }
    // Payment history is Team 4's; the page still works if that app is down.
    const [payments, refunds] = await Promise.all([
      api.getPaymentsForBooking(pnr).catch(() => []),
      api.getRefundsForBooking(pnr).catch(() => []),
    ]);
    setHistory({ payments, refunds });
  }, [pnr]);

  useEffect(() => {
    setBooking(null);
    setMessage(null);
    setSelected([]);
    load();
  }, [load]);

  const remaining = useCountdown(booking?.status === 'HELD' ? booking.holdExpiresAt : null);

  if (loadError) {
    return (
      <Box sx={{ maxWidth: 960, mx: 'auto' }}>
        <PageHeader tag="PNR status" title={`PNR ${pnr}`} />
        <Alert severity="error" action={<Button color="inherit" onClick={() => navigate('/pnr')}>Look up another</Button>}>
          {loadError}
        </Alert>
      </Box>
    );
  }
  if (!booking) return <LoadingCard text="Loading the booking…" />;

  const isOwner = user.userId === booking.userId;
  const isStaff = user.role === 'STAFF' || user.role === 'ADMIN';
  const held = booking.status === 'HELD';
  const holdActive = held && remaining > 0;
  const active = booking.passengers.filter((p) => p.status !== 'CANCELLED');
  const canPay = holdActive && isOwner && user.role === 'CUSTOMER';
  const canCancel = (isOwner || isStaff) && (holdActive || booking.status === 'CONFIRMED') && active.length > 0;

  const pay = async () => {
    setPaying(true);
    setMessage(null);
    try {
      const payment = await payForBooking({ pnr, user });
      if (payment?.status === 'PAID') {
        setMessage({ severity: 'success', text: 'Payment received. Your booking is confirmed.' });
      } else if (payment) {
        setMessage({
          severity: 'warning',
          text: 'The payment arrived after the booking could no longer be confirmed, so it was refunded in full.',
        });
      }
    } catch (err) {
      setMessage({ severity: 'error', text: err.message });
    } finally {
      setPaying(false);
      load();
    }
  };

  const toggle = (id) =>
    setSelected((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto' }}>
      <PageHeader
        tag="PNR status"
        title={<>PNR <Mono>{booking.pnr}</Mono></>}
        subtitle={held ? 'Review the details below, then pay to confirm your seats.' : 'The booking, its passengers and any payments.'}
      />

      {message && <Alert severity={message.severity} sx={{ mb: 3 }} onClose={() => setMessage(null)}>{message.text}</Alert>}

      <GlassSection
        title={booking.trainName}
        subtitle={<>Train <Mono>#{booking.trainNo}</Mono></>}
        icon={<TrainIcon />}
        actions={
          <>
            <Chip label={booking.status} color={BOOKING_STATUS_COLOR[booking.status]} />
            {/* Team 6's live status page, fed by Team 2's train-service */}
            {booking.status === 'CONFIRMED' && (
              <Button size="small" variant="outlined" startIcon={<GpsFixedIcon />} onClick={() => navigate(`/live-status/${booking.pnr}`)}>
                Live status
              </Button>
            )}
          </>
        }
        contentSx={{ pt: 2.5 }}
      >
        <DetailGrid columns={{ xs: 1, sm: 2, md: 3 }}>
          <DetailItem label="From">{booking.from.name} ({booking.from.code})</DetailItem>
          <DetailItem label="To">{booking.to.name} ({booking.to.code})</DetailItem>
          <DetailItem label="Journey date">{formatDate(booking.journeyDate)}</DetailItem>
          <DetailItem label="Class">{booking.classCode} {booking.className}</DetailItem>
          <DetailItem label="Quota">{booking.quotaCode}</DetailItem>
          <DetailItem label="Booked">{formatDateTime(booking.createdAt)}</DetailItem>
        </DetailGrid>
      </GlassSection>

      {held && (
        <HoldCard
          remaining={remaining}
          totalFare={booking.totalFare}
          canPay={canPay}
          paying={paying}
          onPay={pay}
          onSearchAgain={() => navigate('/search')}
        />
      )}

      <GlassSection
        title="Passengers"
        icon={<GroupIcon />}
        padding={0}
        actions={canCancel && (
          <Button variant="outlined" color="error" onClick={() => setCancelOpen(true)}>
            {selected.length ? `Cancel ${selected.length} selected` : 'Cancel booking'}
          </Button>
        )}
      >
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                {canCancel && <TableCell padding="checkbox" />}
                <TableCell>#</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Age</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Fare</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {booking.passengers.map((p) => (
                <TableRow key={p.passengerId}>
                  {canCancel && (
                    <TableCell padding="checkbox">
                      {p.status !== 'CANCELLED' && (
                        <Checkbox
                          checked={selected.includes(p.passengerId)}
                          onChange={() => toggle(p.passengerId)}
                          inputProps={{ 'aria-label': `Select ${p.name}` }}
                        />
                      )}
                    </TableCell>
                  )}
                  <TableCell>{p.passengerNo}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {p.name}
                    {p.concessionId != null && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {concessions.find((c) => c.concessionId === p.concessionId)?.name || 'Concession'}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{p.age} {p.gender}</TableCell>
                  <TableCell>
                    <Chip label={p.label} size="small" color={PASSENGER_STATUS_COLOR[p.status]} />
                    {p.currentPosition != null && (
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        now {p.status === 'RAC' ? 'RAC' : 'WL'} {p.currentPosition}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">{rupees(p.fare)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 3, py: 2, borderTop: (t) => `1px solid ${t.app.divider}` }}>
          <StatPill sx={{ fontSize: '0.95rem', px: 2, py: 0.75 }}>
            {booking.status === 'CONFIRMED' ? 'Paid' : 'Total'} {rupees(booking.totalFare)}
          </StatPill>
        </Box>
      </GlassSection>

      <PaymentHistory payments={history.payments} refunds={history.refunds} />

      {cancelOpen && (
        <CancelDialog
          booking={booking}
          passengerIds={selected}
          onClose={() => setCancelOpen(false)}
          onDone={(text) => {
            setCancelOpen(false);
            setSelected([]);
            setMessage({ severity: 'success', text });
            load();
          }}
        />
      )}
    </Box>
  );
}

function HoldCard({ remaining, totalFare, canPay, paying, onPay, onSearchAgain }) {
  if (remaining === 0) {
    return (
      <Alert
        severity="warning"
        sx={{ mb: 3 }}
        action={<Button color="inherit" onClick={onSearchAgain}>Search again</Button>}
      >
        The 15-minute hold has expired and the seats are being released. Book again to travel.
      </Alert>
    );
  }
  const urgent = remaining < 2 * 60 * 1000;
  return (
    <GlassSection sx={{ borderColor: urgent ? 'warning.main' : 'primary.main' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <IconTile size={52} color={urgent ? 'warning' : 'primary'}><TimerIcon /></IconTile>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h6" component="h2">
            Seats held for <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }} role="timer">{mmss(remaining)}</Box>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Check the details below, then pay to confirm. Unpaid holds are released automatically.
          </Typography>
        </Box>
        {canPay && (
          <Button
            variant="contained"
            size="large"
            startIcon={paying ? <CircularProgress size={20} color="inherit" /> : <PaymentIcon />}
            disabled={paying}
            onClick={onPay}
          >
            Pay {rupees(totalFare)}
          </Button>
        )}
      </Box>
      <LinearProgress
        variant="determinate"
        value={Math.min(100, (remaining / HOLD_MS) * 100)}
        color={urgent ? 'warning' : 'primary'}
        sx={{ mt: 2.5, height: 6, borderRadius: 3 }}
        aria-hidden
      />
    </GlassSection>
  );
}

/**
 * Confirms a cancellation. For a paid booking it first shows Team 4's refund
 * quote (refund percentage by time to departure) and sends the cancellation
 * to the refunds endpoint.
 */
function CancelDialog({ booking, passengerIds, onClose, onDone }) {
  const paid = booking.status === 'CONFIRMED';
  const ids = passengerIds.length ? passengerIds : null; // null = everyone left on the booking
  const names = booking.passengers
    .filter((p) => p.status !== 'CANCELLED' && (!ids || ids.includes(p.passengerId)))
    .map((p) => p.name);
  const [quote, setQuote] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(paid);
  const [error, setError] = useState(null);

  // The dialog is opened for one selection, so the quote is fetched once.
  useEffect(() => {
    if (!paid) return;
    api.previewRefund(booking.pnr, ids)
      .then(setQuote)
      .catch((err) => setError(err.message))
      .finally(() => setBusy(false));
  }, []);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      if (paid) {
        const refund = await api.requestRefund({ pnr: booking.pnr, passengerIds: ids, reason: reason.trim() || null });
        onDone(`Cancelled. ${rupees(refund.amount)} will be refunded to the original payment method.`);
      } else {
        const result = await bookingApi.cancel(booking.pnr, ids);
        onDone(`Cancelled ${result.cancelled.length} passenger${result.cancelled.length === 1 ? '' : 's'}. Nothing was paid, so there is nothing to refund.`);
      }
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{ids ? 'Cancel passengers' : 'Cancel booking'}</DialogTitle>
      <DialogContent>
        <Typography gutterBottom>Cancel {names.join(', ')}?</Typography>
        {paid && quote && (
          <Box sx={{ my: 2 }}>
            <Row label="Paid for these passengers" value={rupees(quote.paidAmount)} />
            <Row label={`Refund (${Number(quote.refundPercent)}%)`} value={rupees(quote.refundAmount)} strong />
            <Row label="Cancellation charge" value={rupees(quote.cancellationCharge)} />
            {quote.note && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{quote.note}</Typography>}
            <Divider sx={{ my: 2 }} />
            <TextField
              fullWidth size="small" label="Reason (optional)"
              value={reason} onChange={(e) => setReason(e.target.value)} inputProps={{ maxLength: 255 }}
            />
          </Box>
        )}
        {paid && !quote && !error && <Box sx={{ textAlign: 'center', p: 2 }}><CircularProgress size={24} /></Box>}
        {!paid && (
          <Typography variant="body2" color="text.secondary">
            The booking hasn't been paid, so there's no refund. Their seats go to the next passengers waiting.
          </Typography>
        )}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>Keep</Button>
        <Button variant="contained" color="error" onClick={confirm} disabled={busy || (paid && !quote)}>
          {paid ? 'Cancel and refund' : 'Cancel'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function Row({ label, value, strong }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
      <Typography color={strong ? 'text.primary' : 'text.secondary'} fontWeight={strong ? 600 : 400}>{label}</Typography>
      <Typography fontWeight={strong ? 600 : 400}>{value}</Typography>
    </Box>
  );
}

function PaymentHistory({ payments, refunds }) {
  if (!payments.length && !refunds.length) return null;
  return (
    <GlassSection title="Payments and refunds" icon={<ReceiptIcon />} padding={0}>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Type</TableCell>
              <TableCell>Reference</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Amount</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={`p${p.id}`}>
                <TableCell>Payment</TableCell>
                <TableCell><Mono>{p.razorpayPaymentId || p.razorpayOrderId}</Mono></TableCell>
                <TableCell>{p.status}</TableCell>
                <TableCell align="right">{rupees(p.amount)}</TableCell>
              </TableRow>
            ))}
            {refunds.map((r) => (
              <TableRow key={`r${r.id}`}>
                <TableCell>Refund ({Number(r.refundPercent)}%)</TableCell>
                <TableCell><Mono>{r.razorpayRefundId || '–'}</Mono></TableCell>
                <TableCell>{r.status}</TableCell>
                <TableCell align="right">{rupees(r.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </GlassSection>
  );
}
