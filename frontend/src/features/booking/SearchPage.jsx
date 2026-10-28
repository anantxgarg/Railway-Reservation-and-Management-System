import React, { useEffect, useState } from 'react';
import {
  Box, Typography, TextField, Button, Alert, Chip, IconButton, Tooltip, ButtonBase,
  LinearProgress, Autocomplete
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import TrainIcon from '@mui/icons-material/Train';
import RouteIcon from '@mui/icons-material/AltRoute';
import { bookingApi, networkApi } from '../../api';
import { navigate } from '../../router';
import { GlassSection, IconTile, LoadingCard, Mono, PageHeader, StatPill } from '../../components/ui';
import { availabilityLabel, formatDate, isoDate, rupees } from './format';

/**
 * Search trains between two stations on a date, with availability and fare
 * per class. The search is in the URL (/search/NDLS/MAS/2026-11-02), so
 * results can be bookmarked and Back returns to them.
 *
 * Stations are picked from Team 2's list (train-service); codes can still be
 * typed if it is down. Times are Team 2's timetable (route departure + stop
 * offsets).
 */
export default function SearchPage({ params, canBook }) {
  const [from, to, date] = params;
  const [form, setForm] = useState({ from: from || '', to: to || '', date: date || isoDate(1) });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stations, setStations] = useState([]);

  useEffect(() => {
    networkApi.stations().then(setStations).catch(() => setStations([]));
  }, []);

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
      <PageHeader
        tag="Reservations"
        title="Book a ticket"
        subtitle="Search trains between two stations, compare availability and fares, and pick a class to book."
      />

      <GlassSection sx={{ mb: 3 }} contentSx={{ p: { xs: 2.5, sm: 3.5 } }}>
        <form onSubmit={submit}>
          <Box
            sx={{
              display: 'grid', gap: 2, alignItems: 'center',
              gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto minmax(0, 1fr) minmax(0, 0.9fr)' },
            }}
          >
            <StationField
              label="From" placeholder="NDLS" stations={stations}
              value={form.from} onChange={(v) => setForm((f) => ({ ...f, from: v }))}
            />
            <Box sx={{ textAlign: 'center' }}>
              <Tooltip title="Swap stations">
                <IconButton
                  aria-label="Swap stations"
                  onClick={() => setForm({ ...form, from: form.to, to: form.from })}
                  sx={{
                    border: (t) => `1px solid ${t.app.divider}`, bgcolor: (t) => t.app.glassNested,
                    transform: { xs: 'rotate(90deg)', md: 'none' },
                  }}
                >
                  <SwapHorizIcon />
                </IconButton>
              </Tooltip>
            </Box>
            <StationField
              label="To" placeholder="MAS" stations={stations}
              value={form.to} onChange={(v) => setForm((f) => ({ ...f, to: v }))}
            />
            <TextField
              fullWidth label="Date of journey" type="date" required
              value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
              InputLabelProps={{ shrink: true }} inputProps={{ min: isoDate(0) }}
            />
          </Box>
          <Button fullWidth type="submit" variant="contained" size="large" startIcon={<SearchIcon />} sx={{ mt: 3 }}>
            Search trains
          </Button>
        </form>
      </GlassSection>

      {!canBook && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Only customer accounts can book. Staff can search, and look up any PNR.
        </Alert>
      )}
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {loading && <LoadingCard text="Searching trains…" />}

      {!loading && results && results.length === 0 && (
        <Alert severity="info">
          No train leaves {from} for {to} on {formatDate(date)}. Try another date.
        </Alert>
      )}

      {!loading && results?.map((r) => (
        <GlassSection
          key={r.runId}
          sx={{
            mb: 2.5,
            transition: 'transform 0.25s ease, box-shadow 0.25s ease',
            '&:hover': { transform: 'translateY(-3px)', boxShadow: (t) => t.app.glassShadowHover },
          }}
        >
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
            <IconTile size={42}><TrainIcon /></IconTile>
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography variant="h6" component="h2" sx={{ lineHeight: 1.25 }}>{r.trainName}</Typography>
              <Typography variant="body2" color="text.secondary">Train <Mono>#{r.trainNo}</Mono></Typography>
            </Box>
            <StatPill icon={<RouteIcon />}>{Number(r.distanceKm)} km</StatPill>
          </Box>

          <Box
            sx={{
              display: 'grid', alignItems: 'center', gap: { xs: 1, sm: 2 }, mb: 2.5,
              gridTemplateColumns: 'minmax(0, 1fr) minmax(40px, 0.5fr) minmax(0, 1fr)',
            }}
          >
            <StopLabel stop={r.from} time={r.from.departure} />
            <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary' }} aria-hidden="true">
              <Box sx={{ flexGrow: 1, height: 2, borderRadius: 1, bgcolor: (t) => t.app.divider }} />
              <ArrowForwardIcon fontSize="small" sx={{ ml: -0.5 }} />
            </Box>
            <StopLabel stop={r.to} time={r.to.arrival} align="right" />
          </Box>

          <Box
            sx={{
              display: 'grid', gap: 1.5,
              gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
            }}
          >
            {r.classes.map((c) => {
              const label = availabilityLabel(c);
              return (
                <ButtonBase
                  key={c.classCode}
                  disabled={!canBook}
                  onClick={() => navigate(`/book/${r.runId}/${c.classCode}/${r.from.code}/${r.to.code}`)}
                  aria-label={`Book ${c.className} on ${r.trainName}`}
                  sx={{
                    display: 'block', textAlign: 'left', p: 1.5, borderRadius: '12px',
                    bgcolor: (t) => t.app.glassNested,
                    border: (t) => `1px solid ${t.app.divider}`,
                    transition: 'border-color 0.2s ease, background-color 0.2s ease, transform 0.2s ease',
                    '&:hover:not(.Mui-disabled), &.Mui-focusVisible': {
                      borderColor: (t) => t.app.accent, bgcolor: (t) => alpha(t.app.accent, 0.06), transform: 'translateY(-1px)',
                    },
                  }}
                >
                  <Typography sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                    {c.classCode} <Box component="span" sx={{ fontWeight: 500, color: 'text.secondary' }}>· {c.className}</Box>
                  </Typography>
                  <Chip label={label.text} color={label.color} size="small" sx={{ mt: 1 }} />
                  <LinearProgress
                    variant="determinate" value={availabilityPercent(c)} color={label.color} aria-hidden
                    sx={{
                      mt: 1, height: 4,
                      bgcolor: (t) => alpha(t.palette[label.color].main, 0.15),
                    }}
                  />
                  <Typography sx={{ mt: 1, fontWeight: 800 }}>{rupees(c.fare)}</Typography>
                </ButtonBase>
              );
            })}
          </Box>
        </GlassSection>
      ))}
    </Box>
  );
}

