import React, { useEffect, useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Card, CardContent, Chip,
  CircularProgress, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { networkApi } from '../../api';
import { isoDate } from '../booking/format';

/**
 * Team 2's network (train-service): every train with its weekdays, stops,
 * timetable and coaches. Staff and admins also get the day's runs, where they
 * report a run's status and delay; that feeds live status, and marking a run
 * ARRIVED sends its passengers Team 6's "journey completed" notification.
 */
export default function TrainsPage({ user }) {
  const isStaff = user.role === 'STAFF' || user.role === 'ADMIN';
  return (
    <Box sx={{ maxWidth: 960, mx: 'auto' }}>
      {isStaff && <RunsPanel />}
      <TrainList />
    </Box>
  );
}

function TrainList() {
  const [trains, setTrains] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    networkApi.trains().then(setTrains).catch((e) => setError(e.message));
  }, []);

  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h5" component="h1" gutterBottom>Trains</Typography>
        {error && <Alert severity="error">{error}</Alert>}
        {!trains && !error && <CircularProgress />}
        {trains?.map((t) => <TrainDetails key={t.trainNo} train={t} />)}
      </CardContent>
    </Card>
  );
}

function TrainDetails({ train }) {
  const [details, setDetails] = useState(null);

  const open = (e, expanded) => {
    if (expanded && !details) {
      Promise.all([networkApi.trainStops(train.trainNo), networkApi.schedules(train.trainNo), networkApi.coaches(train.trainNo)])
        .then(([stops, schedules, coaches]) => setDetails({ stops, schedules, coaches }))
        .catch((err) => setDetails({ error: err.message }));
    }
  };

  // a train may follow different routes on different weekdays
  const routes = details?.stops ? [...new Set(details.stops.map((s) => s.routeId))] : [];

  return (
    <Accordion onChange={open} disableGutters sx={{ bgcolor: 'transparent', backgroundImage: 'none' }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography fontWeight={600} sx={{ mr: 1 }}>{train.trainName}</Typography>
        <Typography color="text.secondary">#{train.trainNo} · {train.trainType}</Typography>
        {!train.isActive && <Chip label="Inactive" size="small" sx={{ ml: 1 }} />}
      </AccordionSummary>
      <AccordionDetails>
        {!details && <CircularProgress size={24} />}
        {details?.error && <Alert severity="error">{details.error}</Alert>}
        {details?.stops && (
          <>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 2 }}>
              {details.schedules.map((s) => <Chip key={s.runDay} label={s.runDay.slice(0, 3)} size="small" color="primary" variant="outlined" />)}
              <Box sx={{ flexGrow: 1 }} />
              {details.coaches.map((c) => <Chip key={c.coachNo} label={`${c.coachNo} · ${c.classCode}`} size="small" />)}
            </Box>
            {routes.map((routeId) => (
              <TableContainer key={routeId} sx={{ mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>#</TableCell><TableCell>Station</TableCell><TableCell>Arrives</TableCell>
                      <TableCell>Departs</TableCell><TableCell>Day</TableCell><TableCell align="right">km</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {details.stops.filter((s) => s.routeId === routeId).map((s, i, all) => (
                      <TableRow key={s.stopSeq}>
                        <TableCell>{s.stopSeq}</TableCell>
                        <TableCell>{s.stationName} ({s.stationCode})</TableCell>
                        <TableCell>{s.arrivalTime ? s.arrivalTime.slice(0, 5) : '–'}</TableCell>
                        <TableCell>{i < all.length - 1 ? s.departureTime.slice(0, 5) : '–'}</TableCell>
                        <TableCell>{s.dayOffset + 1}</TableCell>
                        <TableCell align="right">{Number(s.distanceKm)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ))}
          </>
        )}
      </AccordionDetails>
    </Accordion>
  );
}

const STATUSES = ['SCHEDULED', 'DEPARTED', 'DELAYED', 'CANCELLED', 'ARRIVED'];
const STATUS_COLOR = { SCHEDULED: 'default', DEPARTED: 'info', DELAYED: 'warning', CANCELLED: 'error', ARRIVED: 'success' };

// Staff: the runs of one day, with status and delay
function RunsPanel() {
  const [date, setDate] = useState(isoDate(0));
  const [runs, setRuns] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    setRuns(null);
    networkApi.runsOn(date).then(setRuns).catch((e) => setNotice({ severity: 'error', text: e.message }));
  }, [date]);

  const save = async (run, status, delayMinutes) => {
    try {
      const result = await networkApi.setRunStatus(run.runId, status, delayMinutes);
      setRuns((rs) => rs.map((r) => (r.runId === run.runId ? result.run : r)));
      setNotice({
        severity: 'success',
        text: `Train ${run.trainNo}: ${status.toLowerCase()}${delayMinutes ? `, ${delayMinutes} min late` : ''}.`
          + (result.journeyCompletedNotifications ? ` ${result.journeyCompletedNotifications} passenger booking(s) were asked for feedback.` : ''),
      });
    } catch (e) {
      setNotice({ severity: 'error', text: e.message });
    }
  };

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
          <Typography variant="h5" component="h2" sx={{ flexGrow: 1 }}>Runs</Typography>
          <TextField type="date" size="small" label="Leaving on" value={date}
            onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
        </Box>
        {notice && <Alert severity={notice.severity} onClose={() => setNotice(null)} sx={{ mb: 2 }}>{notice.text}</Alert>}
        {!runs && <CircularProgress size={24} />}
        {runs?.length === 0 && <Typography color="text.secondary">No train leaves on this day.</Typography>}
        {runs?.map((r) => <RunRow key={r.runId} run={r} onSave={save} />)}
      </CardContent>
    </Card>
  );
}

function RunRow({ run, onSave }) {
  const [status, setStatus] = useState(run.status);
  const [delay, setDelay] = useState(run.delayMinutes);
  const changed = status !== run.status || Number(delay) !== run.delayMinutes;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Typography fontWeight={600} sx={{ minWidth: 70 }}>{run.trainNo}</Typography>
      <Chip label={run.status} size="small" color={STATUS_COLOR[run.status]} sx={{ minWidth: 100 }} />
      <Box sx={{ flexGrow: 1 }} />
      <TextField select size="small" label="Status" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 150 }}>
        {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
      </TextField>
      <TextField type="number" size="small" label="Delay (min)" value={delay}
        onChange={(e) => setDelay(Math.max(0, Number(e.target.value)))} sx={{ width: 120 }} inputProps={{ min: 0 }} />
      <Button variant="contained" size="small" disabled={!changed} onClick={() => onSave(run, status, Number(delay))}>Save</Button>
    </Box>
  );
}
