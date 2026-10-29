import React, { useState, useEffect } from 'react';
import {
  Box, Typography, TextField, Button, Grid,
  Alert, Divider, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, CircularProgress
} from '@mui/material';
import UndoIcon from '@mui/icons-material/Undo';
import CalculateIcon from '@mui/icons-material/Calculate';
import HistoryIcon from '@mui/icons-material/History';
import { api } from '../api';
import { PageHeader, GlassSection, EmptyState, LoadingCard, Mono } from './ui';

/**
 * Cancel a booking and get a refund: the policy, a form that quotes the
 * refund for a PNR, and the customer's refund history. Shown to customers
 * and staff; only customers have refunds of their own to list.
 */

export default function Refunds({ user }) {
  const [pnr, setPnr] = useState('');
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
    if (user.role === 'CUSTOMER') loadMyRefunds(); // staff have no refunds of their own
  }, [user]);

  const handlePreviewRefund = async (e) => {
    e.preventDefault();
    if (!pnr) return;
    setLoadingPreview(true);
    setError(null);
    setPreview(null);
    setSuccessMsg(null);

    try {
      const quote = await api.previewRefund(pnr);
      setPreview(quote);
    } catch (err) {
      setError(err.message || 'Failed to fetch refund quote for PNR ' + pnr);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleExecuteRefund = async () => {
    if (!pnr) return;
    setSubmittingRefund(true);
    setError(null);

    try {
      // no passengerIds: cancels everyone left on the booking. To cancel some
      // passengers only, select them on the booking's page (#/pnr/{pnr}).
      const res = await api.requestRefund({
        pnr,
        reason: reason || 'Customer requested cancellation'
      });
      setSuccessMsg(`Booking cancelled. Refund of ₹${Number(res.amount).toFixed(2)} initiated (Refund ID: #${res.id})`);
      setPreview(null);
      setPnr('');
      loadMyRefunds();
    } catch (err) {
      setError(err.message || 'Refund processing failed');
    } finally {
      setSubmittingRefund(false);
    }
  };

  return (
    <Box>
      <PageHeader
        tag="Refunds"
        title="Ticket cancellation & refunds"
        subtitle="Official Railway cancellation refund slabs: >48 hrs: 90% | 24–48 hrs: 75% | 4–24 hrs: 50% | <4 hrs: 0%"
      />

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccessMsg(null)}>{successMsg}</Alert>}

      <Grid container spacing={3} sx={{ mb: 1 }}>
        <Grid item xs={12} md={6}>
          <GlassSection title="Check Refund Eligibility" icon={<CalculateIcon />} sx={{ height: 'calc(100% - 24px)' }}>
            <form onSubmit={handlePreviewRefund}>
              <TextField
                fullWidth
                label="PNR"
                value={pnr}
                onChange={(e) => setPnr(e.target.value.replace(/\D/g, ''))}
                placeholder="10-digit PNR"
                required
                inputProps={{ inputMode: 'numeric', maxLength: 10 }}
                helperText="Cancels the whole booking. To cancel some passengers, open the booking from PNR status."
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
                disabled={loadingPreview || !pnr}
                sx={{ py: 1.2 }}
              >
                {loadingPreview ? 'Calculating...' : 'Preview Cancellation Refund'}
              </Button>
            </form>
          </GlassSection>
        </Grid>

        <Grid item xs={12} md={6}>
          <GlassSection title="Refund Calculation Quote" icon={<UndoIcon />} sx={{ height: 'calc(100% - 24px)' }}>
            {!preview ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
                Enter a PNR and click "Preview" to calculate the policy cancellation deductions.
              </Typography>
            ) : (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Paid for the booking:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>₹{preview.paidAmount}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Refund Percentage:</Typography>
                  <Chip label={`${Number(preview.refundPercent)}%`} color="primary" size="small" />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Cancellation Fee:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'error.main' }}>- ₹{preview.cancellationCharge}</Typography>
                </Box>
                {preview.note && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>{preview.note}</Typography>
                )}

                <Divider sx={{ my: 1.5 }} />

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">Refund Payable:</Typography>
                  <Typography variant="h6" sx={{ color: 'success.main', fontWeight: 800 }}>₹{preview.refundAmount}</Typography>
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
          </GlassSection>
        </Grid>
      </Grid>

      {/* Refund History Table */}
      {loadingRefunds ? (
        <LoadingCard text="Loading refunds…" />
      ) : myRefunds.length === 0 ? (
        <EmptyState
          icon={<HistoryIcon />}
          title="My Processed Refunds"
          text="No refunds processed for this account yet."
        />
      ) : (
        <GlassSection title="My Processed Refunds" icon={<HistoryIcon />} padding={0}>
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 560 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Refund ID</TableCell>
                  <TableCell>PNR</TableCell>
                  <TableCell align="right">Refund Amount</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {myRefunds.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell><Mono>#{r.id}</Mono></TableCell>
                    <TableCell><Mono>{r.pnr}</Mono></TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, color: 'success.main' }}>
                      ₹{Number(r.amount).toFixed(2)}
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{r.reason || 'N/A'}</TableCell>
                    <TableCell>
                      <Chip label={r.status} color={r.status === 'FAILED' ? 'error' : r.status === 'PENDING' ? 'warning' : 'success'} size="small" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </GlassSection>
      )}
    </Box>
  );
}
