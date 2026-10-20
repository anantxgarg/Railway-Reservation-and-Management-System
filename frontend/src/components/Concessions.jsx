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
import { api, bookingApi } from '../api';

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
    pnr: '',
    passengerId: '',
    category: 'STUDENT',
    idCardType: 'STUDENT_ID',
    idCardNumber: 'STU-2026-987',
    documentReferenceUrl: 'https://docs.railways.gov.in/proofs/student-id.pdf'
  });
  const [submitting, setSubmitting] = useState(false);
  // passengers of the PNR being applied for, from the booking service
  const [passengers, setPassengers] = useState([]);
  const [pnrError, setPnrError] = useState(null);
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

  useEffect(() => {
    setPassengers([]);
    setPnrError(null);
    setForm((f) => ({ ...f, passengerId: '' }));
    if (form.pnr.length !== 10) return undefined;
    let current = true;
    bookingApi.get(form.pnr)
      .then((b) => current && setPassengers(b.passengers.filter((p) => p.status !== 'CANCELLED')))
      .catch((err) => current && setPnrError(err.message));
    return () => {
      current = false;
    };
  }, [form.pnr]);

  const handleApply = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setAlert(null);
    try {
      await api.applyConcession({
        pnr: form.pnr,
        passengerId: Number(form.passengerId),
        category: form.category,
        idCardType: form.idCardType,
        idCardNumber: form.idCardNumber,
        documentReferenceUrl: form.documentReferenceUrl
      });
      setAlert({ type: 'success', msg: 'Concession application submitted successfully! Verification pending.' });
      setForm({ ...form, pnr: '', passengerId: '' });
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
    <Box sx={{ maxWidth: 1000, mx: 'auto', mt: 1, mb: 5 }}>
      <Paper elevation={0} sx={{ p: 3, mb: 3, bgcolor: '#111a2e', borderRadius: 3, border: '1px solid #1e293b' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <CardMembershipIcon sx={{ fontSize: 32, color: 'primary.light', mr: 1.5 }} />
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#f8fafc' }}>
            Concession Application & Verification Portal
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: '#94a3b8' }}>
          {isStaffOrAdmin 
            ? 'Officer Dashboard: Inspect submitted ID credentials and approve or reject ticket fare concessions.'
            : 'Passenger Portal: Apply for Student, Senior Citizen, or Armed Forces concessions with document proof.'}
        </Typography>
      </Paper>

      {alert && (
        <Alert severity={alert.type} sx={{ mb: 3, bgcolor: alert.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(74, 222, 128, 0.1)' }} onClose={() => setAlert(null)}>
          {alert.msg}
        </Alert>
      )}

      {/* Staff View */}
      {isStaffOrAdmin ? (
        <Box>
          <Typography variant="h6" sx={{ mb: 2, color: '#f8fafc', fontWeight: 600 }}>
            Pending Concession Applications ({pendingList.length})
          </Typography>
          {loadingPending ? (
            <CircularProgress />
          ) : pendingList.length === 0 ? (
            <Card variant="outlined" sx={{ p: 4, textAlign: 'center', bgcolor: '#111a2e', borderColor: '#1e293b' }}>
              <Typography sx={{ color: '#94a3b8' }}>All concession requests have been verified. No pending tasks.</Typography>
            </Card>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ bgcolor: '#111a2e', borderColor: '#1e293b' }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#0b111e' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, color: '#94a3b8' }}>App #</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#94a3b8' }}>PNR / Passenger</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#94a3b8' }}>Category</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#94a3b8' }}>ID Proof</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#94a3b8' }}>Document URL</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#94a3b8' }} align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pendingList.map((app) => (
                    <TableRow key={app.id} hover sx={{ '&:hover': { bgcolor: '#162238' } }}>
                      <TableCell sx={{ color: '#f8fafc' }}>#{app.id}</TableCell>
                      <TableCell sx={{ color: '#f8fafc' }}>
                        {app.pnr}
                        <Typography variant="caption" display="block" sx={{ color: '#64748b' }}>{app.passengerName}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={app.category} color="primary" variant="outlined" size="small" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: '#f8fafc' }}>{app.idCardType}</Typography>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>{app.idCardNumber}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ wordBreak: 'break-all', color: '#38bdf8' }}>
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
          <Dialog
            open={!!selectedApp}
            onClose={() => setSelectedApp(null)}
            maxWidth="xs"
            fullWidth
            PaperProps={{ sx: { bgcolor: '#111a2e', borderRadius: 3, border: '1px solid #1e293b' } }}
          >
            <DialogTitle sx={{ color: '#f8fafc' }}>Review Concession #{selectedApp?.id}</DialogTitle>
            <DialogContent>
              <Typography variant="body2" sx={{ mb: 2, color: '#94a3b8' }}>
                Category: <strong style={{ color: '#f8fafc' }}>{selectedApp?.category}</strong> for {selectedApp?.passengerName} (PNR {selectedApp?.pnr})
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
            <DialogActions sx={{ pb: 2.5, px: 3 }}>
              <Button onClick={() => setSelectedApp(null)} sx={{ color: '#94a3b8' }}>Cancel</Button>
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
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom sx={{ color: '#f8fafc', fontWeight: 600 }}>
                  Apply for Concession
                </Typography>
                <form onSubmit={handleApply}>
                  <TextField
                    fullWidth
                    label="PNR"
                    value={form.pnr}
                    onChange={(e) => setForm({ ...form, pnr: e.target.value.replace(/\D/g, '') })}
                    required
                    inputProps={{ inputMode: 'numeric', maxLength: 10 }}
                    error={!!pnrError}
                    helperText={pnrError}
                    size="small"
                    sx={{ mb: 2 }}
                  />
                  <FormControl fullWidth size="small" sx={{ mb: 2 }} disabled={!passengers.length} required>
                    <InputLabel id="concession-passenger-label">Passenger</InputLabel>
                    <Select
                      labelId="concession-passenger-label"
                      value={form.passengerId}
                      label="Passenger"
                      onChange={(e) => setForm({ ...form, passengerId: e.target.value })}
                    >
                      {passengers.map((p) => (
                        <MenuItem key={p.passengerId} value={p.passengerId}>{p.passengerNo}. {p.name} ({p.age})</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                    <InputLabel id="concession-category-label">Concession Category</InputLabel>
                    <Select
                      labelId="concession-category-label"
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
                    disabled={submitting || !form.passengerId}
                    startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : <VerifiedUserIcon />}
                    sx={{ py: 1.2 }}
                  >
                    {submitting ? 'Submitting...' : 'Submit Application'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={7}>
            <Typography variant="h6" sx={{ mb: 2, color: '#f8fafc', fontWeight: 600 }}>
              My Concession Applications
            </Typography>
            {loadingMy ? (
              <CircularProgress />
            ) : myConcessions.length === 0 ? (
              <Card variant="outlined" sx={{ p: 4, textAlign: 'center', bgcolor: '#111a2e', borderColor: '#1e293b' }}>
                <Typography sx={{ color: '#94a3b8' }}>No concession applications submitted yet.</Typography>
              </Card>
            ) : (
              <TableContainer component={Paper} variant="outlined" sx={{ bgcolor: '#111a2e', borderColor: '#1e293b' }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#0b111e' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, color: '#94a3b8' }}>App #</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#94a3b8' }}>PNR / Passenger</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#94a3b8' }}>Category</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#94a3b8' }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#94a3b8' }}>Remarks</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {myConcessions.map((app) => (
                      <TableRow key={app.id} hover sx={{ '&:hover': { bgcolor: '#162238' } }}>
                        <TableCell sx={{ color: '#f8fafc' }}>#{app.id}</TableCell>
                        <TableCell sx={{ color: '#f8fafc' }}>
                          {app.pnr}
                          <Typography variant="caption" display="block" sx={{ color: '#64748b' }}>{app.passengerName}</Typography>
                        </TableCell>
                        <TableCell sx={{ color: '#38bdf8' }}>{app.category}</TableCell>
                        <TableCell>{getStatusChip(app.status)}</TableCell>
                        <TableCell sx={{ color: '#94a3b8' }}>
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
