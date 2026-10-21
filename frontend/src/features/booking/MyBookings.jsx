import React, { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Alert, CircularProgress, Chip,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Link
} from '@mui/material';
import { bookingApi } from '../../api';
import { navigate } from '../../router';
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
  if (!bookings) return <Box sx={{ textAlign: 'center', p: 4 }}><CircularProgress /></Box>;

  const now = Date.now();
  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      <Typography variant="h5" component="h1" gutterBottom>My bookings</Typography>
      {bookings.length === 0 ? (
        <Card>
          <CardContent sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary" gutterBottom>You have no bookings yet.</Typography>
            <Button variant="contained" onClick={() => navigate('/search')}>Book a ticket</Button>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Card}>
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
                const awaitingPayment = b.status === 'HELD' && new Date(b.holdExpiresAt).getTime() > now;
                return (
                  <TableRow key={b.pnr} hover>
                    <TableCell>
                      <Link href={`#/pnr/${b.pnr}`} underline="hover" fontWeight={600}>{b.pnr}</Link>
                    </TableCell>
                    <TableCell>{b.trainName}<br /><Typography variant="caption" color="text.secondary">#{b.trainNo}</Typography></TableCell>
                    <TableCell>
                      {b.fromStation} → {b.toStation}
                      <br /><Typography variant="caption" color="text.secondary">{formatDate(b.journeyDate)}</Typography>
                    </TableCell>
                    <TableCell>{b.classCode}</TableCell>
                    <TableCell>
                      {b.activePassengers === b.passengers ? b.passengers : `${b.activePassengers} of ${b.passengers}`}
                    </TableCell>
                    <TableCell>
                      <Chip label={b.status} size="small" color={BOOKING_STATUS_COLOR[b.status]} sx={{ fontWeight: 600 }} />
                    </TableCell>
                    <TableCell align="right">{rupees(b.totalFare)}</TableCell>
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
      )}
    </Box>
  );
}
