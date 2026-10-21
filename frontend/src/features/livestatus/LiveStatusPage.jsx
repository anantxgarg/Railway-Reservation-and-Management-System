import { useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, Stack, TextField, Typography,
} from "@mui/material";
import "./livestatus.css";

// ---- Where the data comes from ----
//
// The backend has no live-status endpoint yet (it needs the schedule data from Siddhi's group),
// so for now getLiveStatus() returns sample data. It already returns a Promise, like a real fetch
// does, so when the endpoint exists only this function changes, e.g.:
//   import { request } from "../../http";
//   return request(`/live-status/${encodeURIComponent(pnr)}`);
// and the page below stays the same.

const SAMPLE_STATIONS = [
  { name: "Pune Junction", scheduled: "08:00 AM", actual: "08:05 AM", status: "Departed", delay: 5 },
  { name: "Lonavala", scheduled: "09:10 AM", actual: "09:20 AM", status: "Departed", delay: 10 },
  { name: "Kalyan Junction", scheduled: "10:30 AM", actual: "10:45 AM", status: "Next stop", delay: 15 },
  { name: "Chhatrapati Shivaji Maharaj Terminus", scheduled: "12:00 PM", actual: "12:15 PM", status: "Expected", delay: 15 },
];

function getLiveStatus(pnr) {
  return Promise.resolve({ pnr, delayText: "Running 15 min late", stations: SAMPLE_STATIONS });
}

// ---- The page ----

// Live train status: enter a PNR, see each station's scheduled and actual times.
// Needs nothing from its parent (no props): everything it uses is its own state.
export default function LiveStatusPage() {
  const [pnr, setPnr] = useState("");
  const [status, setStatus] = useState(null);   // what getLiveStatus() returned; null = not searched yet

  function handleSubmit(e) {
    e.preventDefault();   // stop the browser from reloading the page on form submit
    getLiveStatus(pnr).then(setStatus);
  }

  return (
    <Card className="panel">
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h5" fontWeight={800}>Live train status</Typography>
        <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
          Enter a PNR number to view a sample station timeline.
        </Typography>
        <Box component="form" onSubmit={handleSubmit}
          sx={{ display: "flex", gap: 1, mb: 3, flexWrap: "wrap" }}>
          <TextField label="10-digit PNR number" value={pnr}
            onChange={(e) => setPnr(e.target.value.replace(/\D/g, "").slice(0, 10))}
            inputProps={{ maxLength: 10 }} required sx={{ flex: 1, minWidth: 220 }} />
          <Button type="submit" variant="contained" size="large">Check status</Button>
        </Box>
        {status && (
          <>
            <Alert severity="info" sx={{ mb: 2 }}>
              Demo data only. This is not a live railway enquiry.
            </Alert>
            <Stack direction="row" justifyContent="space-between" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
              <Typography fontWeight={800}>PNR: {status.pnr}</Typography>
              <Chip label={status.delayText} color="warning" />
            </Stack>
            <Box sx={{ overflowX: "auto" }}>
              <Box sx={{ minWidth: 580 }}>
                <Box className="station-table table-header">
                  <Typography>Station</Typography><Typography>Scheduled</Typography>
                  <Typography>Actual / Expected</Typography><Typography>Delay</Typography>
                </Box>
                {status.stations.map((s) => (
                  <Box className="station-table" key={s.name}>
                    <Box>
                      <Typography fontWeight={700}>{s.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{s.status}</Typography>
                    </Box>
                    <Typography>{s.scheduled}</Typography>
                    <Typography>{s.actual}</Typography>
                    <Chip size="small" label={`${s.delay} min`} color={s.delay ? "warning" : "success"} />
                  </Box>
                ))}
              </Box>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
              Demo refresh: click Check status again. Automatic refresh and railway API integration are not connected yet.
            </Typography>
          </>
        )}
      </CardContent>
    </Card>
  );
}
