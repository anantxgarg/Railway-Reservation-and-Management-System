import React, { useState, useEffect } from 'react';
import {
  Box, Card, Typography, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper,
  Chip, CircularProgress, Alert, Button, Link
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
    } else if (status === 'PARTIALLY_REFUNDED') {
      return <Chip label="PARTLY REFUNDED" color="info" size="small" sx={{ fontWeight: 600 }} />;
    } else {
      return <Chip label={status || 'UNKNOWN'} color="default" size="small" sx={{ fontWeight: 600 }} />;
    }
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', mt: 1, mb: 5 }}>
      <Paper elevation={0} sx={{ p: 3, mb: 3, bgcolor: '#111a2e', borderRadius: 3, border: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <ReceiptIcon sx={{ fontSize: 32, color: 'primary.light', mr: 1.5 }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#f8fafc' }}>
              My Payment Transactions
            </Typography>
            <Typography variant="body2" sx={{ color: '#94a3b8' }}>
              Payments made by {user.email}
            </Typography>
          </Box>
        </Box>
        <Button startIcon={<RefreshIcon />} onClick={fetchPayments} variant="outlined" size="small" sx={{ borderColor: '#22324e', color: '#f8fafc' }}>
          Refresh
        </Button>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3, bgcolor: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5' }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      ) : payments.length === 0 ? (
        <Card variant="outlined" sx={{ p: 4, textAlign: 'center', bgcolor: '#111a2e', borderColor: '#1e293b' }}>
          <Typography sx={{ color: '#94a3b8' }}>No payment transactions recorded for this account yet.</Typography>
        </Card>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ bgcolor: '#111a2e', borderColor: '#1e293b' }}>
          <Table>
            <TableHead sx={{ bgcolor: '#0b111e' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, color: '#94a3b8' }}>Payment ID</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#94a3b8' }}>PNR</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#94a3b8' }}>Gateway Order</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#94a3b8' }}>Amount</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#94a3b8' }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id} hover sx={{ '&:hover': { bgcolor: '#162238' } }}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600} sx={{ color: '#38bdf8' }}>
                      {p.razorpayPaymentId || `PAY-${p.id}`}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Link href={`#/pnr/${p.pnr}`} underline="hover" sx={{ color: '#f8fafc' }}>{p.pnr}</Link>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ color: '#64748b' }}>
                      {p.razorpayOrderId}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600} sx={{ color: '#4ade80' }}>
                      ₹{Number(p.amount).toFixed(2)}
                    </Typography>
                  </TableCell>
                  <TableCell>{getStatusChip(p.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
