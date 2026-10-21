import React, { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button, Grid, Alert,
  CircularProgress, Chip, IconButton, Tooltip, ButtonBase, Divider
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { bookingApi } from '../../api';
import { navigate } from '../../router';
import { availabilityLabel, formatDate, isoDate, rupees } from './format';

/**
 * Search trains between two stations on a date, with availability and fare
 * per class. The search is in the URL (#/search/NDLS/MAS/2026-11-02), so
 * results can be bookmarked and Back returns to them.
 *
 * Departure and arrival times aren't shown: the schema doesn't store a
 * train's departure time yet (Team 2's area), only dates.
 */
export default function SearchPage({ params, canBook }) {
  const [from, to, date] = params;
  const [form, setForm] = useState({ from: from || '', to: to || '', date: date || isoDate(1) });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setForm({ from: from || '', to: to || '', date: date || isoDate(1) });
    if (!from || !to || !date) {
      setResults(null);
      return;
    }
    let current = true;
    setLoading(true);
    setError(null);
    bookingApi.search(from, to, date)
      .then((data) => current && setResults(data))
      .catch((err) => current && setError(err.message))
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [from, to, date]);

  const submit = (e) => {
    e.preventDefault();
    const code = (s) => s.trim().toUpperCase();
    navigate(`/search/${encodeURIComponent(code(form.from))}/${encodeURIComponent(code(form.to))}/${form.date}`);
  };

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto' }}>
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h5" component="h1" gutterBottom>Book a ticket</Typography>
          <form onSubmit={submit}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={4} md={3}>
                <TextField
                  fullWidth label="From (station code)" placeholder="NDLS" required
                  value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })}
                  inputProps={{ style: { textTransform: 'uppercase' } }}
                />
              </Grid>
              <Grid item xs={12} sm="auto" sx={{ textAlign: 'center' }}>
                <Tooltip title="Swap stations">
                  <IconButton aria-label="Swap stations" onClick={() => setForm({ ...form, from: form.to, to: form.from })}>
                    <SwapHorizIcon />
                  </IconButton>
                </Tooltip>
              </Grid>
              <Grid item xs={12} sm={4} md={3}>
                <TextField
                  fullWidth label="To (station code)" placeholder="MAS" required
                  value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })}
                  inputProps={{ style: { textTransform: 'uppercase' } }}
                />
              </Grid>
              <Grid item xs={12} sm={4} md={3}>
                <TextField
                  fullWidth label="Date of journey" type="date" required
                  value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                  InputLabelProps={{ shrink: true }} inputProps={{ min: isoDate(0) }}
                />
              </Grid>
              <Grid item xs={12} md>
                <Button fullWidth type="submit" variant="contained" size="large" startIcon={<SearchIcon />}>
                  Search
                </Button>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>

      {!canBook && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Only customer accounts can book. Staff can search, and look up any PNR.
        </Alert>
      )}
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {loading && <Box sx={{ textAlign: 'center', p: 4 }}><CircularProgress /></Box>}

      {!loading && results && results.length === 0 && (
        <Alert severity="info">
          No train leaves {from} for {to} on {formatDate(date)}. Try another date.
        </Alert>
      )}

      {!loading && results?.map((r) => (
        <Card key={r.runId} sx={{ mb: 2 }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 1, mb: 1 }}>
              <Typography variant="h6" component="h2">{r.trainName}</Typography>
              <Typography color="text.secondary">#{r.trainNo}</Typography>
              <Box sx={{ flexGrow: 1 }} />
              <Typography variant="body2" color="text.secondary">{Number(r.distanceKm)} km</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
              <StopLabel stop={r.from} />
              <ArrowForwardIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <StopLabel stop={r.to} />
            </Box>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={1.5}>
              {r.classes.map((c) => {
                const label = availabilityLabel(c);
                return (
                  <Grid item xs={6} sm={4} md={3} key={c.classCode}>
                    <ButtonBase
                      disabled={!canBook}
                      onClick={() => navigate(`/book/${r.runId}/${c.classCode}/${r.from.code}/${r.to.code}`)}
                      aria-label={`Book ${c.className} on ${r.trainName}`}
                      sx={{
                        width: '100%', display: 'block', textAlign: 'left', p: 1.5, borderRadius: 2,
                        border: '1px solid', borderColor: 'divider',
                        '&:hover, &.Mui-focusVisible': { borderColor: 'primary.light', bgcolor: 'action.hover' },
                      }}
                    >
                      <Typography fontWeight={600}>{c.classCode} · {c.className}</Typography>
                      <Chip label={label.text} color={label.color} size="small" sx={{ my: 0.75, fontWeight: 600 }} />
                      <Typography variant="body2">{rupees(c.fare)}</Typography>
                    </ButtonBase>
                  </Grid>
                );
              })}
            </Grid>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

function StopLabel({ stop }) {
  return (
    <Box>
      <Typography fontWeight={600}>{stop.name} ({stop.code})</Typography>
      <Typography variant="body2" color="text.secondary">{formatDate(stop.date)}</Typography>
    </Box>
  );
}
