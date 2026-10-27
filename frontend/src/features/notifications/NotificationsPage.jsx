import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, Divider, Stack, Typography } from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import { request } from "../team6Http";
import "./notifications.css";

// ---- Calls to the backend's notification module (NotificationController and DemoController) ----

// List of the user's notifications, newest first.
function getNotifications(userId) {
  return request(`/notifications/user/${encodeURIComponent(userId)}`);
}

// Mark one notification as read (when the user clicks it).
function markNotificationRead(id) {
  return request(`/notifications/${id}/read`, { method: "PATCH" });
}

// Mark all of the user's notifications as read.
function markAllNotificationsRead(userId) {
  return request(`/notifications/user/${encodeURIComponent(userId)}/read-all`, { method: "PATCH" });
}

// Demo only: makes the backend send all 7 notification types for a made-up journey. Returns { pnr, ... }.
function simulateJourney(userId) {
  return request(`/demo/journey?userId=${encodeURIComponent(userId)}`, { method: "POST" });
}

// Demo only: deletes all notifications and feedback in the database.
function resetDemo() {
  return request("/demo/reset", { method: "DELETE" });
}

// ---- The page ----

// "2026-10-21T09:00:00Z" -> "21 Oct, 02:30 pm" (in the user's own time zone)
function formatTime(isoText) {
  return new Date(isoText).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/*
 * The notification centre.
 *
 * Props (what the parent passes in):
 *   userId          whose notifications to show
 *   onOpenFeedback  function(pnr) the parent runs when a "Journey completed" notification is
 *                   clicked. This page doesn't know how the feedback page works; the parent decides.
 */
export default function NotificationsPage({ userId, onOpenFeedback }) {
  const [notifications, setNotifications] = useState([]);
  const [notice, setNotice] = useState(null);   // message bar at the top: { severity, text }

  const unread = notifications.filter((n) => !n.read).length;

  // Fetch the notification list from the backend.
  // useCallback keeps the same function between renders, so the useEffect below runs only once.
  const loadNotifications = useCallback(() => {
    return getNotifications(userId)
      .then(setNotifications)
      .catch(() => setNotice({
        severity: "error",
        text: "Cannot reach the backend. Start it with cd backend, then .\\mvnw.cmd spring-boot:run, and make sure MongoDB is running.",
      }));
  }, [userId]);

  // Load once when the page appears.
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Clicking a notification marks it read. A "journey completed" one opens the feedback form.
  async function openNotification(n) {
    if (!n.read) {
      await markNotificationRead(n.id).catch(() => {});
    }
    if (n.type === "JOURNEY_COMPLETED") {
      onOpenFeedback(n.pnr);
    } else {
      loadNotifications();
    }
  }

  async function markAllRead() {
    await markAllNotificationsRead(userId).catch(() => {});
    loadNotifications();
  }

  // Demo: ask the backend to fake a whole journey (all 7 notification types).
  async function handleSimulate() {
    try {
      const result = await simulateJourney(userId);
      await loadNotifications();
      setNotice({ severity: "info", text: `Demo journey created for PNR ${result.pnr}: 7 notifications sent.` });
    } catch (error) {
      setNotice({ severity: "error", text: error.message });
    }
  }

  // Demo: empty the database to start over.
  async function handleReset() {
    try {
      await resetDemo();
      await loadNotifications();
      setNotice({ severity: "info", text: "Demo data cleared." });
    } catch (error) {
      setNotice({ severity: "error", text: error.message });
    }
  }

  return (
    <Card className="panel">
      <CardContent sx={{ p: 3 }}>
        {notice && (
          <Alert severity={notice.severity} onClose={() => setNotice(null)} sx={{ mb: 2 }}>
            {notice.text}
          </Alert>
        )}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h5" fontWeight={800}>Notification centre</Typography>
            <Typography color="text.secondary" variant="body2">All your updates in one place, newest first</Typography>
          </Box>
          <Button onClick={markAllRead} disabled={!unread}>Mark all read</Button>
        </Stack>
        {notifications.length === 0 && (
          <Typography color="text.secondary" sx={{ py: 2 }}>No notifications yet. Use "Simulate full journey" below.</Typography>
        )}
        {notifications.map((n) => (
          <Box key={n.id} className={`notification-row ${n.read ? "" : "unread"}`}
            onClick={() => openNotification(n)} sx={{ cursor: "pointer" }}>
            <Box className="notification-icon"><NotificationsIcon /></Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography fontWeight={800}>{n.title}</Typography>
                {!n.read && <Chip label="NEW" color="primary" size="small" />}
              </Stack>
              <Typography sx={{ mt: 0.5 }}>{n.message}</Typography>
              <Typography variant="caption" color="text.secondary">
                {formatTime(n.createdAt)} · from {n.sourceTeam}
              </Typography>
            </Box>
          </Box>
        ))}
        <Divider sx={{ my: 3 }} />
        <Typography fontWeight={700} sx={{ mb: 1 }}>Demo controls</Typography>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          <Button variant="outlined" onClick={handleSimulate}>Simulate full journey (7 notifications)</Button>
          <Button variant="outlined" color="error" onClick={handleReset}>Reset demo data</Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
