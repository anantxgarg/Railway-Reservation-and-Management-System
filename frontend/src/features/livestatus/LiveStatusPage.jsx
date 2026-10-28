import { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, Stack, TextField, Typography,
} from "@mui/material";
import { networkApi } from "../../api";
import "./livestatus.css";

// ---- Where the data comes from ----
//
// Team 2's train-service: GET /api/live-status/pnr/{pnr} (you must own the PNR, or be staff).
// It works out where the train is from the timetable and the delay staff report for the run;
// there is no GPS feed. getLiveStatus() turns its reply into the rows this page shows.

const STATUS_TEXT = {
  DEPARTED: "Departed",
  AT_STATION: "At the station",
  NEXT: "Next stop",
  EXPECTED: "Expected",
  ARRIVED: "Arrived",
  CANCELLED: "Cancelled",
};

// "2026-11-01T16:55:00+05:30" -> "04:55 pm" (shown in India time, like a railway timetable)
function clock(iso) {
  return iso
    ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })
    : "-";
}

async function getLiveStatus(pnr) {
  const s = await networkApi.liveStatusOfPnr(pnr);
  return {
    pnr: s.pnr,
    train: `${s.trainName} · #${s.trainNo}`,
    runDate: s.runDate,
    delayText: s.summary,
    delayColor: s.runStatus === "CANCELLED" ? "error" : s.delayMinutes > 0 ? "warning" : "success",
    stations: s.stops.map((stop) => {
      // the departure matters at every stop except the last one
      const scheduled = stop.scheduledDeparture || stop.scheduledArrival;
      const expected = stop.expectedDeparture || stop.expectedArrival;
      return {
        key: stop.seq,
        name: `${stop.stationName} (${stop.stationCode})`,
        role: stop.seq === s.boardingSeq ? "You board here" : stop.seq === s.destinationSeq ? "You get off here" : null,
        scheduled: clock(scheduled),
        actual: s.runStatus === "CANCELLED" ? "-" : clock(expected),
        status: STATUS_TEXT[stop.status] || stop.status,
        delay: s.runStatus === "CANCELLED" ? 0 : s.delayMinutes,
      };
    }),
  };
}

// How often the page asks again while it is open (1 minute).
const REFRESH_EVERY_MS = 60000;

// ---- The page ----

// Live train status: enter a PNR, see each station's scheduled and expected times.
// startPnr (optional) comes from the address, e.g. /live-status/1000000016.
export default function LiveStatusPage({ startPnr = "" }) {
  const [pnr, setPnr] = useState(startPnr);
  const [status, setStatus] = useState(null);   // what getLiveStatus() returned; null = not searched yet
  const [error, setError] = useState("");

  const load = useCallback((which) => {
    getLiveStatus(which)
      .then((s) => { setStatus(s); setError(""); })
      .catch((e) => { setStatus(null); setError(e.message); });
  }, []);

  // Look up straight away when opened with a PNR, and refresh while shown.
  useEffect(() => {
    if (!status?.pnr) return undefined;
    const timer = setInterval(() => load(status.pnr), REFRESH_EVERY_MS);
    return () => clearInterval(timer);
  }, [status?.pnr, load]);

  useEffect(() => {
    if (startPnr.length === 10) load(startPnr);
  }, [startPnr, load]);

  function handleSubmit(e) {
    e.preventDefault();   // stop the browser from reloading the page on form submit
    load(pnr);
  }

  return (
    <Card className="panel">
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h5" fontWeight={800}>Live train status</Typography>
        <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
          Enter a PNR number to see where its train is, station by station.
        </Typography>
        <Box component="form" onSubmit={handleSubmit}
          sx={{ display: "flex", gap: 1, mb: 3, flexWrap: "wrap" }}>
          <TextField label="10-digit PNR number" value={pnr}
            onChange={(e) => setPnr(e.target.value.replace(/\D/g, "").slice(0, 10))}
            inputProps={{ maxLength: 10 }} required sx={{ flex: 1, minWidth: 220 }} />
          <Button type="submit" variant="contained" size="large" disabled={pnr.length !== 10}>Check status</Button>
        </Box>
        {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}
        {status && (
          <>
            <Stack direction="row" justifyContent="space-between" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
              <Box>
                <Typography fontWeight={800}>PNR: {status.pnr}</Typography>
                <Typography variant="body2" color="text.secondary">{status.train} · leaves {status.runDate}</Typography>
              </Box>
              <Chip label={status.delayText} color={status.delayColor} />
            </Stack>
            <Box sx={{ overflowX: "auto" }}>
              <Box sx={{ minWidth: 580 }}>
                <Box className="station-table table-header">
                  <Typography>Station</Typography><Typography>Scheduled</Typography>
                  <Typography>Actual / Expected</Typography><Typography>Delay</Typography>
                </Box>
                {status.stations.map((s) => (
                  <Box className="station-table" key={s.key}>
                    <Box>
                      <Typography fontWeight={700}>{s.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {s.status}{s.role ? ` · ${s.role}` : ""}
                      </Typography>
                    </Box>
                    <Typography>{s.scheduled}</Typography>
                    <Typography>{s.actual}</Typography>
                    <Chip size="small" label={`${s.delay} min`} color={s.delay ? "warning" : "success"} />
                  </Box>
                ))}
              </Box>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
              Worked out from the timetable and the delay reported by railway staff. Refreshes every minute.
            </Typography>
          </>
        )}
      </CardContent>
    </Card>
  );
}
