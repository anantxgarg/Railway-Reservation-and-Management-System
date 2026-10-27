# Team 6 Backend

This is the server for Team 6. It does two jobs:

- **Notifications.** Other teams tell us when something happens (a booking, a payment, a waitlist
  change...). We save it. Our website shows it under the bell icon.
- **Feedback.** When a journey is over, the passenger gives it stars (1 to 10) in 6 categories,
  and can write a comment.

Built with **Spring Boot 3** and **Java 17** (the same as the other teams). Data is saved in **MongoDB**.

What other teams should send us is in [NOTIFICATION_TYPES.md](NOTIFICATION_TYPES.md).

---

## Start it

You need:

- **Java 17** or newer
- **MongoDB**, running on your computer (on Windows it's the "MongoDB" service)

Then run:

```powershell
cd notification-service
.\mvnw.cmd spring-boot:run
```

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

Settings (port, MongoDB address, demo on/off) are in `src/main/resources/application.properties`.

---

## The URLs

| Method | URL | Used by | What it does |
|---|---|---|---|
| POST | `/api/notifications` | Other teams | Send us a notification |
| GET | `/api/notifications/types` | Anyone | The 7 kinds of notification and what each needs |
| GET | `/api/notifications/user/{userId}` | Website | A user's notifications, newest first |
| GET | `/api/notifications/user/{userId}/unread-count` | Website (bell) | How many are unread |
| PATCH | `/api/notifications/{id}/read` | Website | Mark one as read |
| PATCH | `/api/notifications/user/{userId}/read-all` | Website | Mark all as read |
| GET | `/api/notifications/log` | Admin | Every notification |
| GET | `/api/feedback/form?userId=&pnr=` | Website | Journey details for the feedback page |
| POST | `/api/feedback` | Website | Save the user's stars |
| GET | `/api/feedback/user/{userId}` | Website | A user's past feedback |
| GET | `/api/feedback` | Admin | All feedback |
| GET | `/api/feedback/summary?trainNumber=` | Admin | Average stars per category |
| POST | `/api/demo/journey?userId=` | Demo | Make 7 fake notifications |
| DELETE | `/api/demo/reset` | Demo | Delete **all** notifications and feedback |

If something goes wrong, the answer says why:

```json
{ "status": 409, "error": "Conflict", "message": "Feedback for PNR 4567891234 was already submitted" }
```

---

## Try it

1. The demo URLs are **off** right now. To turn them on, set `team6.demo.enabled=true` in
   `application.properties` and restart the server.
2. Open [demo-requests.http](demo-requests.http) in VS Code. (Install the **REST Client** extension first.)
3. Click **Send Request** above each block, from top to bottom.

To look inside MongoDB: run `mongosh team6_railway`, then `db.notifications.find()` or `db.feedback.find()`.

---

## TO DO (Anant / Team leader's work):

- **Login.** For now the user is passed in the URL (`userId`). Later it should come from the
  login team's token.
- **Live train status.** Link Siddhi's group's backend (the Train statuses one) with our backend so that we can easily fetch a JSON response from them by providing PNR as parameter. Then, to process this and display it in our page. Frontend is all done, backend part has to be done.
