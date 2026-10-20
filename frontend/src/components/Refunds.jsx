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
    <Box sx={{ maxWidth: 960, mx: 'auto', mt: 1, mb: 5 }}>
      <Paper elevation={0} sx={{ p: 3, mb: 3, bgcolor: '#111a2e', borderRadius: 3, border: '1px solid #1e293b' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <UndoIcon sx={{ fontSize: 32, color: 'primary.light', mr: 1.5 }} />
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#f8fafc' }}>
            Ticket Cancellation & Refund Policy
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: '#94a3b8' }}>
          Official Railway cancellation refund slabs: &gt;48 hrs: 90% | 24–48 hrs: 75% | 4–24 hrs: 50% | &lt;4 hrs: 0%
        </Typography>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 3, bgcolor: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5' }} onClose={() => setError(null)}>{error}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb: 3, bgcolor: 'rgba(74, 222, 128, 0.1)', color: '#86efac' }} onClose={() => setSuccessMsg(null)}>{successMsg}</Alert>}

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ color: '#f8fafc', fontWeight: 600 }}>
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
                  sx={{ py: 1.2 }}
                >
                  {loadingPreview ? 'Calculating...' : 'Preview Cancellation Refund'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%', bgcolor: preview ? '#0d1526' : '#111a2e' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ color: '#f8fafc', fontWeight: 600 }}>
                Refund Calculation Quote
              </Typography>
              {!preview ? (
                <Typography variant="body2" sx={{ color: '#64748b', mt: 4, textAlign: 'center' }}>
                  Enter a Booking ID and click "Preview" to calculate the policy cancellation deductions.
                </Typography>
              ) : (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" sx={{ color: '#94a3b8' }}>Original Ticket Fare:</Typography>
                    <Typography variant="body2" sx={{ color: '#f8fafc', fontWeight: 600 }}>₹{preview.paidAmount}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" sx={{ color: '#94a3b8' }}>Departure Hours Window:</Typography>
                    <Typography variant="body2" sx={{ color: '#f8fafc' }}>{preview.hoursBeforeDeparture != null ? `${preview.hoursBeforeDeparture.toFixed(1)} hrs left` : 'N/A'}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" sx={{ color: '#94a3b8' }}>Refund Percentage:</Typography>
                    <Chip label={`${preview.refundPercentage}%`} color="primary" size="small" sx={{ fontWeight: 600 }} />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" sx={{ color: '#94a3b8' }}>Cancellation Fee:</Typography>
                    <Typography variant="body2" sx={{ color: '#f87171' }}>- ₹{preview.cancellationFee}</Typography>
                  </Box>

                  <Divider sx={{ my: 1.5, borderColor: '#1e293b' }} />

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h6" sx={{ color: '#f8fafc' }}>Refund Payable:</Typography>
                    <Typography variant="h6" sx={{ color: '#4ade80', fontWeight: 700 }}>₹{preview.refundAmount}</Typography>
                  </Box>

                  <Button
                    fullWidth
                    variant="contained"
                    color="secondary"
                    onClick={handleExecuteRefund}
                    disabled={submittingRefund}
                    startIcon={submittingRefund ? <CircularProgress size={20} color="inherit" /> : <UndoIcon />}
                    sx={{ py: 1.2 }}
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
      <Typography variant="h6" sx={{ mb: 2, color: '#f8fafc', fontWeight: 600 }}>
        My Processed Refunds
      </Typography>
      {loadingRefunds ? (
        <CircularProgress size={24} />
      ) : myRefunds.length === 0 ? (
        <Card variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography sx={{ color: '#94a3b8' }}>No refunds processed for this account yet.</Typography>
        </Card>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ bgcolor: '#111a2e', borderColor: '#1e293b' }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: '#0b111e' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, color: '#94a3b8' }}>Refund ID</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#94a3b8' }}>Booking #</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#94a3b8' }}>Refund Amount</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#94a3b8' }}>Reason</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#94a3b8' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#94a3b8' }}>Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {myRefunds.map((r) => (
                <TableRow key={r.id} hover sx={{ '&:hover': { bgcolor: '#162238' } }}>
                  <TableCell sx={{ color: '#f8fafc' }}>#{r.id}</TableCell>
                  <TableCell sx={{ color: '#f8fafc' }}>#{r.bookingId}</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#4ade80' }}>
                    ₹{r.amountInPaise ? (r.amountInPaise / 100).toFixed(2) : '0.00'}
                  </TableCell>
                  <TableCell sx={{ color: '#94a3b8' }}>{r.reason || 'N/A'}</TableCell>
                  <TableCell>
                    <Chip label={r.status || 'PROCESSED'} color="success" size="small" />
                  </TableCell>
                  <TableCell sx={{ color: '#94a3b8' }}>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'N/A'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
