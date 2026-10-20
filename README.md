# Razorpay Payment Gateway Prototype

Spring Boot 3 / Java 17 prototype covering **payments, refunds and passenger concessions** for a ticket booking system. The booking module here is only a stand-in; swap it for the group's real one later.

## Run

1. Get **test mode** keys: Razorpay Dashboard → Account & Settings → API Keys.
2. Set env vars (or edit `application.properties`):
   ```bash
   export RAZORPAY_KEY_ID=rzp_test_xxxxxxxx
   export RAZORPAY_KEY_SECRET=xxxxxxxx
   export RAZORPAY_WEBHOOK_SECRET=any_string_you_choose
   mvn spring-boot:run
   ```
3. Open http://localhost:8080 for the web UI (use the port you set in `server.port`; 8081 if 8080 is taken).

## Frontend

Plain HTML, CSS and JavaScript in `src/main/resources/static/`, served by Spring Boot on the same port as the API, so there is no build step and no CORS setup.

| File | Purpose |
|---|---|
| `index.html` | Two views: **Book a ticket** and **Manage booking** (hash routes `#/book`, `#/manage/{id}`) |
| `css/style.css` | All styling, with light and dark themes |
| `js/app.js` | Form validation, live fare, Razorpay Checkout, payment verification, refund flow |

Changes are picked up by refreshing the browser. If you use IntelliJ, rebuild or restart so `static/` is copied to `target/classes`.

Before going live: delete the "Testing with Razorpay test mode?" block in `index.html`.

Default DB is in-memory H2 (zero setup). MySQL config is commented in `application.properties`.

## Flow

```
POST /api/bookings            -> concession applied, status PENDING_PAYMENT
POST /api/payments/order      -> Razorpay order for finalAmount
   (browser: Razorpay Checkout)
POST /api/payments/verify     -> signature check, status CONFIRMED
POST /api/payments/webhook    -> same result via Razorpay callback (safety net)
GET  /api/refunds/preview/{bookingId}
POST /api/refunds             -> cancels booking, refunds per policy
```

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/concessions/preview?category=STUDENT&baseFare=500` | Fare after concession |
| POST | `/api/bookings` | Create booking |
| GET | `/api/bookings/{id}` | Booking details/status |
| POST | `/api/payments/order` | `{ "bookingId": 1 }` |
| POST | `/api/payments/verify` | `{ razorpayOrderId, razorpayPaymentId, razorpaySignature }` |
| POST | `/api/payments/webhook` | Razorpay callback |
| GET | `/api/payments/booking/{id}` | Payments for a booking |
| GET | `/api/refunds/preview/{bookingId}` | What a cancellation would refund |
| POST | `/api/refunds` | `{ "bookingId": 1, "reason": "..." }` |
| GET | `/api/refunds/booking/{id}` | Refunds for a booking |

Example booking:
```json
{
  "passengerName": "Asha", "email": "asha@example.com", "phone": "9999999999",
  "origin": "Pune", "destination": "Mumbai",
  "departureTime": "2026-10-20T18:30:00",
  "category": "STUDENT", "baseFare": 500
}
```

## Concession rules (`application.properties`)

Percent off base fare: GENERAL 0, SENIOR_CITIZEN 40, STUDENT 25, CHILD 50, DIFFERENTLY_ABLED 50, ARMED_FORCES 30. These are placeholder numbers; change them to whatever the group agrees on.

## Refund policy (`application.properties`)

Refund is a percentage of the **amount actually paid** (after concession):

| Time before departure | Refund |
|---|---|
| 48h or more | 90% |
| 24h to 48h | 75% |
| 4h to 24h | 50% |
| under 4h | not refundable |

## Webhook setup (optional for local testing)

1. Expose your app: `ngrok http 8080`.
2. Dashboard → Webhooks → Add: URL `https://<ngrok>/api/payments/webhook`, secret = `RAZORPAY_WEBHOOK_SECRET`.
3. Enable events: `payment.captured`, `payment.failed`, `refund.processed`, `refund.failed`.

## Testing in test mode

- Card: `4111 1111 1111 1111`, any future expiry, any CVV, any OTP.
- UPI: `success@razorpay` (success) or `failure@razorpay` (failure).
- Make sure payments are set to **auto-capture** in Dashboard → Settings → Configuration → Payment Capture, otherwise they stay "authorized" and refunds will fail.

## Things to revisit once the full system is defined

- Replace `Booking` with the real booking/seat module (keep `bookingId` as the link).
- Move concession and refund rules to a DB table or admin config.
- Add authentication; today anyone can call the refund endpoint.
- Partial cancellations (multi-passenger tickets), GST/convenience fee handling.
- Reconciliation job for orders stuck in `CREATED`.
