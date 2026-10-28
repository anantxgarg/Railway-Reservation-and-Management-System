# Team 6 Backend (notification-service)

This is the server for Team 6. It lives in `notification-service/` (`backend/` is Team 1's). It does two jobs:

- **Notifications.** Other teams tell us when something happens (a booking, a payment, a waitlist
  change...). We save it. Our website shows it under the bell icon.
- **Feedback.** When a journey is over, the passenger gives it stars (1 to 10) in 6 categories,
  and can write a comment.

Built with **Spring Boot 3** and **Java 17** (the same as the other teams). Data is saved in **MongoDB**.

What other teams should send us is in [NOTIFICATION_TYPES.md](NOTIFICATION_TYPES.md). In the merged
project nobody calls us directly: every team writes its events to the `notification_outbox` table in
PostgreSQL, in the same transaction as the booking or payment, and **booking-service delivers them to
us** with a copy of our `NotificationHandle` (see "Where notifications come from" below).

Our pages (notification centre and bell, feedback, live train status) are in the shared React app,
`frontend/src/features/{notifications,feedback,livestatus}`.

---

## Start it

You need:

- **Java 17** or newer
- **MongoDB**, running on your computer (on Windows it's the "MongoDB" service)
- Team 1's **JWT_SECRET** (the same one all backends use): users log in through Team 1, and we check
  their token to know who is asking.

Then run:

```powershell
cd notification-service
$env:JWT_SECRET="<Team 1's secret>"
.\mvnw.cmd spring-boot:run
```

(macOS/Linux: `JWT_SECRET=... ./mvnw spring-boot:run`.)

| Setting (environment) | Default | What it is |
|---|---|---|
| `JWT_SECRET` | none, required | Team 1's secret, to check login tokens |
| `TEAM6_MONGO_URI` | `mongodb://localhost:27017/team6_railway` | Our MongoDB database |
| `NOTIFICATIONS_API_KEY` | empty | Key other backends must send as `X-Internal-Key`. Set the same value for booking-service. Empty = anyone may send (development only) |
| `NOTIFICATIONS_PORT` | `8086` | |
| `TEAM6_DEMO` | `false` | Turns the `/api/demo/...` URLs on |

When you see `Started Team6Application`, it's ready at **http://localhost:8086**.

---

## How it works
1. A request arrives at a URL, like `POST /api/feedback`.
2. The **controller** for that URL checks the data and decides what to do.
3. The **repository** saves it to MongoDB or reads it back.
4. The answer goes back as JSON.

---

## The files

All the code is in `src/main/java/com/railway/team6/`.

| File | What it does |
|---|---|
| `Team6Application.java` | Starts the server. **Start reading here.** |
| **notification/** | |
| `NotificationController.java` | The notification URLs. Checks the data, writes the message, saves it. |
| `NotificationRepository.java` | Saves and finds notifications in MongoDB. |
| `Notification.java` | What one saved notification looks like. |
| `NotificationRequest.java` | What other teams must send us. |
| `NotificationType.java` | The 7 kinds of notification, and what each one needs. |
| `NotificationHandle.java` | A ready-made file other teams copy to send us notifications. |
| **feedback/** | |
| `FeedbackController.java` | The feedback URLs. Checks the journey is over, saves the stars, works out averages. |
| `FeedbackRepository.java` | Saves and finds feedback in MongoDB. |
| `Feedback.java` | What one saved feedback looks like. |
| `FeedbackRequest.java` | What the website sends when the user presses "Submit". |
| `Ratings.java` | The 6 star ratings. |
| `FeedbackForm.java` | What we send back to fill in the feedback page. |
| **demo/** | |
| `DemoController.java` | Fake data for showing the project (see "Try it"). |
| **security/** | |
| `JwtAuthFilter.java`, `TokenVerifier.java` | Read the Team 1 login token (or another backend's `X-Internal-Key`) |
| `Caller.java` | Who is asking; lets the controllers allow only your own notifications and feedback |
| `SecurityConfig.java` | Which URLs need which role |

Settings (port, MongoDB address, demo on/off) are in `src/main/resources/application.properties`.

---

## The URLs

`userId` is Team 1's user id (e.g. `7`). Everything except `/types` and sending needs a Team 1 login
(`Authorization: Bearer <token>`), and a customer only gets their own notifications and feedback
(someone else's answer 404). Staff and admins can see anyone's.

| Method | URL | Used by | What it does |
|---|---|---|---|
| POST | `/api/notifications` | booking-service (`X-Internal-Key`), admins | Send us a notification |
| GET | `/api/notifications/types` | Anyone | The 7 kinds of notification and what each needs |
| GET | `/api/notifications/user/{userId}` | Website | A user's notifications, newest first |
| GET | `/api/notifications/user/{userId}/unread-count` | Website (bell) | How many are unread |
| PATCH | `/api/notifications/{id}/read` | Website | Mark one as read |
| PATCH | `/api/notifications/user/{userId}/read-all` | Website | Mark all as read |
| GET | `/api/notifications/log` | Staff, admins | Every notification |
| GET | `/api/feedback/form?userId=&pnr=` | Website | Journey details for the feedback page |
| POST | `/api/feedback` | Website (the passenger themself) | Save the user's stars |
| GET | `/api/feedback/user/{userId}` | Website | A user's past feedback |
| GET | `/api/feedback` | Staff, admins | All feedback |
| GET | `/api/feedback/summary?trainNumber=` | Staff, admins | Average stars per category |
| POST | `/api/demo/journey?userId=` | Demo (yourself) | Make 7 fake notifications |
| DELETE | `/api/demo/reset` | Demo (admins) | Delete **all** notifications and feedback |

If something goes wrong, the answer says why:

```json
{ "status": 409, "error": "Conflict", "message": "Feedback for PNR 4567891234 was already submitted" }
```

---

## Where notifications come from

| Type | When | Written by |
|---|---|---|
| `BOOKING_CONFIRMED` | A booking is paid | Team 3's database (trigger) |
| `PAYMENT_CONFIRMED` | Razorpay payment verified | Team 4 (payments) |
| `BOOKING_CANCELLED` | Passengers cancelled; with the refund if it was paid | Team 3 (unpaid) / Team 4 (paid) |
| `WL_TO_RAC`, `RAC_TO_CNF` | Someone's cancellation moves a passenger up the queue | Team 3's database (trigger) |
| `JOURNEY_REMINDER` | The train leaves the boarding station within 24 hours | booking-service (every 5 seconds it checks) |
| `JOURNEY_COMPLETED` | Railway staff mark the run ARRIVED in train-service | Team 2 (train-service) |

They all go into `notification_outbox` (database/c3-booking/08_notifications.sql), and booking-service
sends them here. If we are down, they wait there and are sent when we're back.

**Live train status** comes from Team 2's train-service (`GET /api/live-status/pnr/{pnr}`); our live
status page calls it directly.

---

## Tests

```bash
TEAM6_TEST_MONGO_URI=mongodb://localhost:27017/team6_test ./mvnw test
```

They need a MongoDB; the `team6_test` database is emptied before each test. They check sending with
and without the key, that users only see their own notifications, marking read, the feedback flow
(only after JOURNEY_COMPLETED, once per PNR, only by the passenger), and the staff-only views.

---

## Try it

1. The demo URLs are **off**. To turn them on, start with `TEAM6_DEMO=true`, and start the frontend
   with `VITE_TEAM6_DEMO=true` to see the demo buttons on the notification centre.
2. Open [demo-requests.http](demo-requests.http) in VS Code. (Install the **REST Client** extension first.)
   Every request needs a login token now: log in with `POST http://localhost:3000/api/auth/login`
   and add `Authorization: Bearer <token>`.
3. Click **Send Request** above each block, from top to bottom.

To look inside MongoDB: run `mongosh team6_railway`, then `db.notifications.find()` or `db.feedback.find()`.
