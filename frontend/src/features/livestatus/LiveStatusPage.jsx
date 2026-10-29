import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, Chip, Stack, TextField, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import TrainIcon from "@mui/icons-material/Train";
import { networkApi } from "../../api";
import { GlassSection, IconTile, Mono, PageHeader } from "../../components/ui";
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
        code: stop.status,
        isDestination: stop.seq === s.destinationSeq,
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
    <>
      <PageHeader
        tag="Live status"
        title="Live train status"
        subtitle="Enter a PNR number to see where its train is, station by station."
      />
      <GlassSection title="Check a PNR" subtitle="The 10-digit number on your ticket" icon={<ConfirmationNumberIcon />}>
        <Box component="form" onSubmit={handleSubmit}
          sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mt: 2.5 }}>
          <TextField label="10-digit PNR number" value={pnr}
            onChange={(e) => setPnr(e.target.value.replace(/\D/g, "").slice(0, 10))}
            inputProps={{ maxLength: 10 }} required sx={{ flex: 1, minWidth: 220 }} />
          <Button type="submit" variant="contained" size="large" disabled={pnr.length !== 10}>Check status</Button>
        </Box>
        {error && <Alert severity="warning" sx={{ mt: 2 }}>{error}</Alert>}
      </GlassSection>
      {status && (
        <GlassSection>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2} sx={{ mb: 2.5 }}>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ minWidth: 0 }}>
              <IconTile><TrainIcon /></IconTile>
              <Box sx={{ minWidth: 0 }}>
                <Typography fontWeight={800}>PNR: <Mono>{status.pnr}</Mono></Typography>
                <Typography variant="body2" color="text.secondary">{status.train} · leaves {status.runDate}</Typography>
              </Box>
            </Stack>
            <Chip label={status.delayText} color={status.delayColor} />
          </Stack>
          <Box
            sx={{
              overflowX: "auto", borderRadius: "12px",
              bgcolor: (t) => t.app.glassNested, border: (t) => `1px solid ${t.app.divider}`,
            }}
          >
            <Box sx={{ minWidth: 580 }}>
              <Box className="station-table" sx={{ ...headerRowSx, py: 1.25 }}>
                <Box>Station</Box><Box>Scheduled</Box><Box>Actual / Expected</Box><Box>Delay</Box>
              </Box>
              {status.stations.map((s, i) => (
                <StationRow key={s.key} stop={s} first={i === 0} last={i === status.stations.length - 1} />
              ))}
            </Box>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
            Worked out from the timetable and the delay reported by railway staff. Refreshes every minute.
          </Typography>
        </GlassSection>
      )}
    </>
  );
}

// Same look as the theme's table header cells
const headerRowSx = {
  fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
  color: "text.secondary", bgcolor: (t) => alpha(t.app.textPrimary, t.app.mode === "dark" ? 0.04 : 0.03),
  borderBottom: "1px solid", borderColor: "divider",
};

// One station: a dot on the route line (accent; green for the stop the train is at and for
// where you get off), the times, and the delay. Stations the train has left are dimmed.
function StationRow({ stop, first, last }) {
  const passed = stop.code === "DEPARTED";
  const highlight = stop.code === "AT_STATION" || stop.isDestination;
  const lineSx = {
    position: "absolute", left: "50%", width: 2, ml: "-1px", bgcolor: (t) => alpha(t.app.accent, 0.3),
  };
  return (
    <Box
      className="station-table"
      sx={{ borderBottom: "1px solid", borderColor: "divider", "&:last-child": { borderBottom: 0 }, opacity: passed ? 0.5 : 1 }}
    >
      <Box sx={{ display: "flex", gap: 1.5, alignItems: "stretch" }}>
        <Box sx={{ position: "relative", width: 14, flexShrink: 0 }}>
          {!first && <Box sx={{ ...lineSx, top: 0, height: "50%" }} />}
          {!last && <Box sx={{ ...lineSx, top: "50%", bottom: 0 }} />}
          <Box
            sx={{
              position: "absolute", top: "50%", left: 0, mt: "-7px", width: 14, height: 14, borderRadius: "50%",
              boxSizing: "border-box", border: "3px solid",
              bgcolor: (t) => (highlight ? t.palette.success.main : t.app.accent),
              borderColor: (t) => alpha(highlight ? t.palette.success.main : t.app.accent, 0.3),
              backgroundClip: "padding-box",
            }}
          />
        </Box>
        <Box sx={{ py: 1.75, minWidth: 0 }}>
          <Typography fontWeight={700}>{stop.name}</Typography>
          <Typography variant="caption" color="text.secondary">
            {stop.status}{stop.role ? ` · ${stop.role}` : ""}
          </Typography>
        </Box>
      </Box>
      <Typography>{stop.scheduled}</Typography>
      <Typography>{stop.actual}</Typography>
      <Box><Chip size="small" label={`${stop.delay} min`} color={stop.delay ? "warning" : "success"} /></Box>
    </Box>
  );
}
