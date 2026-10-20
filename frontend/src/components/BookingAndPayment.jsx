import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button, Grid,
  MenuItem, Select, FormControl, InputLabel, Alert, Divider,
  CircularProgress, Paper, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions
} from '@mui/material';
import TrainIcon from '@mui/icons-material/DirectionsTransit';
import PaymentIcon from '@mui/icons-material/Payment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { api } from '../api';

const CONCESSION_CATEGORIES = [
  { value: 'GENERAL', label: 'General (0% Concession)' },
  { value: 'SENIOR_CITIZEN', label: 'Senior Citizen (40% Concession)' },
  { value: 'STUDENT', label: 'Student (25% Concession)' },
  { value: 'CHILD', label: 'Child (50% Concession)' },
  { value: 'DIFFERENTLY_ABLED', label: 'Differently Abled (50% Concession)' },
  { value: 'ARMED_FORCES', label: 'Armed Forces (30% Concession)' },
];

export default function BookingAndPayment({ user }) {
  const [formData, setFormData] = useState({
    passengerName: 'Anant Garg',
    email: user.email || 'passenger@railways.gov.in',
    phone: '9876543210',
    fromStation: 'NDLS (New Delhi)',
    toStation: 'MMCT (Mumbai Central)',
    trainNumber: '12952 - Mumbai Tejas Rajdhani',
    departureTime: new Date(Date.now() + 48 * 3600 * 1000).toISOString().slice(0, 16),
    baseFare: 1500,
    concessionCategory: 'GENERAL'
  });

  const [previews, setPreviews] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successInfo, setSuccessInfo] = useState(null);

  useEffect(() => {
    api.getConcessionPreviews()
      .then(data => setPreviews(data))
      .catch(() => {});
  }, []);

  const discountPercent = previews[formData.concessionCategory] != null 
    ? previews[formData.concessionCategory] 
    : (formData.concessionCategory === 'SENIOR_CITIZEN' ? 40 : formData.concessionCategory === 'STUDENT' ? 25 : formData.concessionCategory === 'CHILD' ? 50 : formData.concessionCategory === 'DIFFERENTLY_ABLED' ? 50 : formData.concessionCategory === 'ARMED_FORCES' ? 30 : 0);

  const discountAmount = (formData.baseFare * discountPercent) / 100;
  const finalPayable = Math.max(1, formData.baseFare - discountAmount);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBookAndPay = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Create Booking in backend
      const bookingPayload = {
        passengerName: formData.passengerName,
        passengerEmail: formData.email,
        passengerPhone: formData.phone,
        trainNumber: formData.trainNumber,
        sourceStation: formData.fromStation,
        destinationStation: formData.toStation,
        departureTime: formData.departureTime + ':00',
        baseFare: formData.baseFare,
        concessionCategory: formData.concessionCategory
      };

      const booking = await api.createBooking(bookingPayload);

      // 2. Create Razorpay Order
      const order = await api.createPaymentOrder(booking.id);

      // 3. Launch Razorpay modal
      if (!window.Razorpay) {
        throw new Error('Razorpay SDK failed to load. Please check your internet connection.');
      }

      const options = {
        key: order.keyId,
        amount: order.amountInPaise,
        currency: order.currency,
        name: 'Indian Railways',
        description: `Train Booking #${booking.id} (${formData.trainNumber})`,
        order_id: order.orderId,
        prefill: {
          name: formData.passengerName,
          email: formData.email,
          contact: formData.phone,
        },
        theme: {
          color: '#1a365d',
        },
        handler: async function (response) {
          try {
            // 4. Verify Razorpay Signature
            const verifyRes = await api.verifyPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature
            });

            setSuccessInfo({
              bookingId: booking.id,
              paymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id,
              amount: finalPayable,
              train: formData.trainNumber
            });
          } catch (verErr) {
            setError('Payment signature verification failed: ' + verErr.message);
          }
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (resp) {
        setError('Payment Failed: ' + (resp.error.description || resp.error.reason));
        setLoading(false);
      });
      rzp.open();

    } catch (err) {
      setError(err.message || 'Failed to initiate payment');
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', mt: 3, mb: 5 }}>
      <Paper elevation={0} sx={{ p: 3, mb: 3, bgcolor: '#ffffff', borderRadius: 2, border: '1px solid #e2e8f0' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <TrainIcon sx={{ fontSize: 32, color: 'primary.main', mr: 1.5 }} />
          <Typography variant="h5" color="primary">
            IRCTC Train Ticket Booking & Payment (Module 4)
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Enter journey details, apply approved passenger concessions, and checkout securely via Razorpay test gateway.
        </Typography>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleBookAndPay}>
        <Grid container spacing={3}>
          {/* Passenger & Train Details */}
          <Grid item xs={12} md={7}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom color="primary.main">
                  Passenger & Journey Details
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Passenger Name"
                      name="passengerName"
                      value={formData.passengerName}
                      onChange={handleInputChange}
                      required
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      required
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Train Name / Number"
                      name="trainNumber"
                      value={formData.trainNumber}
                      onChange={handleInputChange}
                      required
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Origin Station"
                      name="fromStation"
                      value={formData.fromStation}
                      onChange={handleInputChange}
                      required
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Destination Station"
                      name="toStation"
                      value={formData.toStation}
                      onChange={handleInputChange}
                      required
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Departure Date & Time"
                      name="departureTime"
                      type="datetime-local"
                      value={formData.departureTime}
                      onChange={handleInputChange}
                      InputLabelProps={{ shrink: true }}
                      required
                      size="small"
                    />
                  </Grid>
                </Grid>

                <Typography variant="h6" sx={{ mt: 3, mb: 2 }} color="primary.main">
                  Concession Selection
                </Typography>
                <FormControl fullWidth size="small">
                  <InputLabel>Passenger Category</InputLabel>
                  <Select
                    name="concessionCategory"
                    value={formData.concessionCategory}
                    label="Passenger Category"
                    onChange={handleInputChange}
                  >
                    {CONCESSION_CATEGORIES.map(cat => (
                      <MenuItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {discountPercent > 0 && (
                  <Chip
                    label={`${discountPercent}% Railway Concession Applied`}
                    color="secondary"
                    size="small"
                    sx={{ mt: 1.5, fontWeight: 600 }}
                  />
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Fare Summary & Payment */}
          <Grid item xs={12} md={5}>
            <Card variant="outlined" sx={{ position: 'sticky', top: 20 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom color="primary.main">
                  Fare Breakdown
                </Typography>
                
                <Box sx={{ my: 2 }}>
                  <TextField
                    fullWidth
                    label="Base Ticket Fare (₹)"
                    name="baseFare"
                    type="number"
                    value={formData.baseFare}
                    onChange={handleInputChange}
                    inputProps={{ min: 10, step: 10 }}
                    size="small"
                    sx={{ mb: 2 }}
                  />
                </Box>

                <Divider sx={{ my: 1.5 }} />

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Base Fare:</Typography>
                  <Typography variant="body2">₹{formData.baseFare}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Concession ({discountPercent}%):
                  </Typography>
                  <Typography variant="body2" color="secondary.main">
                    - ₹{discountAmount.toFixed(2)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">IRCTC Gateway Fee:</Typography>
                  <Typography variant="body2" color="success.main">FREE (Test Mode)</Typography>
                </Box>

                <Divider sx={{ my: 1.5 }} />

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                  <Typography variant="h6">Total Payable:</Typography>
                  <Typography variant="h6" color="primary.main">
                    ₹{finalPayable.toFixed(2)}
                  </Typography>
                </Box>

                <Button
                  fullWidth
                  variant="contained"
                  color="secondary"
                  size="large"
                  startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <PaymentIcon />}
                  type="submit"
                  disabled={loading}
                >
                  {loading ? 'Processing...' : `Pay ₹${finalPayable.toFixed(2)}`}
                </Button>

                <Typography variant="caption" display="block" align="center" sx={{ mt: 2, color: 'text.secondary' }}>
                  🔒 Secured with Razorpay HMAC SHA256 Signature Verification
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </form>

      {/* Payment Success Dialog */}
      <Dialog open={!!successInfo} onClose={() => setSuccessInfo(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ textAlign: 'center', pt: 3 }}>
          <CheckCircleIcon sx={{ fontSize: 60, color: 'success.main', mb: 1 }} />
          <Typography variant="h5">Payment Successful!</Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ bgcolor: '#f8fafc', p: 2.5, borderRadius: 2, border: '1px solid #e2e8f0', mt: 1 }}>
            <Typography variant="subtitle2" color="text.secondary">Booking ID:</Typography>
            <Typography variant="body1" fontWeight={600} gutterBottom>#{successInfo?.bookingId}</Typography>

            <Typography variant="subtitle2" color="text.secondary">Razorpay Payment ID:</Typography>
            <Typography variant="body1" fontWeight={600} gutterBottom>{successInfo?.paymentId}</Typography>

            <Typography variant="subtitle2" color="text.secondary">Amount Paid:</Typography>
            <Typography variant="h6" color="primary.main" gutterBottom>₹{successInfo?.amount}</Typography>

            <Typography variant="subtitle2" color="text.secondary">Train:</Typography>
            <Typography variant="body2">{successInfo?.train}</Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ pb: 3, px: 3 }}>
          <Button fullWidth variant="contained" onClick={() => setSuccessInfo(null)}>
            Done
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
