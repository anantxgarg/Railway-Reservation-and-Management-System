import { useEffect, useState } from "react";
import NotificationsIcon from "@mui/icons-material/Notifications";
import { request } from "../team6Http";
import "./notifications.css";

// How often (in milliseconds) we ask the backend for the unread count. 15000 ms = 15 seconds.
const POLL_EVERY_MS = 15000;

// The one backend call the bell needs: { userId, unread: 3 }.
function getUnreadCount(userId) {
  return request(`/notifications/user/${encodeURIComponent(userId)}/unread-count`);
}

/*
 * A button with a bell and a red badge showing the unread count.
 * The badge blinks while there are unread notifications (the "blink animation" from the work plan).
 *
 * Props:
 *   userId     whose unread count to show
 *   onClick    what to do when it's clicked (the parent decides, e.g. open the notifications page)
 *   className  the parent's button style, so this button looks like the parent's other buttons
 *
 * It fetches the count itself, so the parent doesn't have to share any state with it.
 */
export default function NotificationBell({ userId, onClick, className = "" }) {
  const [unread, setUnread] = useState(0);

  // Ask now, then every 15 seconds. The function returned at the end stops the timer
  // when the bell disappears (e.g. when another page opens).
  useEffect(() => {
    const check = () => getUnreadCount(userId)
      .then((data) => setUnread(data.unread))
      .catch(() => {});   // backend down: just show no badge
    check();
    const timer = setInterval(check, POLL_EVERY_MS);
    return () => clearInterval(timer);
  }, [userId]);

  return (
    <button
      type="button"
      className={`bell-button ${className}`}
      onClick={onClick}
      title={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
    >
      <NotificationsIcon fontSize="small" />
      <span className="bell-label">Notifications</span>
      {unread > 0 && <span className="bell-badge" aria-label={`${unread} unread`}>{unread}</span>}
    </button>
  );
}
