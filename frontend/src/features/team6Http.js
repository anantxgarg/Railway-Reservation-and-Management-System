// The one helper every feature's API file uses to talk to the Team 6 Spring Boot backend.
//
// We call "/api/..." (no "http://localhost:8086" in front). In development, vite.config.js
// forwards anything starting with /api to the backend on port 8086, so the browser thinks it
// is talking to the same website (no CORS trouble).

// Sends one request and returns the JSON reply.
// If the backend replies with an error, it throws an Error holding the backend's message,
// e.g. "Feedback for PNR 4567891234 was already submitted".
export async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  // .catch(() => null): a reply with an empty body would make .json() fail; treat it as "no data".
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    // Our backend always puts the reason in "message" (server.error.include-message=always).
    // throw new Error(body?.message || `Request failed with status ${response.status}`);
    console.log("Some error occured.");
    console.log(body.message);
    console.log(response.status);
  }
  return body;
}
