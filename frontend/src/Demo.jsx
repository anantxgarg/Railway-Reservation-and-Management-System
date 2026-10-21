import { useState } from "react";
import FeedbackPage from "./features/feedback/FeedbackPage";
import NotificationsPage from "./features/notifications/NotificationsPage";
import NotificationBell from "./features/notifications/NotificationBell";
import LiveStatusPage from "./features/livestatus/LiveStatusPage";
import "./App.css";

// Until the login team's JWT is ready, everyone is this one demo user.
// It's passed to the pages as a prop, so only this file changes when real logins arrive.
const USER_ID = "u_demo";

/*
Author: Aryan Aich.

This file is for testing purposes of the components we coded.
Herein, we hae have components, each is one responsbility of ours.
1. Feedback
2. Live Status of a train based on PNR.
3. Notifications (all sorts)

There is also a bell icon that is present.
 */
export default function App() {
  const [page, setPage] = useState(null);
  const [feedbackPnr, setFeedbackPnr] = useState("");

  function openFeedback(pnr) {
    setFeedbackPnr(pnr);
    setPage("feedback");
  }

  if (page) {
    return (
      <div className="app">
        <button type="button" className="back-button" onClick={() => setPage(null)}>← Back</button>
        {/* key: a new PNR gives a fresh FeedbackPage, so it starts with empty stars */}
        {page === "feedback" && <FeedbackPage key={feedbackPnr} userId={USER_ID} pnr={feedbackPnr} />}
        {page === "notifications" && <NotificationsPage userId={USER_ID} onOpenFeedback={openFeedback} />}
        {page === "livestatus" && <LiveStatusPage />}
      </div>
    );
  }

  return (
    <div className="app home">
      <h1>Team 6</h1>
      <div className="home-buttons">
        <button type="button" className="home-button" onClick={() => openFeedback("")}>Feedback</button>
        <NotificationBell className="home-button" userId={USER_ID} onClick={() => setPage("notifications")} />
        <button type="button" className="home-button" onClick={() => setPage("livestatus")}>Live train status</button>
      </div>
    </div>
  );
}
