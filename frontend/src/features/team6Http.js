// The one helper every Team 6 page uses to talk to the Team 6 Spring Boot backend
// (notification-service).
//
// We call "/api/..." (no "http://localhost:8086" in front). In development, vite.config.js
// forwards /api/notifications, /api/feedback and /api/demo to the backend on port 8086, so the
// browser thinks it is talking to the same website (no CORS trouble).
//
// It goes through the shared client in src/api.js, so every request carries the user's Team 1
// login token (our backend checks who is asking), and an expired login is refreshed by itself.
import { apiRequest } from "../api";

// Sends one request and returns the JSON reply.
// If the backend replies with an error, it throws an Error holding the backend's message,
// e.g. "Feedback for PNR 4567891234 was already submitted".
export async function request(path, options = {}) {
  const body = options.body == null ? null : JSON.parse(options.body);
  return apiRequest(`/api${path}`, options.method || "GET", body);
}
