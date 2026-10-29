import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Chip, Divider, Rating, Stack, TextField, Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RateReviewIcon from "@mui/icons-material/RateReview";
import RouteIcon from "@mui/icons-material/Route";
import { request } from "../team6Http";
import { DetailGrid, DetailItem, EmptyState, GlassSection, Mono, PageHeader } from "../../components/ui";
import "./feedback.css";

// ---- Calls to the backend's feedback module (FeedbackController) ----

// Journey details for the feedback form + whether feedback was already given.
// Fails with "No completed journey..." if there is no JOURNEY_COMPLETED notification for this PNR.
function getFeedbackForm(userId, pnr) {
  return request(`/feedback/form?userId=${encodeURIComponent(userId)}&pnr=${encodeURIComponent(pnr)}`);
}

// Send the star ratings. feedback = { userId, pnr, ratings: {...}, comment }
function submitFeedback(feedback) {
  return request("/feedback", { method: "POST", body: JSON.stringify(feedback) });
}

// ---- The page ----

// A stop on the journey's route: a dot in the accent colour (green for the destination)
// and a line down to the next stop. Only the dot and line are drawn here; the text is the children.
function RouteStop({ destination, last, children }) {
  return (
    <Box sx={{ display: "flex", gap: 1.75, alignItems: "stretch" }}>
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", width: 14, flexShrink: 0, pt: 0.5 }}>
        <Box
          sx={{
            width: 14, height: 14, borderRadius: "50%", boxSizing: "border-box", border: "3px solid", flexShrink: 0,
            bgcolor: (t) => (destination ? t.palette.success.main : t.app.accent),
            borderColor: (t) => alpha(destination ? t.palette.success.main : t.app.accent, 0.3),
            backgroundClip: "padding-box",
          }}
        />
        {!last && <Box sx={{ flex: 1, width: 2, minHeight: 24, mt: 0.5, bgcolor: (t) => alpha(t.app.accent, 0.3) }} />}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, pb: last ? 0 : 2 }}>{children}</Box>
    </Box>
  );
}

// The 6 rating categories from the work plan. "key" must match the field names the backend expects.
const CATEGORIES = [
  { key: "washroomCleanliness", label: "Washroom Cleanliness" },
  { key: "foodQuality", label: "Food Quality", optional: true },
  { key: "coachCleaning", label: "Coach Cleaning" },
  { key: "electricalAppliances", label: "Electrical Appliances" },
  { key: "seatMaterialQuality", label: "Seat Material Quality" },
  { key: "bedsheetBlanket", label: "Bedsheet & Blanket" },
];

// Every category starts at 0 = "not rated yet".
const EMPTY_RATINGS = Object.fromEntries(CATEGORIES.map((c) => [c.key, 0]));

/*
 * The star-rating feedback form.
 *
 * Props (what the parent passes in):
 *   userId  who is giving feedback
 *   pnr     which journey to rate, e.g. from a clicked "Journey completed" notification.
 *           If empty, the page asks the user to type a PNR.
 */
