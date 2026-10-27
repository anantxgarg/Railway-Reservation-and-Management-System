# Frontend

One React app (Vite, react-router, Material UI) for every team's screens. In development it runs on **http://localhost:5173**, and Vite forwards each `/api` path to the service that owns it, so the browser only talks to one origin:

| Path | Service | Default target | Override |
|---|---|---|---|
| `/api/auth`, `/api/users`, `/api/admin`, `/health` | Team 1, users and auth | `http://localhost:3000` | `AUTH_URL` |
| `/api/search`, `/api/runs`, `/api/bookings` | Team 3, booking-service | `http://localhost:8082` | `BOOKING_URL` |
| `/api/payments`, `/api/refunds`, `/api/concessions` | Team 4, payments app | `http://localhost:8081` | `PAYMENTS_URL` |

```bash
cd frontend
npm ci
npm run dev                                      # http://localhost:5173
PAYMENTS_URL=http://localhost:8091 npm run dev   # e.g. when 8081 is taken
```

Start the backends first (see the root README). A new path needs a line in `vite.config.js`.

## Screens

| Route | Screen | Who | Owner |
|---|---|---|---|
| `/login`, `/register`, `/forgot-password`, `/reset-password` | Sign in, create an account, reset a password | everyone | Team 1 |
| `/admin/login` | Admin-only sign in (`POST /api/auth/admin-login`) | admins | Team 1 |
| `/search`, `/search/{from}/{to}/{date}` | Search trains, with availability and fare per class | all | Team 3 |
| `/book/{runId}/{class}/{from}/{to}` | Passenger form, 1 to 6 passengers; holds the seats | customers | Team 3 |
| `/pnr/{pnr}` | Review the held booking with its 15-minute countdown and pay; PNR status; cancel passengers (unpaid) or cancel with refund (paid) | all | Team 3, payment and refund steps by Team 4 |
| `/pnr` | PNR lookup | all | Team 3 |
| `/bookings` | My bookings | customers | Team 3 |
| `/payments`, `/refunds`, `/concessions` | My payments, refunds, concession applications and staff review | customers (`/payments`), all | Team 4 |
| `/account` | Profile and change password | customers, staff | Team 1 |
| `/admin` | Profile, user lookup, unlock account, change password | admins | Team 1 |

Staff and admins can search and open any PNR, but can't book; they review concessions instead.

## Code

```
src/
  App.jsx                 routes: public account pages, and the logged-in app inside AppShell
  tabs.jsx                the logged-in app's tabs and which roles see them
  components/AppShell.jsx header, tabs and Material UI theme of the logged-in app
  router.js               navigate() for the booking/payment screens, bridged to react-router
  api.js                  HTTP client for the booking and payments services
  theme.js                Material UI theme (dark)

  # Team 1: accounts
  pages/                  Login, Register, ForgotPassword, ResetPassword, AdminLogin, Unauthorized
  pages/destinations/     account pages shown in the app (customer, staff, admin)
  context/                AuthContext (session), ThemeContext (light/dark for the account pages)
  services/api.js         HTTP client for Team 1's API
  services/session.js     token refresh and session expiry, shared by both clients
  utils/                  token storage, validation, roles

  # Team 3: booking
  features/booking/       search, passenger form, booking/PNR page, my bookings

  # Team 4: payments
  components/             checkout.js (Razorpay), MyPayments, Refunds, Concessions
```

- **Login.** Team 1's pages sign in and keep the access token, refresh token and user in `localStorage` (`utils/tokenStorage.js`). Both HTTP clients send the token. When a call gets `401`, the refresh token is traded for a new pair once (`services/session.js`, one refresh at a time) and the call retried; if that fails too, the login page comes back with a message.
- **Themes.** The account pages have Team 1's light and dark themes. The logged-in app is dark; it switches Team 1's cards to dark while it is shown.
- **Errors.** Team 1 and Team 3 answer `{"error": {"code", "message"}}`, Team 4 `{"error": "message"}`; `errorMessage()` in `api.js` reads both.
- **Payment.** `/pnr/{pnr}` hands a held booking to `payForBooking()` in `components/checkout.js`. It asks Team 4 for a Razorpay order (Team 4 reads the amount from the booking), opens Razorpay Checkout, and sends the result to `/api/payments/verify`, which confirms the booking. Razorpay's `checkout.js` is loaded in `index.html`.
- **Cancelling.** An unpaid booking is cancelled by the booking service (`POST /api/bookings/{pnr}/cancel`). A paid one goes to Team 4 (`GET /api/refunds/preview/{pnr}`, then `POST /api/refunds`), which cancels the passengers and refunds them in one transaction.

`npm run build` writes a static build to `dist/`. Serving it needs the same path routing as `vite.config.js` (e.g. a reverse proxy) and a fallback to `index.html` for the app's routes.

Node 18 runs everything; react-router asks for Node 20 and prints an `EBADENGINE` warning on `npm ci`, which is harmless.
