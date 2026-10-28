import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Alert, CircularProgress, Chip,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Checkbox,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Divider, LinearProgress
} from '@mui/material';
import PaymentIcon from '@mui/icons-material/Payment';
import TimerIcon from '@mui/icons-material/TimerOutlined';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import { api, bookingApi } from '../../api';
import { payForBooking } from '../../components/checkout';
import { navigate } from '../../router';
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
        <Alert severity="error" action={<Button color="inherit" onClick={() => navigate('/pnr')}>Look up another</Button>}>
          {loadError}
        </Alert>
      </Box>
    );
  }
  if (!booking) return <Box sx={{ textAlign: 'center', p: 4 }}><CircularProgress /></Box>;

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
      {message && <Alert severity={message.severity} sx={{ mb: 3 }} onClose={() => setMessage(null)}>{message.text}</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <Typography variant="h5" component="h1">PNR {booking.pnr}</Typography>
            <Chip label={booking.status} color={BOOKING_STATUS_COLOR[booking.status]} sx={{ fontWeight: 600 }} />
            <Box sx={{ flexGrow: 1 }} />
            {/* Team 6's live status page, fed by Team 2's train-service */}
            {booking.status === 'CONFIRMED' && (
              <Button size="small" variant="outlined" startIcon={<GpsFixedIcon />} onClick={() => navigate(`/live-status/${booking.pnr}`)}>
                Live status
              </Button>
            )}
          </Box>
          <Typography variant="h6" component="p">
            {booking.trainName} <Typography component="span" color="text.secondary">#{booking.trainNo}</Typography>
          </Typography>
          <Typography sx={{ mt: 0.5 }}>
            {booking.from.name} ({booking.from.code}) → {booking.to.name} ({booking.to.code})
          </Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
            Journey {formatDate(booking.journeyDate)} · {booking.classCode} {booking.className} · quota {booking.quotaCode}
            {' · '}booked {formatDateTime(booking.createdAt)}
          </Typography>
        </CardContent>
      </Card>

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

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1 }}>
            <Typography variant="h6" component="h2" sx={{ flexGrow: 1 }}>Passengers</Typography>
            {canCancel && (
              <Button variant="outlined" color="error" onClick={() => setCancelOpen(true)}>
                {selected.length ? `Cancel ${selected.length} selected` : 'Cancel booking'}
              </Button>
            )}
          </Box>
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
                    <TableCell>
                      {p.name}
                      {p.concessionId != null && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {concessions.find((c) => c.concessionId === p.concessionId)?.name || 'Concession'}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{p.age} {p.gender}</TableCell>
                    <TableCell>
                      <Chip label={p.label} size="small" color={PASSENGER_STATUS_COLOR[p.status]} sx={{ fontWeight: 600 }} />
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
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Typography variant="h6">
              {booking.status === 'CONFIRMED' ? 'Paid ' : 'Total '}{rupees(booking.totalFare)}
            </Typography>
          </Box>
        </CardContent>
      </Card>

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
    <Card sx={{ mb: 3, borderColor: urgent ? 'warning.main' : 'primary.main' }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <TimerIcon sx={{ fontSize: 36, color: urgent ? 'warning.main' : 'primary.light' }} />
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
          sx={{ mt: 2, height: 6, borderRadius: 3 }}
          aria-hidden
        />
      </CardContent>
    </Card>
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
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" component="h2" gutterBottom>Payments and refunds</Typography>
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
                  <TableCell>{p.razorpayPaymentId || p.razorpayOrderId}</TableCell>
                  <TableCell>{p.status}</TableCell>
                  <TableCell align="right">{rupees(p.amount)}</TableCell>
                </TableRow>
              ))}
              {refunds.map((r) => (
                <TableRow key={`r${r.id}`}>
                  <TableCell>Refund ({Number(r.refundPercent)}%)</TableCell>
                  <TableCell>{r.razorpayRefundId || '–'}</TableCell>
                  <TableCell>{r.status}</TableCell>
                  <TableCell align="right">{rupees(r.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}