export default function FeedbackPage({ userId, pnr: startPnr = "" }) {
  const [pnr, setPnr] = useState(startPnr);        // the journey the form is for
  const [pnrInput, setPnrInput] = useState("");    // the "enter your PNR" box
  // What the backend sent for a PNR: the journey details, or { pnr, error } if it failed.
  const [loadedForm, setLoadedForm] = useState(null);
  const [ratings, setRatings] = useState(EMPTY_RATINGS);
  const [comment, setComment] = useState("");
  const [notice, setNotice] = useState(null);      // message bar at the top: { severity, text }

  // Only use loadedForm if it belongs to the journey currently chosen (it may be from an older one).
  const current = pnr && loadedForm?.pnr === pnr ? loadedForm : null;
  const form = current && !current.error ? current : null;
  const formError = current?.error || "";
  const journey = form?.journey;

  // Whenever the chosen journey (pnr) changes, fetch its details for the form.
  useEffect(() => {
    if (!pnr) return;
    getFeedbackForm(userId, pnr)
      .then((data) => {
        setLoadedForm(data);
        setRatings(EMPTY_RATINGS);   // fresh, empty stars for the new journey
        setComment("");
      })
      .catch((error) => setLoadedForm({ pnr, error: error.message }));
  }, [userId, pnr]);

  async function handleSubmitFeedback(e) {
    e.preventDefault();  // stop the browser from reloading the page on form submit

    // Every category except the optional one must have at least 1 star.
    const missing = CATEGORIES.filter((c) => !c.optional && !ratings[c.key]);
    if (missing.length) {
      setNotice({ severity: "warning", text: `Please rate: ${missing.map((c) => c.label).join(", ")}` });
      return;
    }

    try {
      await submitFeedback({
        userId,
        pnr,
        // 0 means "not rated" -> send null, so the backend treats food quality as skipped.
        ratings: Object.fromEntries(CATEGORIES.map((c) => [c.key, ratings[c.key] || null])),
        comment: comment.trim() || null,
      });
      setLoadedForm({ ...form, alreadySubmitted: true });
      setNotice({ severity: "success", text: "Thank you! Your feedback has been saved." });
    } catch (error) {
      setNotice({ severity: "error", text: error.message });
    }
  }

  return (
    <>
      <PageHeader
        tag="Feedback"
        title="Rate your journey"
        subtitle="Tell us how the train, the coach and the food were. Your ratings help us improve."
      />
      {notice && (
        <Alert severity={notice.severity} onClose={() => setNotice(null)} sx={{ mb: 3 }}>
          {notice.text}
        </Alert>
      )}
      <Box className="two-column">
        {!form ? (
          // No journey chosen yet, or the backend said there's no completed journey for this PNR.
          <EmptyState
            icon={<RateReviewIcon />}
            title="No journey selected"
            text='Open a "Journey completed" notification, or enter your PNR.'
            action={(
              <Box sx={{ width: "100%" }}>
                {formError && <Alert severity="warning" sx={{ mb: 2, textAlign: "left" }}>{formError}</Alert>}
                <Box component="form" onSubmit={(e) => { e.preventDefault(); setPnr(pnrInput); }}
                  sx={{ display: "flex", gap: 1, justifyContent: "center", flexWrap: "wrap" }}>
                  <TextField size="small" label="10-digit PNR" value={pnrInput}
                    onChange={(e) => setPnrInput(e.target.value.replace(/\D/g, "").slice(0, 10))} />
                  <Button type="submit" variant="contained" disabled={pnrInput.length !== 10}>Open form</Button>
                </Box>
              </Box>
            )}
          />
        ) : form.alreadySubmitted ? (
          <GlassSection>
            <Box sx={{ textAlign: "center", py: 4 }}>
              <CheckCircleIcon color="success" sx={{ fontSize: 60 }} />
              <Typography variant="h6" fontWeight={800}>Feedback received!</Typography>
              <Typography color="text.secondary">Thank you for rating PNR <Mono>{form.pnr}</Mono>.</Typography>
            </Box>
          </GlassSection>
        ) : (
          <GlassSection
            title="Rate your experience"
            subtitle="Rate from 1 (Poor) to 10 (Excellent)."
            icon={<RateReviewIcon />}
            actions={<Chip color="success" label="Journey completed" size="small" />}
          >
            <Box component="form" onSubmit={handleSubmitFeedback} sx={{ mt: 2.5 }}>
              {/* One star row per category. */}
              {CATEGORIES.map((c) => (
                <Box
                  key={c.key}
                  sx={{
                    px: 2, py: 1.5, mb: 1.25, borderRadius: "12px",
                    bgcolor: (t) => t.app.glassNested, border: (t) => `1px solid ${t.app.divider}`,
                  }}
                >
                  <Typography fontWeight={700}>
                    {c.label}
                    {c.optional && <Typography component="span" variant="caption" color="text.secondary"> (optional, skip if not applicable)</Typography>}
                  </Typography>
                  <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                    <Rating
                      max={10}
                      value={ratings[c.key]}
                      // MUI gives null when you click the same star again (= clear it).
                      onChange={(_, value) => setRatings({ ...ratings, [c.key]: value || 0 })}
                      sx={{ maxWidth: "100%", "& .MuiRating-iconFilled": { color: (t) => t.palette.warning.main } }}
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                      {ratings[c.key] ? `${ratings[c.key]}/10` : "-"}
                    </Typography>
                  </Stack>
                </Box>
              ))}

              <TextField
                fullWidth multiline rows={3} sx={{ mt: 1.5 }}
                label="Written message (optional)"
                placeholder="Tell us about your journey..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                inputProps={{ maxLength: 1000 }}
              />
              <Button type="submit" variant="contained" fullWidth size="large" sx={{ mt: 2 }}>
                Submit feedback
              </Button>
            </Box>
          </GlassSection>
        )}

        {/* Journey details: comes from the JOURNEY_COMPLETED notification's data. */}
        <GlassSection title="Journey details" icon={<RouteIcon />}>
          {!journey ? (
            <Typography color="text.secondary" variant="body2" sx={{ mt: 1 }}>Nothing to show yet.</Typography>
          ) : (
            <>
              <Typography color="text.secondary" variant="body2" sx={{ mt: 1, mb: 2 }}>
                {journey.trainName} · #<Mono>{journey.trainNumber}</Mono>
              </Typography>
              <RouteStop>
                <Typography fontWeight={700}>{journey.fromStation}</Typography>
                <Typography variant="body2" color="text.secondary">Departure · {journey.departureTime}</Typography>
              </RouteStop>
              <RouteStop destination last>
                <Typography fontWeight={700}>{journey.toStation}</Typography>
                <Typography variant="body2" color="text.secondary">Arrival · {journey.arrivalTime}</Typography>
              </RouteStop>
              <Divider sx={{ my: 2 }} />
              <DetailGrid columns={2}>
                <DetailItem label="PNR" mono>{form.pnr}</DetailItem>
                <DetailItem label="Journey date">{journey.journeyDate}</DetailItem>
                <DetailItem label="Passenger">{journey.passengerName}</DetailItem>
                <DetailItem label="Coach / Seat">{`${journey.coach} / ${journey.seat}`}</DetailItem>
              </DetailGrid>
            </>
          )}
        </GlassSection>
      </Box>
    </>
  );
}
