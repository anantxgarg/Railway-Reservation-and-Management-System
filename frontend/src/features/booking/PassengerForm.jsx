import React, { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button, Grid, Alert,
  CircularProgress, Chip, IconButton, MenuItem, Divider, Tooltip
} from '@mui/material';
import AddIcon from '@mui/icons-material/PersonAdd';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { bookingApi } from '../../api';
import { navigate } from '../../router';
import { GENDERS, availabilityLabel, formatDate, rupees } from './format';

export const MAX_PASSENGERS = 6;

const emptyPassenger = () => ({ name: '', age: '', gender: '' });

/**
 * Passenger details for one train, class and journey
 * (#/book/{runId}/{class}/{from}/{to}). Submitting books and holds the seats
 * for 15 minutes, then opens the booking to review and pay.
 *
 * The database checks every value again (age 1-120, gender, ...) and its
 * message is shown if it refuses one.
 */
export default function PassengerForm({ params }) {
  const [runId, classCode, from, to] = params;
  const [journey, setJourney] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [passengers, setPassengers] = useState([emptyPassenger()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let current = true;
    bookingApi.availability(runId, { class: classCode, from, to })
      .then((data) => current && setJourney(data))
      .catch((err) => current && setLoadError(err.message));
    return () => {
      current = false;
    };
  }, [runId, classCode, from, to]);

  const update = (index, field, value) =>
    setPassengers((list) => list.map((p, i) => (i === index ? { ...p, [field]: value } : p)));

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const booking = await bookingApi.create({
        runId: Number(runId),
        classCode,
        from,
        to,
        passengers: passengers.map((p) => ({ name: p.name.trim(), age: Number(p.age), gender: p.gender })),
      });
      navigate(`/pnr/${booking.pnr}`);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <Box sx={{ maxWidth: 960, mx: 'auto' }}>
        <Alert severity="error" action={<Button color="inherit" onClick={() => window.history.back()}>Back</Button>}>
          {loadError}
        </Alert>
      </Box>
    );
  }
  if (!journey) return <Box sx={{ textAlign: 'center', p: 4 }}><CircularProgress /></Box>;

  const cls = journey.classes[0];
  const label = availabilityLabel(cls);

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto' }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate(`/search/${journey.from.code}/${journey.to.code}/${journey.from.date}`)}
        sx={{ mb: 2 }}
      >
        Back to results
      </Button>

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 1 }}>
            <Typography variant="h6" component="h1">{journey.trainName}</Typography>
            <Typography color="text.secondary">#{journey.trainNo}</Typography>
          </Box>
          <Typography sx={{ mt: 0.5 }}>
            {journey.from.name} ({journey.from.code}), {formatDate(journey.from.date)}
            {' → '}
            {journey.to.name} ({journey.to.code}), {formatDate(journey.to.date)}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1.5, flexWrap: 'wrap' }}>
            <Chip label={`${cls.classCode} · ${cls.className}`} variant="outlined" />
            <Chip label={label.text} color={label.color} sx={{ fontWeight: 600 }} />
            <Typography variant="body2" color="text.secondary">{rupees(cls.fare)} per passenger, general quota</Typography>
          </Box>
        </CardContent>
      </Card>

      <form onSubmit={submit}>
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" component="h2" gutterBottom>
              Passengers ({passengers.length} of up to {MAX_PASSENGERS})
            </Typography>
            {passengers.map((p, i) => (
              <Grid container spacing={2} key={i} sx={{ mb: 1 }} alignItems="center">
                <Grid item xs={12} sm={6} md={5}>
                  <TextField
                    fullWidth required size="small" label={`Passenger ${i + 1} name`}
                    value={p.name} onChange={(e) => update(i, 'name', e.target.value)}
                    inputProps={{ maxLength: 100 }}
                  />
                </Grid>
                <Grid item xs={4} sm={2}>
                  <TextField
                    fullWidth required size="small" label="Age" type="number"
                    value={p.age} onChange={(e) => update(i, 'age', e.target.value)}
                    inputProps={{ min: 1, max: 120 }}
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <TextField
                    select fullWidth required size="small" label="Gender"
                    value={p.gender} onChange={(e) => update(i, 'gender', e.target.value)}
                  >
                    {GENDERS.map((g) => <MenuItem key={g.value} value={g.value}>{g.label}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={2} sm={1}>
                  <Tooltip title="Remove passenger">
                    <span>
                      <IconButton
                        aria-label={`Remove passenger ${i + 1}`}
                        disabled={passengers.length === 1}
                        onClick={() => setPassengers((list) => list.filter((_, j) => j !== i))}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Grid>
              </Grid>
            ))}
            <Button
              startIcon={<AddIcon />}
              disabled={passengers.length >= MAX_PASSENGERS}
              onClick={() => setPassengers((list) => [...list, emptyPassenger()])}
            >
              Add passenger
            </Button>
          </CardContent>
        </Card>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        <Card>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography color="text.secondary">{passengers.length} × {rupees(cls.fare)}</Typography>
              <Typography variant="h6">{rupees(Number(cls.fare) * passengers.length)}</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              The seats are held for 15 minutes while you pay. Passengers who don't get a berth go on RAC or the
              waitlist, as shown above.
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Button type="submit" variant="contained" size="large" fullWidth disabled={submitting}>
              {submitting ? <CircularProgress size={22} color="inherit" /> : 'Hold seats and review'}
            </Button>
          </CardContent>
        </Card>
      </form>
    </Box>
  );
}
