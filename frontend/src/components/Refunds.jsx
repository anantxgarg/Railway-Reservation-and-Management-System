import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button, Grid,
  Alert, Divider, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, CircularProgress
} from '@mui/material';
import UndoIcon from '@mui/icons-material/Undo';
import CalculateIcon from '@mui/icons-material/Calculate';
import { api } from '../api';

export default function Refunds({ user }) {
  const [bookingId, setBookingId] = useState('');
  const [reason, setReason] = useState('Change of travel plan');
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submittingRefund, setSubmittingRefund] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [myRefunds, setMyRefunds] = useState([]);
  const [loadingRefunds, setLoadingRefunds] = useState(false);

  const loadMyRefunds = async () => {
    setLoadingRefunds(true);
    try {
      const data = await api.getMyRefunds();
      setMyRefunds(data || []);
    } catch (err) {
      // not blocking
    } finally {
      setLoadingRefunds(false);
    }
  };

  useEffect(() => {
    loadMyRefunds();
  }, [user]);

  const handlePreviewRefund = async (e) => {
    e.preventDefault();
    if (!bookingId) return;
    setLoadingPreview(true);
    setError(null);
    setPreview(null);
    setSuccessMsg(null);

    try {
      const quote = await api.previewRefund(bookingId);
      setPreview(quote);
    } catch (err) {
      setError(err.message || 'Failed to fetch refund quote for booking #' + bookingId);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleExecuteRefund = async () => {
    if (!bookingId) return;
    setSubmittingRefund(true);
    setError(null);

    try {
      const res = await api.requestRefund({
        bookingId: Number(bookingId),
        reason: reason || 'Customer requested cancellation'
      });
      setSuccessMsg(`Refund of ₹${(res.amountInPaise / 100).toFixed(2)} initiated successfully (Refund ID: #${res.id})`);
      setPreview(null);
      setBookingId('');
      loadMyRefunds();
    } catch (err) {
      setError(err.message || 'Refund processing failed');
    } finally {
      setSubmittingRefund(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 950, mx: 'auto', mt: 3, mb: 5 }}>
      <Paper elevation={0} sx={{ p: 3, mb: 3, bgcolor: '#ffffff', borderRadius: 2, border: '1px solid #e2e8f0' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <UndoIcon sx={{ fontSize: 32, color: 'primary.main', mr: 1.5 }} />
          <Typography variant="h5" color="primary">
            Railway Ticket Cancellation & Refund Policy
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Official IRCTC cancellation refund slabs: &gt;48 hrs: 90% | 24–48 hrs: 75% | 4–24 hrs: 50% | &lt;4 hrs: 0%
        </Typography>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccessMsg(null)}>{successMsg}</Alert>}

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom color="primary.main">
                Check Refund Eligibility
              </Typography>
              <form onSubmit={handlePreviewRefund}>
                <TextField
                  fullWidth
                  label="Booking ID / PNR Number"
                  value={bookingId}
                  onChange={(e) => setBookingId(e.target.value)}
                  placeholder="e.g. 1"
                  required
                  type="number"
                  size="small"
                  sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth
                  label="Cancellation Reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  size="small"
                  sx={{ mb: 2 }}
                />
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={loadingPreview ? <CircularProgress size={20} color="inherit" /> : <CalculateIcon />}
                  type="submit"
                  disabled={loadingPreview || !bookingId}
                >
                  {loadingPreview ? 'Calculating...' : 'Preview Cancellation Refund'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%', bgcolor: preview ? '#f8fafc' : '#ffffff' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom color="primary.main">
                Refund Calculation Quote
              </Typography>
              {!preview ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 3, textAlign: 'center' }}>
                  Enter a Booking ID and click "Preview" to calculate the policy cancellation deductions.
                </Typography>
              ) : (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">Original Ticket Fare:</Typography>
                    <Typography variant="body2" fontWeight={600}>₹{preview.paidAmount}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">Departure Hours Window:</Typography>
                    <Typography variant="body2">{preview.hoursBeforeDeparture != null ? `${preview.hoursBeforeDeparture.toFixed(1)} hrs left` : 'N/A'}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">Refund Percentage:</Typography>
                    <Chip label={`${preview.refundPercentage}%`} color="primary" size="small" sx={{ fontWeight: 600 }} />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">Cancellation Charge:</Typography>
                    <Typography variant="body2" color="error.main">- ₹{preview.cancellationFee}</Typography>
                  </Box>

                  <Divider sx={{ my: 1.5 }} />

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h6">Refund Payable:</Typography>
                    <Typography variant="h6" color="success.main">₹{preview.refundAmount}</Typography>
                  </Box>

                  <Button
                    fullWidth
                    variant="contained"
                    color="secondary"
                    onClick={handleExecuteRefund}
                    disabled={submittingRefund}
                    startIcon={submittingRefund ? <CircularProgress size={20} color="inherit" /> : <UndoIcon />}
                  >
                    {submittingRefund ? 'Processing Refund...' : 'Confirm Ticket Cancellation & Refund'}
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Refund History Table */}
      <Typography variant="h6" sx={{ mb: 2 }} color="primary.main">
        My Processed Refunds
      </Typography>
      {loadingRefunds ? (
        <CircularProgress size={24} />
      ) : myRefunds.length === 0 ? (
        <Card variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">No refunds processed for this account yet.</Typography>
        </Card>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Refund ID</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Booking #</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Refund Amount</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Reason</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {myRefunds.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>#{r.id}</TableCell>
                  <TableCell>#{r.bookingId}</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'success.main' }}>
                    ₹{r.amountInPaise ? (r.amountInPaise / 100).toFixed(2) : '0.00'}
                  </TableCell>
                  <TableCell>{r.reason || 'N/A'}</TableCell>
                  <TableCell>
                    <Chip label={r.status || 'PROCESSED'} color="success" size="small" />
                  </TableCell>
                  <TableCell>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'N/A'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
