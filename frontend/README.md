# Frontend

One React app (Vite, Material UI) for every team's screens. In development it runs on **http://localhost:5173**, and Vite forwards each `/api` path to the service that owns it, so the browser only talks to one origin:

| Path | Service | Default target | Override |
|---|---|---|---|
| `/api/auth`, `/api/users`, `/api/admin` | Team 1, users and auth | `http://localhost:3000` | `AUTH_URL` |
| `/api/search`, `/api/runs`, `/api/bookings` | Team 3, booking-service | `http://localhost:8082` | `BOOKING_URL` |
| `/api/payments`, `/api/refunds`, `/api/concessions` | Team 4, payments app | `http://localhost:8081` | `PAYMENTS_URL` |

```bash
cd frontend
npm ci
npm run dev                                      # http://localhost:5173
PAYMENTS_URL=http://localhost:8091 npm run dev   # e.g. when 8081 is taken
```

Start the three backends first (see the root README). A new path needs a line in `vite.config.js`.

## Screens

The address is a hash route, so a page such as a PNR can be bookmarked or reloaded.

| Route | Screen | Owner |
|---|---|---|
| (no session) | Log in with Team 1's `POST /api/auth/login` | Team 3 for now, see below |
| `#/search`, `#/search/{from}/{to}/{date}` | Search trains, with availability and fare per class | Team 3 |
| `#/book/{runId}/{class}/{from}/{to}` | Passenger form, 1 to 6 passengers; holds the seats | Team 3 |
| `#/pnr/{pnr}` | Review the held booking with its 15-minute countdown and pay; PNR status; cancel passengers (unpaid) or cancel with refund (paid) | Team 3, payment and refund steps by Team 4 |
| `#/pnr` | PNR lookup | Team 3 |
| `#/bookings` | My bookings | Team 3 |
| `#/payments`, `#/refunds`, `#/concessions` | My payments, refunds, concession applications and staff review | Team 4 |

Customers see every tab. Staff and admins can search and open any PNR, but can't book; they review concessions instead.

## Code

```
src/
  api.js                  HTTP client for all three services: token, refresh, error messages
  router.js               hash router (useRoute, navigate)
  App.jsx                 layout, tabs, login gate
  features/auth/          LoginPage
  features/booking/       search, passenger form, booking/PNR page, my bookings
  components/             Team 4: checkout.js (Razorpay), MyPayments, Refunds, Concessions
```

- **Login.** The token and refresh token from Team 1 are kept in `localStorage`. An access token lasts 15 minutes. When a call gets `401`, `api.js` trades the refresh token for a new pair once and retries; if that fails too, the login page comes back. `LoginPage` is a stand-in built by Team 3 so the booking screens can be used. Team 1 should replace it with their own (registration, password reset).
- **Errors.** Team 1 and Team 3 answer `{"error": {"code", "message"}}`, Team 4 `{"error": "message"}`; `errorMessage()` in `api.js` reads both.
- **Payment.** `#/pnr/{pnr}` hands a held booking to `payForBooking()` in `components/checkout.js`. It asks Team 4 for a Razorpay order (Team 4 reads the amount from the booking), opens Razorpay Checkout, and sends the result to `/api/payments/verify`, which confirms the booking. Razorpay's `checkout.js` is loaded in `index.html`.
- **Cancelling.** An unpaid booking is cancelled by the booking service (`POST /api/bookings/{pnr}/cancel`). A paid one goes to Team 4 (`GET /api/refunds/preview/{pnr}`, then `POST /api/refunds`), which cancels the passengers and refunds them in one transaction.

## Known gaps

- **No departure or arrival times.** The schema doesn't store a train's departure time yet (Team 2), so the screens show dates only.
- **Stations are typed as codes** (`NDLS`, `MAS`, ...). There is no station list endpoint yet (Team 2).
- **General quota only, no concession at booking.** Quotas and `concession_rule` are placeholders until Teams 2 and 4 decide on them; the booking API already accepts `quotaCode` and `concessionId`.
- **No frontend tests yet.** The flow was checked end to end in headless Chrome against all three services, with Razorpay stubbed.

`npm run build` writes a static build to `dist/`. Serving it needs the same path routing as `vite.config.js`, e.g. a reverse proxy; no backend serves it.
