# Frontend (Team 3 booking demo)

The React app (Vite, Material UI) for Team 3's booking screens, trimmed to run with **only booking-service and PostgreSQL**: no Team 1 backend, no Team 4 payments app. In development it runs on **http://localhost:5173**, and Vite forwards every `/api` path the app uses to booking-service, so the browser only talks to one origin:

| Path | Served by | Default target | Override |
|---|---|---|---|
| `/api/auth` | booking-service in demo mode, answering like Team 1's auth API | `http://localhost:8082` | `BOOKING_URL` |
| `/api/search`, `/api/runs`, `/api/bookings` | booking-service | `http://localhost:8082` | `BOOKING_URL` |

```bash
cd frontend
npm ci
npm run dev                                      # http://localhost:5173
BOOKING_URL=http://localhost:8092 npm run dev    # e.g. when 8082 is taken
```

Start PostgreSQL and booking-service with `BOOKING_DEMO=true` first (see the root README). Without demo mode there is no `/api/auth` and no `demo-pay`, so login and payment fail.

Demo accounts (seeded by `database/c1-identity`; the login page offers them): `customer@example.com`, `staff@example.com`, `admin@example.com`, all with password `Railway@Dev123`.

## Screens

The address is a hash route, so a page such as a PNR can be bookmarked or reloaded.

| Route | Screen |
|---|---|
| (no session) | Log in (`POST /api/auth/login`) |
| `#/search`, `#/search/{from}/{to}/{date}` | Search trains, with availability and fare per class |
| `#/book/{runId}/{class}/{from}/{to}` | Passenger form, 1 to 6 passengers; holds the seats |
| `#/pnr/{pnr}` | Review the held booking with its 15-minute countdown and pay (simulated); PNR status; cancel passengers |
| `#/pnr` | PNR lookup |
| `#/bookings` | My bookings |

Customers see every tab. Staff and admins can search and open any PNR, but can't book.

## Code

```
src/
  api.js                  HTTP client for booking-service: token, refresh, error messages
  router.js               hash router (useRoute, navigate)
  App.jsx                 layout, tabs, login gate
  features/auth/          LoginPage
  features/booking/       search, passenger form, booking/PNR page, my bookings
```

- **Login.** `POST /api/auth/login` returns `{token, refreshToken, user}`, the same JSON as Team 1's API; both tokens are kept in `localStorage`. When a call gets `401`, `api.js` trades the refresh token (`POST /api/auth/refresh`) for a new pair once and retries; if that fails too, the login page comes back. There is no registration or password reset in the demo (Team 1's).
- **Errors.** booking-service answers `{"error": {"code", "message"}}`; `errorMessage()` in `api.js` reads it.
- **Payment (simulated).** The **Pay (demo)** button on `#/pnr/{pnr}` calls `POST /api/bookings/{pnr}/demo-pay`, which confirms the held booking without any payment gateway and answers with the booking (as `GET /api/bookings/{pnr}` does). In the full system Team 4's Razorpay checkout does this.
- **Cancelling.** Held and (demo-)paid bookings alike are cancelled with `POST /api/bookings/{pnr}/cancel` and the selected `passengerIds` (none means everyone left). No refund is made; in the full system a paid booking goes through Team 4's refunds instead.

## Known gaps

- **No departure or arrival times.** The schema doesn't store a train's departure time yet (Team 2), so the screens show dates only.
- **Stations are typed as codes** (`NDLS`, `MAS`, ...). There is no station list endpoint yet (Team 2).
- **General quota only, no concession at booking.** Quotas and `concession_rule` are placeholders until Teams 2 and 4 decide on them; the booking API already accepts `quotaCode` and `concessionId`.
- **No real payments or refunds** in this demo (Team 4's).
- **No frontend tests yet.**

`npm run build` writes a static build to `dist/`. Serving it needs the same path routing as `vite.config.js`, e.g. a reverse proxy; no backend serves it.
