import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow,
  Chip, Alert, Button, Link
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReceiptIcon from '@mui/icons-material/ReceiptLong';
import { api } from '../api';
import { PageHeader, GlassSection, EmptyState, LoadingCard, Mono } from './ui';

/**
 * The customer's payment transactions: one row per payment with its gateway
 * ids, booking PNR, amount and status. The table scrolls sideways on narrow
 * screens.
 */
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
      return <Chip label="PAID" color="success" size="small" />;
    } else if (status === 'CREATED') {
      return <Chip label="PENDING" color="warning" size="small" />;
    } else if (status === 'PARTIALLY_REFUNDED') {
      return <Chip label="PARTLY REFUNDED" color="info" size="small" />;
    } else {
      return <Chip label={status || 'UNKNOWN'} color="default" size="small" />;
    }
  };

  return (
    <Box>
      <PageHeader
        tag="Payments"
        title="My payments"
        subtitle={`Payments made by ${user.email}`}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <LoadingCard text="Loading payments…" />
      ) : payments.length === 0 ? (
        <EmptyState
          icon={<ReceiptIcon />}
          title="No payments yet"
          text="No payment transactions recorded for this account yet."
        />
      ) : (
        <GlassSection
          title="Payment transactions"
          icon={<ReceiptIcon />}
          padding={0}
          actions={
            <Button startIcon={<RefreshIcon />} onClick={fetchPayments} variant="outlined" size="small">
              Refresh
            </Button>
          }
        >
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table sx={{ minWidth: 640 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Payment ID</TableCell>
                  <TableCell>PNR</TableCell>
                  <TableCell>Gateway Order</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell>
                      <Typography variant="body2" component="div">
                        <Mono sx={{ color: (t) => t.app.accent }}>{p.razorpayPaymentId || `PAY-${p.id}`}</Mono>
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Link component={RouterLink} to={`/pnr/${p.pnr}`} underline="hover">
                        <Mono>{p.pnr}</Mono>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" component="div" color="text.secondary">
                        <Mono sx={{ fontWeight: 500 }}>{p.razorpayOrderId}</Mono>
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 800, color: 'success.main' }}>
                        ₹{Number(p.amount).toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell>{getStatusChip(p.status)}</TableCell>
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
