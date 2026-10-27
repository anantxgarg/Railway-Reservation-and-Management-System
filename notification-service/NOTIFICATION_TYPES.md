# Team 6 – Notifications, Feedback & Live Status

Database for Team 6: **MongoDB** (not PostgreSQL). Every notification goes into one
`notifications` collection, used as a log and read newest first (`createdAt` desc).

This file lists the **notification handles** that other teams need to call from their
Spring Boot code. When your code does one of the things below, also pass the same data to
our handle. We log it and show it to the user in the bell icon (top right).

---

## How to call us

One REST endpoint for every notification type:

```
POST http://localhost:8086/api/notifications
Content-Type: application/json
```

(Our backend is this folder. `GET /api/notifications/types` lists every type and
its required fields.)

```json
{
  "type": "BOOKING_CONFIRMED",
  "userId": "u_123",
  "pnr": "4567891234",
  "sourceTeam": "team-2",
  "eventTime": "2026-10-21T14:30:00",
  "data": { "...": "fields for that type, see below" }
}
```

| Field        | Required | Notes                                          |
|--------------|----------|------------------------------------------------|
| `type`       | yes      | One of the 7 types below                       |
| `userId`     | yes      | The user who should get the notification       |
| `pnr`        | yes      | 10-digit PNR                                   |
| `sourceTeam` | yes      | Your team name, for the log                    |
| `eventTime`  | yes      | ISO-8601 `yyyy-MM-ddTHH:mm:ss`                 |
| `data`       | yes      | Fields for that type (tables below)            |

- Dates are `yyyy-MM-dd`. Times are `HH:mm`. Money is a number in INR.
- We reply `202 Accepted`. **Don't let a failed notification call fail or roll back your
  booking or payment.** Call us after your work has committed, and only log our errors.

**Easiest way from Java:** copy
[NotificationHandle.java](src/main/java/com/railway/team6/notification/NotificationHandle.java)
into your project (change its `package` line), then:

```java
NotificationHandle notify = new NotificationHandle("http://localhost:8086", "team-2");
notify.bookingConfirmed(userId, pnr, "12301", "Rajdhani Express", "2026-12-15",
                        "NDLS", "BCT", "3A", 2, "CNF");
```

Each method sends the JSON above. It never throws: if we're down, it logs a warning and returns `false`.

---

## Handles

### 1. `BOOKING_CONFIRMED` (Booking team)
```java
void bookingConfirmed(String userId, String pnr, String trainNumber, String trainName,
                      String journeyDate, String fromStation, String toStation,
                      String travelClass, int passengerCount, String bookingStatus);
```
| data field       | example        |
|------------------|----------------|
| `trainNumber`    | `"12301"`      |
| `trainName`      | `"Rajdhani Express"` |
| `journeyDate`    | `"2026-12-15"` |
| `fromStation`    | `"NDLS"`       |
| `toStation`      | `"BCT"`        |
| `travelClass`    | `"3A"`         |
| `passengerCount` | `2`            |
| `bookingStatus`  | `"CNF"` / `"RAC"` / `"WL"` / `"PARTIAL"` |

### 2. `BOOKING_CANCELLED` (Booking / Cancellation team)
```java
void bookingCancelled(String userId, String pnr, String trainNumber, String journeyDate,
                      int cancelledPassengers, double refundAmount, String reason);
```
| data field            | example        |
|-----------------------|----------------|
| `trainNumber`         | `"12301"`      |
| `journeyDate`         | `"2026-12-15"` |
| `cancelledPassengers` | `1`            |
| `refundAmount`        | `655.00`       |
| `reason`              | `"User cancelled"` (optional) |

### 3. `PAYMENT_CONFIRMED` (Payments team)
```java
void paymentConfirmed(String userId, String pnr, String razorpayPaymentId,
                      String razorpayOrderId, double amount, String paidAt);
```
| data field          | example                 |
|---------------------|-------------------------|
| `razorpayPaymentId` | `"pay_N1abc..."`        |
| `razorpayOrderId`   | `"order_N1xyz..."`      |
| `amount`            | `3440.00`               |
| `paidAt`            | `"2026-10-21T14:29:55"` |

### 4. `JOURNEY_REMINDER` (whichever team runs the schedule job; Team 6 can do this if no one else does)
```java
void journeyReminder(String userId, String pnr, String trainNumber, String trainName,
                     String journeyDate, String departureTime, String boardingStation,
                     String coach, String seat);
```
| data field        | example        |
|-------------------|----------------|
| `trainNumber`     | `"12301"`      |
| `trainName`       | `"Rajdhani Express"` |
| `journeyDate`     | `"2026-12-15"` |
| `departureTime`   | `"17:00"`      |
| `boardingStation` | `"NDLS"`       |
| `coach`           | `"A1"`         |
| `seat`            | `"23"`         |

### 5. `WL_TO_RAC` (Booking / Waitlist team)
```java
void waitlistToRac(String userId, String pnr, String passengerName,
                   String oldStatus, String newStatus);
```
| data field      | example     |
|-----------------|-------------|
| `passengerName` | `"Rahul Kumar"` |
| `oldStatus`     | `"WL 12"`   |
| `newStatus`     | `"RAC 4"`   |

### 6. `RAC_TO_CNF` (Booking / Waitlist team)
```java
void racToConfirmed(String userId, String pnr, String passengerName,
                    String oldStatus, String coach, String seat);
```
| data field      | example     |
|-----------------|-------------|
| `passengerName` | `"Rahul Kumar"` |
| `oldStatus`     | `"RAC 4"`   |
| `coach`         | `"A1"`      |
| `seat`          | `"23"`      |

### 7. `JOURNEY_COMPLETED` (Train status team, Siddhi's group). Opens the feedback form.
This one comes from the feedback flow: *Journey Completed → Notification → Feedback form*.
These fields fill the "Journey Details" card on the form.
```java
void journeyCompleted(String userId, String pnr, String trainNumber, String trainName,
                      String journeyDate, String fromStation, String toStation,
                      String departureTime, String arrivalTime,
                      String passengerName, String coach, String seat);
```
| data field      | example        |
|-----------------|----------------|
| `trainNumber`   | `"12301"`      |
| `trainName`     | `"Rajdhani Express"` |
| `journeyDate`   | `"2026-12-15"` |
| `fromStation`   | `"NDLS"`       |
| `toStation`     | `"BCT"`        |
| `departureTime` | `"17:00"`      |
| `arrivalTime`   | `"08:35"`      |
| `passengerName` | `"Rahul Kumar"` |
| `coach`         | `"A1"`         |
| `seat`          | `"23"`         |

---

## What we store (MongoDB, `notifications` collection)

```json
{
  "_id": "ObjectId",
  "userId": "u_123",
  "type": "BOOKING_CONFIRMED",
  "pnr": "4567891234",
  "sourceTeam": "team-2",
  "data": { },
  "read": false,
  "eventTime": "2026-10-21T14:30:00",
  "createdAt": "2026-10-21T14:30:01"
}
```
Index: `{ userId: 1, createdAt: -1 }`, so each user's list comes back newest first.
