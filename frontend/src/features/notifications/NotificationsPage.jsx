import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, Chip, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import NotificationsIcon from "@mui/icons-material/Notifications";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import ScienceIcon from "@mui/icons-material/Science";
import { request } from "../team6Http";
import { EmptyState, GlassSection, IconTile, PageHeader } from "../../components/ui";

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

// Demo buttons (fake journey, reset) are hidden unless the app is started with VITE_TEAM6_DEMO=true.
const DEMO = import.meta.env.VITE_TEAM6_DEMO === "true";

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
        text: "Cannot reach the notification service. Start it with cd notification-service, then ./mvnw spring-boot:run (mvnw.cmd on Windows), and make sure MongoDB is running.",
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
    <>
      <PageHeader
        tag="Notifications"
        title="Notification centre"
        subtitle="All your updates in one place, newest first"
        actions={(
          <Button variant="contained" startIcon={<DoneAllIcon />} onClick={markAllRead} disabled={!unread}>
            Mark all read
          </Button>
        )}
      />
      {notice && (
        <Alert severity={notice.severity} onClose={() => setNotice(null)} sx={{ mb: 3 }}>
          {notice.text}
        </Alert>
      )}
      {notifications.length === 0 ? (
        <EmptyState
          icon={<NotificationsNoneIcon />}
          title="No notifications yet"
          text="Book and pay for a ticket, and updates about it appear here."
        />
      ) : (
        <GlassSection padding={1.5}>
          {notifications.map((n) => (
            <Box
              key={n.id}
              onClick={() => openNotification(n)}
              sx={{
                display: "flex", alignItems: "center", gap: 2, px: 1.5, py: 1.75, borderRadius: "12px", cursor: "pointer",
                bgcolor: (t) => (n.read ? "transparent" : alpha(t.app.accent, t.app.mode === "dark" ? 0.1 : 0.06)),
                transition: "background-color 0.2s ease",
                "&:hover": { bgcolor: (t) => alpha(t.app.accent, t.app.mode === "dark" ? 0.14 : 0.09) },
                "& + &": { mt: 0.5 },
              }}
            >
              <IconTile size={42}><NotificationsIcon /></IconTile>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography fontWeight={n.read ? 600 : 800}>{n.title}</Typography>
                  {!n.read && <Chip label="NEW" color="primary" size="small" />}
                </Stack>
                <Typography sx={{ mt: 0.5, color: n.read ? "text.secondary" : "text.primary" }}>{n.message}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatTime(n.createdAt)} · from {n.sourceTeam}
                </Typography>
              </Box>
            </Box>
          ))}
        </GlassSection>
      )}
      {/* Only when the frontend is started with VITE_TEAM6_DEMO=true and the backend with TEAM6_DEMO=true */}
      {DEMO && (
        <GlassSection title="Demo controls" icon={<ScienceIcon />}>
          <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 2 }}>
            <Button variant="outlined" onClick={handleSimulate}>Simulate full journey (7 notifications)</Button>
            <Button variant="outlined" color="error" onClick={handleReset}>Reset demo data (admins)</Button>
          </Stack>
        </GlassSection>
      )}
    </>
  );
}
