import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Alert, CircularProgress, Chip,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Checkbox,
  Dialog, DialogTitle, DialogContent, DialogActions, LinearProgress
} from '@mui/material';
import PaymentIcon from '@mui/icons-material/Payment';
import TimerIcon from '@mui/icons-material/TimerOutlined';
import { bookingApi } from '../../api';
import { navigate } from '../../router';
import {
  BOOKING_STATUS_COLOR, PASSENGER_STATUS_COLOR, formatDate, formatDateTime, mmss, rupees, useCountdown
} from './format';

const HOLD_MS = 15 * 60 * 1000;

/**
 * One booking (#/pnr/{pnr}): PNR status for everyone allowed to see it, and
 * for the owner of an unpaid booking the review step, with the 15-minute
 * hold countdown and a simulated payment.
 *
 * Team 3 demo: Team 4's payments app isn't part of it, so booking-service's
 * demo mode stands in for it.
 *   Pay     -> POST /api/bookings/{pnr}/demo-pay confirms the HELD booking
 *              (no money moves)
 *   Cancel  -> POST /api/bookings/{pnr}/cancel, for HELD and CONFIRMED
 *              bookings alike (no refund is made)
 */
export default function BookingPage({ pnr, user }) {
  const [booking, setBooking] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [selected, setSelected] = useState([]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [message, setMessage] = useState(null);

  const show = useCallback((data) => {
    setBooking(data);
    setLoadError(null);
    setSelected((ids) => ids.filter((id) => data.passengers.some((p) => p.passengerId === id && p.status !== 'CANCELLED')));
  }, []);

  const load = useCallback(async () => {
    try {
      show(await bookingApi.get(pnr));
    } catch (err) {
      setLoadError(err.message);
    }
  }, [pnr, show]);

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
      show(await bookingApi.demoPay(pnr));
      setMessage({ severity: 'success', text: 'Payment simulated (demo, no money was taken). Your booking is confirmed.' });
    } catch (err) {
      setMessage({ severity: 'error', text: err.message });
      load();
    } finally {
      setPaying(false);
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
                    <TableCell>{p.name}</TableCell>
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
            <Typography variant="body2" color="warning.light" sx={{ mt: 0.5 }}>
              Demo: payment is simulated. No payment gateway is opened and no money is taken.
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
              Pay {rupees(totalFare)} (demo)
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
 * Confirms a cancellation. Both unpaid and (demo-)paid bookings are cancelled
 * by booking-service; the demo has no refunds, which are Team 4's.
 */
function CancelDialog({ booking, passengerIds, onClose, onDone }) {
  const paid = booking.status === 'CONFIRMED';
  const ids = passengerIds.length ? passengerIds : null; // null = everyone left on the booking
  const names = booking.passengers
    .filter((p) => p.status !== 'CANCELLED' && (!ids || ids.includes(p.passengerId)))
    .map((p) => p.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await bookingApi.cancel(booking.pnr, ids);
      const count = `${result.cancelled.length} passenger${result.cancelled.length === 1 ? '' : 's'}`;
      onDone(paid
        ? `Cancelled ${count} (${rupees(result.cancelledFare)}). Demo: the payment was simulated, so no refund is made.`
        : `Cancelled ${count}. Nothing was paid, so there is nothing to refund.`);
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
        <Typography variant="body2" color="text.secondary">
          {paid
            ? 'Demo: the payment was simulated, so there is no refund. '
            : "The booking hasn't been paid, so there's no refund. "}
          Their seats go to the next passengers waiting.
        </Typography>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>Keep</Button>
        <Button variant="contained" color="error" onClick={confirm} disabled={busy}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}
