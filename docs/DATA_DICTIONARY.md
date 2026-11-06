# Data Dictionary

Column definitions, nullability, keys, indexes, constraints and foreign-key actions are authoritative in [`database/mysql/01_schema.sql`](../database/mysql/01_schema.sql) and [`database/mysql/14_race_overtake_summaries.sql`](../database/mysql/14_race_overtake_summaries.sql). This dictionary summarizes each relation's grain and important fields. Where present, `record_source` separates imported, synthetic and manually entered facts.

## Competition data

| Table | One row represents | Main keys and fields |
|---|---|---|
| `seasons` | A championship year | `season_id` PK; `year` unique |
| `circuits` | A racing circuit | `circuit_id` PK; unique source key; name, location, country, optional length, provenance |
| `races` | A Grand Prix event in a season | `race_id` PK; season and circuit FKs; unique source race key; event name/date/provenance |
| `sessions` | A scheduled event session | `session_id` PK; race FK; unique race/session type and source key; optional datetime |
| `drivers` | A driver identity | `driver_id` PK; unique source key; name, number, nationality, birth date, provenance |
| `constructors` | A team identity | `constructor_id` PK; unique source key/name; country/base, provenance |
| `driver_team_seasons` | A driver's team contract for one season | `driver_team_id` PK; driver, constructor and season FKs; car number; season contract uniqueness |
| `race_results` | One driver's race classification | `result_id` PK; race and contract FKs; position, points, status, classified laps and provenance; unique race/contract |
| `qualifying_results` | One driver's qualifying classification | Composite session/contract PK and FKs; position; Q1/Q2/Q3 milliseconds; provenance |
| `lap_times` | One classified driver's lap | `lap_id` PK; result FK; lap number, optional milliseconds, personal-best flag; unique result/lap |
| `pit_stops` | One driver's numbered pit stop | `pit_stop_id` PK; result FK; stop number, lap, optional duration and reason |
| `tyre_compounds` | A tyre compound definition | `compound_id` PK; unique compound name and optional color |
| `tyre_stints` | One driver's tyre stint | `stint_id` PK; result and compound FKs; stint number, lap interval and tyre age |
| `weather_observations` | A weather reading at a session time | `observation_id` PK; session FK; timestamp and optional temperature, humidity, pressure, rain, wind and track readings |
| `race_overtake_summaries` | A source count of position exchanges for one race | `race_id` PK/FK; unique source session key; count, source and fetch time. Missing row means no coverage; stored zero means measured zero |

## Strategy, identity and operations

| Table | One row represents | Main keys and fields |
|---|---|---|
| `users` | An application account | `user_id` PK; unique email; Argon2id password hash; display name and active flag |
| `roles` | A named access role | `role_id` PK; unique name such as `ADMIN` or `ANALYST` |
| `permissions` | A protected action | `permission_id` PK; unique permission key and description |
| `user_roles` | A user's role assignment | Composite user/role PK/FKs and assignment timestamp |
| `role_permissions` | A role's allowed action | Composite role/permission PK/FKs |
| `auth_sessions` | A revocable login session | `auth_session_id` PK; user FK; unique token hash; CSRF hash, expiry and revocation times |
| `audit_logs` | A security or data-maintenance event | `audit_id` PK; nullable actor FK; action, entity type/key, time, JSON details and request ID |
| `import_runs` | An attempted data import | `import_run_id` PK; source, season/event/session, status, start/completion times, rows written and safe error summary |
| `strategy_plans` | A strategy hypothesis for a race/driver | `strategy_id` PK; race/driver/user references; strategy inputs, assumptions and creation time |
| `strategy_stints` | A proposed stint in a plan | `stint_id` PK; strategy/compound FKs; stint order, lap bounds and assumptions |
| `strategy_reports` | An analysis document for a strategy | `report_id` PK; plan reference; report text and creation time |

## Document database

MongoDB validators, indexes and field shapes are defined in [`database/mongodb/01_collections_and_indexes.js`](../database/mongodb/01_collections_and_indexes.js). Collections are `laps_telemetry`, `session_telemetry_stream`, `weather_conditions` and `strategy_documents`. Their fields and cross-store consistency limits are documented in [`MONGODB_DESIGN.md`](MONGODB_DESIGN.md).
