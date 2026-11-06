# API Documentation

FastAPI serves interactive OpenAPI docs at `/docs` and an OpenAPI JSON document at `/openapi.json` when the service is running.

| Method and path | Access | Current purpose |
|---|---|---|
| `GET /health/live` | Public | Process liveness |
| `POST /api/auth/login` | Public | Verify credentials and issue database-backed session plus CSRF cookie |
| `POST /api/auth/register` | Public | Create an Analyst account; clients cannot request elevated roles |
| `GET /api/auth/me` | Session | Return current identity, roles and CSRF token |
| `POST /api/auth/logout` | Session + CSRF header | Revoke session and clear cookies |
| `GET /api/dashboard/summary` | Public read | Query imported race, driver, constructor and classification-record counts plus average finish |
| `GET /api/analytics/season-summary` | Public read | Per-season data coverage, average recorded overtakes per covered race, and overtake-source coverage |
| `GET /api/analytics/championship?season={year}&category=drivers%7Cconstructors` | Public read | Aggregate points, wins, podiums and starts from imported results |
| `GET /api/analytics/season-champions` | Public read | Identify the driver and constructor champion and their points for each season |
| `GET /api/analytics/driver-comparison?driver_ids={id}&driver_ids={id}&season={year}` | Public read | Compare starts, points, average finish, race wins and qualifying poles for selected drivers and optional season |
| `GET /api/analytics/race-podiums?season={year}` | Public read | Return each imported race and its first-, second- and third-place drivers/constructors for the selected season |
| `GET /api/races` | Public read | Paginated race events, source labels, result count, race distance and overtake count when available |
| `GET /api/races/{race_id}/drivers` | Public read | Drivers with an imported result for that exact race |
| `GET /api/circuits?season={year}` | Public read | Imported circuits, length metadata, race count and active seasons for the track-layout workspace |
| `GET /api/analytics/laps` | Public read | Lap times with SQL window rank, race/lap mean and delta |
| `GET /api/analytics/pit-stops` | Public read | Recorded pit stop details for one event |
| `GET /api/analytics/tyre-stints` | Public read | Recorded compound/stint sequence for one event |
| `GET /api/drivers` | Public read | Paginated/searchable driver summaries |
| `GET /api/admin/users` | `users:manage` | List accounts and role assignments |
| `POST /api/admin/users` | `users:manage` | Create a user and assign roles |
| `PUT /api/admin/users/{user_id}/roles` | `users:manage` | Replace role assignments |
| `GET /api/admin/audit` | `audit:read` | Read paginated audit entries |
| `GET /api/admin/races/{race_id}/entrants` | `data:import` | List season-valid driver/constructor pairs and whether a race result already exists |
| `GET /api/admin/race-results` | `data:import` | List race classifications and dependent lap, pit-stop and stint counts |
| `POST /api/admin/race-results` | `data:import` + CSRF | Add a missing manual race classification, validated against the selected season contract |
| `PUT /api/admin/race-results/{result_id}` | `data:import` + CSRF | Update a classification and write an audit entry |
| `DELETE /api/admin/race-results/{result_id}` | `data:import` + CSRF | Delete a classification; dependent lap, stop and stint rows cascade and are audited |
| `GET /api/admin/sessions` | `data:import` | List sessions with race, season, provenance and linked qualifying-entry count |
| `POST /api/admin/sessions` | `data:import` + CSRF | Add a manually managed session to an existing race |
| `PUT /api/admin/sessions/{session_id}` | `data:import` + CSRF | Edit manual session type/date or edit the date of a source session; source session type is locked |
| `DELETE /api/admin/sessions/{session_id}` | `data:import` + CSRF | Delete session metadata and linked qualifying entries; race classifications and lap records remain |
| `GET /api/ingestion/history` | `data:import` | Review FastF1 import run status and row counts |
| `POST /api/ingestion/fastf1/race` | `data:import` + CSRF | Fetch one FastF1 race session and persist imported classifications, laps and tyre stints |
| `POST /api/ingestion/jolpica/season` | `data:import` + CSRF | Start an idempotent public season import (classification, qualifying and pit stops; optional lap times); returns a run ID tracked in import history |
| `GET /api/strategy-documents` | `race:read` | Filter flexible strategy documents in MongoDB |
| `POST /api/strategy-documents` | `strategy:write` | Validate MySQL parent plan and create MongoDB document |
| `PATCH /api/strategy-documents/{strategy_id}` | `strategy:write` | Update selected document fields |
| `DELETE /api/strategy-documents/{strategy_id}` | `strategy:write` | Delete a strategy document |
| `POST /api/strategy-plans/simulate` | `strategy:write` + CSRF | Estimate and save a hypothetical pace/degradation/pit-loss strategy in MySQL |
| `POST /api/strategy-plans/compare` | `strategy:write` + CSRF | Save and compare balanced one-stop and two-stop scenarios for a selected race entrant; returns both estimates, the difference, and the baseline source |

List endpoints validate page bounds and use bound SQL parameters. Strategy comparison validates that the selected driver has a result in the exact race, then saves a one-stop and two-stop balanced-lap scenario in a single transaction. It uses that driver's recorded event mean lap time where available; otherwise it returns a clearly labelled generic fallback or accepts an optional user baseline. The UI shows both totals and the modeled time difference inline. The model does not use actual tyre compounds, weather, traffic or telemetry. Championship and podium data are derived from imported database rows and are not a live F1.com feed. Responses use stable JSON error details rather than exposing database exceptions. Database-backed routes remain subject to integration testing.

FastF1 import is limited to a single race session per request. It validates source lap identifiers, creates source-labelled race and participant rows, and records success/failure in `import_runs`. Rows missing driver identity, number, team, or event date fail the transaction. The separate Jolpica season importer provides public race classifications, lap times, and pit stops; it deliberately leaves telemetry, weather, and tyre compound fields absent. Current FastF1 versions require an authenticated F1TV account for protected timing data.
