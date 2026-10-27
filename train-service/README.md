# train-service (Team 2)

REST API for the railway network: trains, stations, travel classes, coaches, routes and their stops, weekly schedules, dated runs, and live train status. Spring Boot 3 / Java 17 on port **8083**, over the C2 tables of the shared database ([`database/c2-network`](../database/c2-network/README.md)).

## Run

Build the shared database first (`database/setup.sh`, see the root README), then:

```bash
cd train-service
PGHOST=localhost PGUSER=postgres PGPASSWORD=... JWT_SECRET=<Team 1's secret> ./mvnw spring-boot:run
```

| Variable | Default | |
|---|---|---|
| `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` | `localhost`, `5432`, `railway`, `postgres`, empty | Same as `setup.sh` and the other backends |
| `JWT_SECRET` | none, required | Team 1's signing secret; logins are Team 1's |
| `TRAIN_PORT` | `8083` | |

## Who may do what

- **Anyone:** read the network and a run's live status (`GET`).
- **Logged in:** live status by PNR, for the booking's owner (others get 404), staff and admins.
- **Staff and admins:** set a run's status and delay.
- **Admins:** everything else that changes the network (`POST`, `DELETE`).

Send `Authorization: Bearer <token>` from Team 1's `POST /api/auth/login`. Errors have the same shape as the other services: `{"error": {"code", "message", "constraint"}}`; a database rule that refuses a change is named in `constraint` (e.g. `trg_validate_route_sequence`).

## Endpoints

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/api/trains`, `/api/trains/{trainNo}` | anyone | Trains (`trainNo` is text, e.g. `"12952"`) |
| POST, DELETE | `/api/trains`, `/api/trains/{trainNo}` | admin | Add or update, delete (409 `IN_USE` if the train has runs) |
| GET | `/api/stations`, `/api/stations/{code}` | anyone | Stations with city, state, zone, platforms |
| POST, DELETE | `/api/stations`, `/api/stations/{code}` | admin | |
| GET | `/api/travel-classes`, `/api/travel-classes/{code}` | anyone | Classes, seats per coach, fare per km |
| POST, DELETE | `/api/travel-classes`, `/api/travel-classes/{code}` | admin | |
| GET | `/api/coaches`, `/api/coaches/train/{trainNo}`, `/api/coaches/train/{trainNo}/{coachNo}` | anyone | Coaches of a train |
| POST, DELETE | `/api/coaches`, `/api/coaches/train/{trainNo}/{coachNo}` | admin | |
| GET | `/api/routes`, `/api/routes/{routeId}` | anyone | Routes; one route with its stops and clock times |
| POST, DELETE | `/api/routes`, `/api/routes/{routeId}` | admin | `{routeCode, routeName, departureTime: "16:55"}`, by `routeCode`; returns `routeId` |
| GET | `/api/route-stations`, `/api/route-stations/train/{trainNo}` | anyone | Stops of every route, or of the routes a train follows, with `arrivalTime`, `departureTime`, `dayOffset` |
| POST | `/api/route-stations` | admin | `{routeId, stopSeq, stationCode, distanceKm, arrivalOffset, departureOffset}` (minutes after the route departs); `dayOffset` is worked out by the database |
| DELETE | `/api/route-stations/route/{routeId}/{stopSeq}` | admin | |
| GET | `/api/schedules`, `/api/schedules/train/{trainNo}`, `/api/schedules/train/{trainNo}/{runDay}` | anyone | Weekdays and routes. `runDay` is `Monday` or `MON` |
| POST, DELETE | `/api/schedules`, `/api/schedules/train/{trainNo}/{runDay}` | admin | `{trainNo, runDay, routeId}` |
| GET | `/api/schedules/runs`, `/runs/{runId}`, `/runs/train/{trainNo}`, `/runs/date/{yyyy-MM-dd}` | anyone | Dated runs with `status` and `delayMinutes` |
| POST, DELETE | `/api/schedules/runs`, `/api/schedules/runs/{runId}` | admin | |
| POST | `/api/schedules/runs/generate?days=30` | admin | Create the missing runs for every scheduled day (1–120 days) |
| PATCH | `/api/schedules/runs/{runId}/status` | staff, admin | `{status, delayMinutes}`; `ARRIVED` notifies passengers (below) |
| GET | `/api/live-status/run/{runId}` | anyone | Station by station: scheduled and expected times, and where the train is |
| GET | `/api/live-status/pnr/{pnr}` | owner, staff, admin | The same for the run a PNR is on, with the boarding and destination stops |

### Live status

There is no GPS feed: the position is worked out from the timetable (route departure + stop offsets), the run's delay and its status, as reported by staff. Each stop gets `scheduledArrival`/`scheduledDeparture`, `expectedArrival`/`expectedDeparture` (scheduled + delay), and a status: `DEPARTED`, `AT_STATION`, `NEXT`, `EXPECTED`, `ARRIVED` (last stop reached) or `CANCELLED`. Times are ISO-8601 with `+05:30`. Team 6's live status page in the frontend shows it.

### Notifications

Marking a run `ARRIVED` calls `queue_journey_completed(run)` (database/c3-booking/08_notifications.sql) in the same transaction: each paid booking on the run gets Team 6's `JOURNEY_COMPLETED` notification, which opens their feedback form. booking-service delivers it.

## Tests

```bash
PGHOST=localhost PGUSER=postgres ./train-service/run_tests.sh   # rebuilds railway_test, then mvn test
```

API tests against `railway_test` (rolled back after each test): reading the network, building a train with its route and schedule as an admin, permissions, database rules as readable errors, run status and the "journey completed" notification, live status for future, finished and cancelled runs, and by PNR.