// How full the class's bar is: seats left, or RAC places left, or a sliver for the waitlist.
function availabilityPercent(c) {
  if (c.availableSeats > 0) return c.totalSeats ? Math.max(4, (c.availableSeats / c.totalSeats) * 100) : 100;
  if (c.racAvailable > 0) return c.racCapacity ? Math.max(4, (c.racAvailable / c.racCapacity) * 100) : 100;
  return 4;
}

function StopLabel({ stop, time, align }) {
  return (
    <Box sx={{ minWidth: 0, textAlign: align }}>
      <Typography sx={{ fontSize: { xs: '1.5rem', sm: '1.9rem' }, fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
        {time ? time.slice(0, 5) : '–'}
      </Typography>
      <Typography sx={{ fontWeight: 700, mt: 0.5, wordBreak: 'break-word' }}>
        {stop.name} <Mono sx={{ color: 'text.secondary', fontSize: '0.85em' }}>({stop.code})</Mono>
      </Typography>
      <Typography variant="body2" color="text.secondary">{formatDate(stop.date)}</Typography>
    </Box>
  );
}

// A station code, picked from Team 2's stations by code, name or city, or typed.
function StationField({ label, placeholder, stations, value, onChange }) {
  return (
    <Autocomplete
      freeSolo
      options={stations}
      getOptionLabel={(s) => (typeof s === 'string' ? s : s.stationCode)}
      filterOptions={(options, { inputValue }) => {
        const q = inputValue.trim().toLowerCase();
        return options.filter((s) => !q || [s.stationCode, s.stationName, s.city].some((t) => t?.toLowerCase().includes(q)));
      }}
      renderOption={(props, s) => {
        const { key, ...rest } = props;
        return (
          <li key={key} {...rest}>
            <Box>
              <Typography fontWeight={600} component="span">{s.stationCode}</Typography>
              <Typography variant="body2" color="text.secondary" component="span"> · {s.stationName}, {s.city}</Typography>
            </Box>
          </li>
        );
      }}
      inputValue={value}
      onInputChange={(e, v) => onChange(v.toUpperCase())}
      onChange={(e, v) => onChange(typeof v === 'string' ? v.toUpperCase() : v?.stationCode || '')}
      renderInput={(p) => <TextField {...p} fullWidth required label={label} placeholder={placeholder} />}
    />
  );
}
