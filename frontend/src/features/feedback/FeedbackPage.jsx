import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, Divider, Rating, Stack, TextField, Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { request } from "../team6Http";
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
      {notice && (
        <Alert severity={notice.severity} onClose={() => setNotice(null)} sx={{ mb: 2 }}>
          {notice.text}
        </Alert>
      )}
      <Box className="two-column">
        <Card className="panel">
          <CardContent sx={{ p: 3 }}>
            {!form ? (
              // No journey chosen yet, or the backend said there's no completed journey for this PNR.
              <Box sx={{ textAlign: "center", py: 4 }}>
                <Typography variant="h6" fontWeight={800}>No journey selected</Typography>
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  Open a "Journey completed" notification, or enter your PNR.
                </Typography>
                {formError && <Alert severity="warning" sx={{ mt: 2, textAlign: "left" }}>{formError}</Alert>}
                <Box component="form" onSubmit={(e) => { e.preventDefault(); setPnr(pnrInput); }}
                  sx={{ display: "flex", gap: 1, mt: 2, justifyContent: "center", flexWrap: "wrap" }}>
                  <TextField size="small" label="10-digit PNR" value={pnrInput}
                    onChange={(e) => setPnrInput(e.target.value.replace(/\D/g, "").slice(0, 10))} />
                  <Button type="submit" variant="contained" disabled={pnrInput.length !== 10}>Open form</Button>
                </Box>
              </Box>
            ) : form.alreadySubmitted ? (
              <Box sx={{ textAlign: "center", py: 4 }}>
                <CheckCircleIcon color="success" sx={{ fontSize: 60 }} />
                <Typography variant="h6" fontWeight={800}>Feedback received!</Typography>
                <Typography color="text.secondary">Thank you for rating PNR {form.pnr}.</Typography>
              </Box>
            ) : (
              <Box component="form" onSubmit={handleSubmitFeedback}>
                <Chip color="success" label="Journey completed" size="small" />
                <Typography variant="h5" fontWeight={800} sx={{ mt: 2 }}>Rate your experience</Typography>
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  Rate from 1 (Poor) to 10 (Excellent).
                </Typography>
                <Divider sx={{ my: 2 }} />

                {/* One star row per category. */}
                {CATEGORIES.map((c) => (
                  <Box key={c.key} className="rating-row">
                    <Typography fontWeight={700}>
                      {c.label}
                      {c.optional && <Typography component="span" variant="caption" color="text.secondary"> (optional, skip if not applicable)</Typography>}
                    </Typography>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Rating
                        max={10}
                        value={ratings[c.key]}
                        // MUI gives null when you click the same star again (= clear it).
                        onChange={(_, value) => setRatings({ ...ratings, [c.key]: value || 0 })}
                      />
                      <Typography variant="body2" color="text.secondary">
                        {ratings[c.key] ? `${ratings[c.key]}/10` : "-"}
                      </Typography>
                    </Stack>
                  </Box>
                ))}

                <TextField
                  fullWidth multiline rows={3} sx={{ mt: 2 }}
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
            )}
          </CardContent>
        </Card>

        {/* Journey details: comes from the JOURNEY_COMPLETED notification's data. */}
        <Card className="panel">
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={800}>Journey details</Typography>
            {!journey ? (
              <Typography color="text.secondary" variant="body2" sx={{ mt: 1 }}>Nothing to show yet.</Typography>
            ) : (
              <>
                <Typography color="text.secondary" variant="body2">
                  {journey.trainName} · #{journey.trainNumber}
                </Typography>
                <Box className="journey-route">
                  <Box className="station-dot" />
                  <Box sx={{ flex: 1 }}>
                    <Typography fontWeight={700}>{journey.fromStation}</Typography>
                    <Typography variant="body2" color="text.secondary">Departure · {journey.departureTime}</Typography>
                  </Box>
                </Box>
                <Box className="route-line" />
                <Box className="journey-route">
                  <Box className="station-dot destination" />
                  <Box sx={{ flex: 1 }}>
                    <Typography fontWeight={700}>{journey.toStation}</Typography>
                    <Typography variant="body2" color="text.secondary">Arrival · {journey.arrivalTime}</Typography>
                  </Box>
                </Box>
                <Divider sx={{ my: 2 }} />
                {[
                  ["PNR", form.pnr],
                  ["Journey date", journey.journeyDate],
                  ["Passenger", journey.passengerName],
                  ["Coach / Seat", `${journey.coach} / ${journey.seat}`],
                ].map(([label, value]) => (
                  <Stack key={label} direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
                    <Typography color="text.secondary">{label}</Typography>
                    <Typography fontWeight={700}>{value}</Typography>
                  </Stack>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </Box>
    </>
  );
}
