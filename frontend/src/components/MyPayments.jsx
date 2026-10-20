import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper,
  Chip, CircularProgress, Alert, Button
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReceiptIcon from '@mui/icons-material/ReceiptLong';
import { api } from '../api';

export default function MyPayments({ user }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPayments = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getMyPayments();
      setPayments(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [user]);

  const getStatusChip = (status) => {
    if (status === 'PAID') {
      return <Chip label="PAID" color="success" size="small" sx={{ fontWeight: 600 }} />;
    } else if (status === 'CREATED') {
      return <Chip label="PENDING" color="warning" size="small" sx={{ fontWeight: 600 }} />;
    } else {
      return <Chip label={status || 'FAILED'} color="error" size="small" sx={{ fontWeight: 600 }} />;
    }
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', mt: 3, mb: 5 }}>
      <Paper elevation={0} sx={{ p: 3, mb: 3, bgcolor: '#ffffff', borderRadius: 2, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <ReceiptIcon sx={{ fontSize: 32, color: 'primary.main', mr: 1.5 }} />
          <Box>
            <Typography variant="h5" color="primary">
              My Payment Transactions
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Viewing payments strictly isolated to logged-in user #{user.userId} ({user.email})
            </Typography>
          </Box>
        </Box>
        <Button startIcon={<RefreshIcon />} onClick={fetchPayments} variant="outlined" size="small">
          Refresh
        </Button>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      ) : payments.length === 0 ? (
        <Card variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">No payment transactions recorded for this user yet.</Typography>
        </Card>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Payment ID</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Booking #</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Razorpay Order</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Amount</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Timestamp</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {p.razorpayPaymentId || `PAY-${p.id}`}
                    </Typography>
                  </TableCell>
                  <TableCell>#{p.bookingId}</TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {p.razorpayOrderId}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600} color="primary.main">
                      ₹{p.amountInPaise ? (p.amountInPaise / 100).toFixed(2) : '0.00'}
                    </Typography>
                  </TableCell>
                  <TableCell>{getStatusChip(p.status)}</TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {p.updatedAt ? new Date(p.updatedAt).toLocaleString() : 'N/A'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
