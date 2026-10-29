import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Button, Alert, Chip,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Link
} from '@mui/material';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import { bookingApi } from '../../api';
import { navigate } from '../../router';
import { EmptyState, GlassSection, LoadingCard, Mono, PageHeader, StatPill } from '../../components/ui';
import { BOOKING_STATUS_COLOR, formatDate, rupees } from './format';

/**
 * #/bookings: the customer's bookings, newest first. Paying, PNR status and
 * cancelling (or cancel with refund, once paid) happen on the booking's page.
 */
export default function MyBookings() {
  const [bookings, setBookings] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    bookingApi.mine().then(setBookings).catch((err) => setError(err.message));
  }, []);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!bookings) return <LoadingCard text="Loading your bookings…" />;

  const now = Date.now();
  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      <PageHeader
        tag="Your trips"
        title="My bookings"
        subtitle="Your tickets, newest first. Open one to pay, check its PNR status or cancel."
      />
      {bookings.length === 0 ? (
        <EmptyState
          icon={<ConfirmationNumberIcon />}
          title="You have no bookings yet."
          text="Search for a train and your tickets will show up here."
          action={<Button variant="contained" onClick={() => navigate('/search')}>Book a ticket</Button>}
        />
      ) : (
        <>
          {/* Wide screens: a table */}
          <GlassSection padding={0} sx={{ display: { xs: 'none', md: 'block' } }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>PNR</TableCell>
                    <TableCell>Train</TableCell>
                    <TableCell>Journey</TableCell>
                    <TableCell>Class</TableCell>
                    <TableCell>Passengers</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Fare</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {bookings.map((b) => {
                    const awaitingPayment = isAwaitingPayment(b, now);
                    return (
                      <TableRow key={b.pnr} hover>
                        <TableCell>
                          <Link component={RouterLink} to={`/pnr/${b.pnr}`} underline="hover"><Mono>{b.pnr}</Mono></Link>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ fontWeight: 700 }}>{b.trainName}</Box>
                          <Typography variant="caption" color="text.secondary"><Mono>#{b.trainNo}</Mono></Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ fontWeight: 600 }}>{b.fromStation} → {b.toStation}</Box>
                          <Typography variant="caption" color="text.secondary">{formatDate(b.journeyDate)}</Typography>
                        </TableCell>
                        <TableCell>{b.classCode}</TableCell>
                        <TableCell>{passengerCount(b)}</TableCell>
                        <TableCell>
                          <Chip label={b.status} size="small" color={BOOKING_STATUS_COLOR[b.status]} />
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{rupees(b.totalFare)}</TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            variant={awaitingPayment ? 'contained' : 'text'}
                            onClick={() => navigate(`/pnr/${b.pnr}`)}
                          >
                            {awaitingPayment ? 'Pay now' : 'View'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </GlassSection>

          {/* Narrow screens: one card per booking */}
          <Box sx={{ display: { xs: 'block', md: 'none' } }}>
            {bookings.map((b) => {
              const awaitingPayment = isAwaitingPayment(b, now);
              return (
                <GlassSection key={b.pnr} sx={{ mb: 2 }} contentSx={{ p: 2.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <Link component={RouterLink} to={`/pnr/${b.pnr}`} underline="hover" sx={{ flexGrow: 1 }}>
                      <Mono>{b.pnr}</Mono>
                    </Link>
                    <Chip label={b.status} size="small" color={BOOKING_STATUS_COLOR[b.status]} />
                  </Box>
                  <Typography sx={{ fontWeight: 800 }}>
                    {b.trainName} <Mono sx={{ color: 'text.secondary', fontSize: '0.85em' }}>#{b.trainNo}</Mono>
                  </Typography>
                  <Typography sx={{ fontWeight: 600 }}>{b.fromStation} → {b.toStation}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{formatDate(b.journeyDate)}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                    <StatPill>{b.classCode}</StatPill>
                    <StatPill>{passengerCount(b)} {b.passengers === 1 ? 'passenger' : 'passengers'}</StatPill>
                    <Box sx={{ flexGrow: 1 }} />
                    <Typography sx={{ fontWeight: 800 }}>{rupees(b.totalFare)}</Typography>
                  </Box>
                  <Button
                    fullWidth size="small" sx={{ mt: 2 }}
                    variant={awaitingPayment ? 'contained' : 'outlined'}
                    onClick={() => navigate(`/pnr/${b.pnr}`)}
                  >
                    {awaitingPayment ? 'Pay now' : 'View'}
                  </Button>
                </GlassSection>
              );
            })}
          </Box>
        </>
      )}
    </Box>
  );
}

const isAwaitingPayment = (b, now) => b.status === 'HELD' && new Date(b.holdExpiresAt).getTime() > now;
const passengerCount = (b) => (b.activePassengers === b.passengers ? b.passengers : `${b.activePassengers} of ${b.passengers}`);
