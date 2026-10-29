import React, { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button, Alert,
  CircularProgress, Chip, IconButton, MenuItem, Divider, Tooltip
} from '@mui/material';
import AddIcon from '@mui/icons-material/PersonAdd';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TrainIcon from '@mui/icons-material/Train';
import GroupIcon from '@mui/icons-material/GroupsOutlined';
import PersonIcon from '@mui/icons-material/PersonOutline';
import PaymentIcon from '@mui/icons-material/PaymentOutlined';
import { bookingApi } from '../../api';
import { navigate } from '../../router';
import { DetailGrid, DetailItem, GlassSection, IconTile, LoadingCard, Mono, PageHeader } from '../../components/ui';
import { GENDERS, availabilityLabel, formatDate, rupees } from './format';
import { ageProblem, concessionLabel, useConcessionRules } from './concessions';

export const MAX_PASSENGERS = 6;

const emptyPassenger = () => ({ name: '', age: '', gender: '', concessionId: '' });

/**
 * Passenger details for one train, class and journey
 * (#/book/{runId}/{class}/{from}/{to}). Submitting books and holds the seats
 * for 15 minutes, then opens the booking to review and pay.
 *
 * A passenger may be booked with a concession (Team 4's list); the fare is
 * reduced when the seats are held, and the documents for it are sent from
 * the Concessions screen.
 *
 * The database checks every value again (age 1-120, gender, a concession's
 * ages, ...) and its message is shown if it refuses one.
 */
export default function PassengerForm({ params }) {
  const [runId, classCode, from, to] = params;
  const [journey, setJourney] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [passengers, setPassengers] = useState([emptyPassenger()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const concessions = useConcessionRules();

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
        passengers: passengers.map((p) => ({
          name: p.name.trim(),
          age: Number(p.age),
          gender: p.gender,
          concessionId: p.concessionId === '' ? null : Number(p.concessionId),
        })),
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
        <PageHeader tag="Reservations" title="Passenger details" />
        <Alert severity="error" action={<Button color="inherit" onClick={() => window.history.back()}>Back</Button>}>
          {loadError}
        </Alert>
      </Box>
    );
  }
  if (!journey) return <LoadingCard text="Loading the journey…" />;

  const cls = journey.classes[0];
  const label = availabilityLabel(cls);

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto' }}>
      <PageHeader
        tag="Reservations"
        title="Passenger details"
        subtitle="Add who is travelling. We hold the seats for 15 minutes while you review and pay."
      />

      <GlassSection
        title={journey.trainName}
        subtitle={<>Train <Mono>#{journey.trainNo}</Mono></>}
        icon={<TrainIcon />}
        actions={
          <Button
            size="small"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(`/search/${journey.from.code}/${journey.to.code}/${journey.from.date}`)}
          >
            Back to results
          </Button>
        }
        contentSx={{ pt: 2.5 }}
      >
        <DetailGrid columns={{ xs: 1, sm: 2 }}>
          <DetailItem label="From">
            {journey.from.name} ({journey.from.code})
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>{formatDate(journey.from.date)}</Typography>
          </DetailItem>
          <DetailItem label="To">
            {journey.to.name} ({journey.to.code})
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>{formatDate(journey.to.date)}</Typography>
          </DetailItem>
        </DetailGrid>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 2, flexWrap: 'wrap' }}>
          <Chip label={`${cls.classCode} · ${cls.className}`} variant="outlined" />
          <Chip label={label.text} color={label.color} />
          <Typography variant="body2" color="text.secondary">{rupees(cls.fare)} per passenger, general quota</Typography>
        </Box>
      </GlassSection>

      <form onSubmit={submit}>
        <GlassSection
          title={`Passengers (${passengers.length} of up to ${MAX_PASSENGERS})`}
          icon={<GroupIcon />}
          contentSx={{ pt: 2.5 }}
        >
          {passengers.map((p, i) => (
            <Card key={i} sx={{ mb: 2 }}>
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <IconTile size={32}><PersonIcon /></IconTile>
                  <Typography variant="subtitle2" sx={{ flexGrow: 1, fontSize: '0.95rem' }}>Passenger {i + 1}</Typography>
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
                </Box>
                <Box
                  sx={{
                    display: 'grid', gap: 2,
                    gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'minmax(0, 2fr) minmax(0, 0.8fr) minmax(0, 1fr) minmax(0, 1.6fr)' },
                    '& > .passenger-name, & > .passenger-concession': { gridColumn: { xs: '1 / -1', md: 'auto' } },
                  }}
                >
                  <TextField
                    className="passenger-name"
                    fullWidth required size="small" label={`Passenger ${i + 1} name`}
                    value={p.name} onChange={(e) => update(i, 'name', e.target.value)}
                    inputProps={{ maxLength: 100 }}
                  />
                  <TextField
                    fullWidth required size="small" label="Age" type="number"
                    value={p.age} onChange={(e) => update(i, 'age', e.target.value)}
                    inputProps={{ min: 1, max: 120 }}
                  />
                  <TextField
                    select fullWidth required size="small" label="Gender"
                    value={p.gender} onChange={(e) => update(i, 'gender', e.target.value)}
                  >
                    {GENDERS.map((g) => <MenuItem key={g.value} value={g.value}>{g.label}</MenuItem>)}
                  </TextField>
                  <TextField
                    className="passenger-concession"
                    select fullWidth size="small" label="Concession"
                    value={p.concessionId} onChange={(e) => update(i, 'concessionId', e.target.value)}
                    disabled={!concessions.length}
                  >
                    <MenuItem value="">None</MenuItem>
                    {concessions.map((c) => {
                      const problem = ageProblem(c, p.age);
                      return (
                        <MenuItem key={c.concessionId} value={c.concessionId} disabled={!!problem}>
                          {concessionLabel(c)}{problem ? ` · ${problem}` : ''}
                        </MenuItem>
                      );
                    })}
                  </TextField>
                </Box>
              </CardContent>
            </Card>
          ))}
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            disabled={passengers.length >= MAX_PASSENGERS}
            onClick={() => setPassengers((list) => [...list, emptyPassenger()])}
          >
            Add passenger
          </Button>
        </GlassSection>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        <GlassSection title="Fare" icon={<PaymentIcon />} contentSx={{ pt: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1.5 }}>
            <Typography color="text.secondary">{passengers.length} × {rupees(cls.fare)}</Typography>
            <Typography variant="h5" component="p">{rupees(Number(cls.fare) * passengers.length)}</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            The seats are held for 15 minutes while you pay. Passengers who don't get a berth go on RAC or the
            waitlist, as shown above.
            {passengers.some((p) => p.concessionId !== '') && (
              <> Concessions are taken off the fare when the seats are held; send the documents for them from
                the Concessions tab, where staff check them.</>
            )}
          </Typography>
          <Divider sx={{ mb: 2.5 }} />
          <Button type="submit" variant="contained" size="large" fullWidth disabled={submitting}>
            {submitting ? <CircularProgress size={22} color="inherit" /> : 'Hold seats and review'}
          </Button>
        </GlassSection>
      </form>
    </Box>
  );
}
