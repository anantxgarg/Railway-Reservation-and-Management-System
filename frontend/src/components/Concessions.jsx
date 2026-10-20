import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button, Grid,
  Alert, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, Chip, CircularProgress, MenuItem, Select,
  FormControl, InputLabel, Dialog, DialogTitle, DialogContent,
  DialogActions
} from '@mui/material';
import CardMembershipIcon from '@mui/icons-material/CardMembership';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { api } from '../api';

const CONCESSION_CATEGORIES = [
  { value: 'STUDENT', label: 'Student (25%)' },
  { value: 'SENIOR_CITIZEN', label: 'Senior Citizen (40%)' },
  { value: 'DIFFERENTLY_ABLED', label: 'Differently Abled (50%)' },
  { value: 'ARMED_FORCES', label: 'Armed Forces (30%)' },
  { value: 'CHILD', label: 'Child (50%)' },
];

export default function Concessions({ user }) {
  const isStaffOrAdmin = user.role === 'STAFF' || user.role === 'ADMIN';

  // Customer state
  const [form, setForm] = useState({
    bookingId: '',
    category: 'STUDENT',
    idCardType: 'STUDENT_ID',
    idCardNumber: 'STU-2026-987',
    documentReferenceUrl: 'https://docs.railways.gov.in/proofs/student-id.pdf'
  });
  const [submitting, setSubmitting] = useState(false);
  const [myConcessions, setMyConcessions] = useState([]);
  const [loadingMy, setLoadingMy] = useState(false);

  // Staff review state
  const [pendingList, setPendingList] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [reviewAction, setReviewAction] = useState('APPROVED');
  const [reviewing, setReviewing] = useState(false);

  const [alert, setAlert] = useState(null);

  const loadData = async () => {
    if (isStaffOrAdmin) {
      setLoadingPending(true);
      try {
        const data = await api.getPendingConcessions();
        setPendingList(data || []);
      } catch (err) {
        setAlert({ type: 'error', msg: 'Failed to load pending concessions: ' + err.message });
      } finally {
        setLoadingPending(false);
      }
    } else {
      setLoadingMy(true);
      try {
        const data = await api.getMyConcessions();
        setMyConcessions(data || []);
      } catch (err) {
        // quiet
      } finally {
        setLoadingMy(false);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleApply = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setAlert(null);
    try {
      await api.applyConcession({
        bookingId: Number(form.bookingId),
        category: form.category,
        idCardType: form.idCardType,
        idCardNumber: form.idCardNumber,
        documentReferenceUrl: form.documentReferenceUrl
      });
      setAlert({ type: 'success', msg: 'Concession application submitted successfully! Staff verification pending.' });
      setForm({ ...form, bookingId: '' });
      loadData();
    } catch (err) {
      setAlert({ type: 'error', msg: err.message || 'Failed to submit concession application' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewSubmit = async () => {
    if (!selectedApp) return;
    setReviewing(true);
    try {
      await api.reviewConcession(selectedApp.id, {
        status: reviewAction,
        remarks: reviewRemarks || (reviewAction === 'APPROVED' ? 'Approved by officer' : 'Invalid document')
      });
      setAlert({ type: 'success', msg: `Application #${selectedApp.id} ${reviewAction.toLowerCase()} successfully.` });
      setSelectedApp(null);
      setReviewRemarks('');
      loadData();
    } catch (err) {
      setAlert({ type: 'error', msg: err.message || 'Review action failed' });
    } finally {
      setReviewing(false);
    }
  };

  const getStatusChip = (status) => {
    if (status === 'APPROVED') return <Chip label="APPROVED" color="success" size="small" sx={{ fontWeight: 600 }} />;
    if (status === 'REJECTED') return <Chip label="REJECTED" color="error" size="small" sx={{ fontWeight: 600 }} />;
    return <Chip label="PENDING REVIEW" color="warning" size="small" sx={{ fontWeight: 600 }} />;
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', mt: 3, mb: 5 }}>
      <Paper elevation={0} sx={{ p: 3, mb: 3, bgcolor: '#ffffff', borderRadius: 2, border: '1px solid #e2e8f0' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <CardMembershipIcon sx={{ fontSize: 32, color: 'primary.main', mr: 1.5 }} />
          <Typography variant="h5" color="primary">
            Concession Application & Verification Portal
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          {isStaffOrAdmin 
            ? 'Officer Dashboard: Inspect submitted ID credentials and approve or reject ticket fare concessions.'
            : 'Passenger Portal: Apply for Student, Senior Citizen, or Armed Forces concessions with document proof.'}
        </Typography>
      </Paper>

      {alert && (
        <Alert severity={alert.type} sx={{ mb: 3 }} onClose={() => setAlert(null)}>
          {alert.msg}
        </Alert>
      )}

      {/* Staff View */}
      {isStaffOrAdmin ? (
        <Box>
          <Typography variant="h6" sx={{ mb: 2 }} color="primary.main">
            Pending Concession Applications ({pendingList.length})
          </Typography>
          {loadingPending ? (
            <CircularProgress />
          ) : pendingList.length === 0 ? (
            <Card variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">All concession requests have been verified. No pending tasks.</Typography>
            </Card>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>App #</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Booking #</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Category</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>ID Proof</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Document URL</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pendingList.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell>#{app.id}</TableCell>
                      <TableCell>#{app.bookingId}</TableCell>
                      <TableCell>
                        <Chip label={app.category} color="primary" variant="outlined" size="small" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{app.idCardType}</Typography>
                        <Typography variant="caption" color="text.secondary">{app.idCardNumber}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ wordBreak: 'break-all' }}>
                          {app.documentReferenceUrl}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          variant="contained"
                          color="primary"
                          size="small"
                          onClick={() => {
                            setSelectedApp(app);
                            setReviewAction('APPROVED');
                          }}
                        >
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Review Dialog */}
          <Dialog open={!!selectedApp} onClose={() => setSelectedApp(null)} maxWidth="xs" fullWidth>
            <DialogTitle>Review Concession #{selectedApp?.id}</DialogTitle>
            <DialogContent>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Category: <strong>{selectedApp?.category}</strong> (Booking #{selectedApp?.bookingId})
              </Typography>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Decision</InputLabel>
                <Select
                  value={reviewAction}
                  label="Decision"
                  onChange={(e) => setReviewAction(e.target.value)}
                >
                  <MenuItem value="APPROVED">APPROVE</MenuItem>
                  <MenuItem value="REJECTED">REJECT</MenuItem>
                </Select>
              </FormControl>
              <TextField
                fullWidth
                label="Staff Remarks"
                value={reviewRemarks}
                onChange={(e) => setReviewRemarks(e.target.value)}
                placeholder="e.g. Valid university ID card verified"
                size="small"
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedApp(null)}>Cancel</Button>
              <Button
                variant="contained"
                color={reviewAction === 'APPROVED' ? 'success' : 'error'}
                onClick={handleReviewSubmit}
                disabled={reviewing}
              >
                {reviewing ? 'Saving...' : `Confirm ${reviewAction}`}
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      ) : (
        /* Customer View */
        <Grid container spacing={3}>
          <Grid item xs={12} md={5}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom color="primary.main">
                  Apply for Concession
                </Typography>
                <form onSubmit={handleApply}>
                  <TextField
                    fullWidth
                    label="Booking ID / PNR"
                    value={form.bookingId}
                    onChange={(e) => setForm({ ...form, bookingId: e.target.value })}
                    required
                    type="number"
                    size="small"
                    sx={{ mb: 2 }}
                  />
                  <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                    <InputLabel>Concession Category</InputLabel>
                    <Select
                      value={form.category}
                      label="Concession Category"
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                    >
                      {CONCESSION_CATEGORIES.map(c => (
                        <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    fullWidth
                    label="ID Document Type"
                    value={form.idCardType}
                    onChange={(e) => setForm({ ...form, idCardType: e.target.value })}
                    placeholder="e.g. STUDENT_ID, AADHAAR, DEFENCE_CARD"
                    required
                    size="small"
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    label="ID Card Number"
                    value={form.idCardNumber}
                    onChange={(e) => setForm({ ...form, idCardNumber: e.target.value })}
                    required
                    size="small"
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    label="Document Reference URL"
                    value={form.documentReferenceUrl}
                    onChange={(e) => setForm({ ...form, documentReferenceUrl: e.target.value })}
                    required
                    size="small"
                    sx={{ mb: 3 }}
                  />
                  <Button
                    fullWidth
                    variant="contained"
                    type="submit"
                    disabled={submitting}
                    startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : <VerifiedUserIcon />}
                  >
                    {submitting ? 'Submitting...' : 'Submit Application'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={7}>
            <Typography variant="h6" sx={{ mb: 2 }} color="primary.main">
              My Concession Applications
            </Typography>
            {loadingMy ? (
              <CircularProgress />
            ) : myConcessions.length === 0 ? (
              <Card variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">No concession applications submitted yet.</Typography>
              </Card>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f8fafc' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>App #</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Booking #</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Category</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Remarks</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {myConcessions.map((app) => (
                      <TableRow key={app.id}>
                        <TableCell>#{app.id}</TableCell>
                        <TableCell>#{app.bookingId}</TableCell>
                        <TableCell>{app.category}</TableCell>
                        <TableCell>{getStatusChip(app.status)}</TableCell>
                        <TableCell>
                          <Typography variant="caption">{app.remarks || '-'}</Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
