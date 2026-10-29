import React, { useState, useEffect } from 'react';
import {
  Box, Typography, TextField, Button, Grid,
  Alert, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Chip, CircularProgress, MenuItem, Select,
  FormControl, InputLabel, Dialog, DialogTitle, DialogContent,
  DialogActions
} from '@mui/material';
import CardMembershipIcon from '@mui/icons-material/CardMembership';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import { api, bookingApi } from '../api';
import { concessionLabel, useConcessionRules } from '../features/booking/concessions';
import { PageHeader, GlassSection, EmptyState, LoadingCard, StatPill, Mono } from './ui';

// A suggestion for the document type field, by concession
const ID_TYPES = {
  STUDENT: 'STUDENT_ID',
  SENIOR_CITIZEN: 'AADHAAR',
  CHILD: 'BIRTH_CERTIFICATE',
  DIFFERENTLY_ABLED: 'DISABILITY_CERTIFICATE',
  ARMED_FORCES: 'DEFENCE_CARD',
};

/**
 * Concessions are chosen per passenger when booking (the shared
 * concession_rule table). Here customers send the documents for them, and
 * staff approve or reject them.
 */

export default function Concessions({ user }) {
  const isStaffOrAdmin = user.role === 'STAFF' || user.role === 'ADMIN';

  // Customer state
  const [form, setForm] = useState({
    pnr: '',
    passengerId: '',
    idCardType: '',
    idCardNumber: '',
    documentReferenceUrl: ''
  });
  const rules = useConcessionRules();
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
      .then((b) => current && setPassengers(b.passengers.filter((p) => p.status !== 'CANCELLED' && p.concessionId != null)))
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
        idCardType: form.idCardType,
        idCardNumber: form.idCardNumber,
        documentReferenceUrl: form.documentReferenceUrl
      });
      setAlert({ type: 'success', msg: 'Concession application submitted successfully! Verification pending.' });
      setForm({ ...form, pnr: '', passengerId: '', idCardNumber: '', documentReferenceUrl: '' });
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
    if (status === 'APPROVED') return <Chip label="APPROVED" color="success" size="small" />;
    if (status === 'REJECTED') return <Chip label="REJECTED" color="error" size="small" />;
    return <Chip label="PENDING REVIEW" color="warning" size="small" />;
  };

  return (
    <Box>
      <PageHeader
        tag="Concessions"
        title={isStaffOrAdmin ? 'Concession verification' : 'Concession applications'}
        subtitle={isStaffOrAdmin
          ? 'Officer Dashboard: Inspect submitted ID credentials and approve or reject ticket fare concessions.'
          : 'Send the documents for the concessions your passengers were booked with (student, senior citizen, armed forces, ...). Staff check them.'}
      />

      {alert && (
        <Alert severity={alert.type} sx={{ mb: 3 }} onClose={() => setAlert(null)}>
          {alert.msg}
        </Alert>
      )}

      {/* Staff View */}
      {isStaffOrAdmin ? (
        <Box>
          {loadingPending ? (
            <LoadingCard text="Loading applications…" />
          ) : pendingList.length === 0 ? (
            <EmptyState
              icon={<VerifiedUserIcon />}
              title="Pending Concession Applications (0)"
              text="All concession requests have been verified. No pending tasks."
            />
          ) : (
            <GlassSection
              title={`Pending Concession Applications (${pendingList.length})`}
              icon={<CardMembershipIcon />}
              padding={0}
            >
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 760 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>App #</TableCell>
                      <TableCell>PNR / Passenger</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell>ID Proof</TableCell>
                      <TableCell>Document URL</TableCell>
                      <TableCell align="center">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pendingList.map((app) => (
                      <TableRow key={app.id} hover>
                        <TableCell><Mono>#{app.id}</Mono></TableCell>
                        <TableCell>
                          <Mono>{app.pnr}</Mono>
                          <Typography variant="caption" display="block" color="text.secondary">{app.passengerName}</Typography>
                        </TableCell>
                        <TableCell>
                          <StatPill icon={<CardMembershipIcon />} color="secondary">{app.category}</StatPill>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{app.idCardType}</Typography>
                          <Typography variant="caption" color="text.secondary">{app.idCardNumber}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ wordBreak: 'break-all', color: (t) => t.app.highlight, fontWeight: 600 }}>
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
            </GlassSection>
          )}

          {/* Review Dialog */}
          <Dialog
            open={!!selectedApp}
            onClose={() => setSelectedApp(null)}
            maxWidth="xs"
            fullWidth
          >
            <DialogTitle>Review Concession #{selectedApp?.id}</DialogTitle>
            <DialogContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Category: <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>{selectedApp?.category}</Box> for {selectedApp?.passengerName} (PNR {selectedApp?.pnr})
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
              <Button color="inherit" onClick={() => setSelectedApp(null)}>Cancel</Button>
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
            <GlassSection title="Apply for Concession" icon={<VerifiedUserIcon />}>
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
                    onChange={(e) => {
                      const p = passengers.find((x) => x.passengerId === e.target.value);
                      const rule = rules.find((r) => r.concessionId === p?.concessionId);
                      setForm({ ...form, passengerId: e.target.value, idCardType: ID_TYPES[rule?.category] || form.idCardType });
                    }}
                  >
                    {passengers.map((p) => {
                      const rule = rules.find((r) => r.concessionId === p.concessionId);
                      return (
                        <MenuItem key={p.passengerId} value={p.passengerId}>
                          {p.passengerNo}. {p.name} ({p.age}) · {rule ? concessionLabel(rule) : 'concession'}
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
                {form.pnr.length === 10 && !pnrError && !passengers.length && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Nobody on this booking has a concession. Concessions are chosen per passenger when booking.
                  </Typography>
                )}
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
            </GlassSection>
          </Grid>

          <Grid item xs={12} md={7}>
            {loadingMy ? (
              <LoadingCard text="Loading applications…" />
            ) : myConcessions.length === 0 ? (
              <EmptyState
                icon={<CardMembershipIcon />}
                title="My Concession Applications"
                text="No concession applications submitted yet."
              />
            ) : (
              <GlassSection title="My Concession Applications" icon={<CardMembershipIcon />} padding={0}>
                <TableContainer sx={{ overflowX: 'auto' }}>
                  <Table size="small" sx={{ minWidth: 520 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>App #</TableCell>
                        <TableCell>PNR / Passenger</TableCell>
                        <TableCell>Category</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Remarks</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {myConcessions.map((app) => (
                        <TableRow key={app.id} hover>
                          <TableCell><Mono>#{app.id}</Mono></TableCell>
                          <TableCell>
                            <Mono>{app.pnr}</Mono>
                            <Typography variant="caption" display="block" color="text.secondary">{app.passengerName}</Typography>
                          </TableCell>
                          <TableCell>
                            <StatPill icon={<CardMembershipIcon />} color="secondary">{app.category}</StatPill>
                          </TableCell>
                          <TableCell>{getStatusChip(app.status)}</TableCell>
                          <TableCell sx={{ color: 'text.secondary' }}>
                            <Typography variant="caption">{app.remarks || '-'}</Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </GlassSection>
            )}
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
