# Relational Schema

This dictionary corresponds to the current MySQL DDL in `database/mysql/01_schema.sql`. All relations use InnoDB. `record_source` is carried on source facts so offline synthetic records can be distinguished from imported and manually entered rows.

| Relation | Primary key | Candidate/unique keys | Foreign keys and cardinality | Important constraints |
|---|---|---|---|---|
| `drivers` | `driver_id` | `source_driver_key` | none | optional driver number 1-99; source key nullable for unknown source |
| `constructors` | `constructor_id` | `source_constructor_key`, `name` | none | constructor name required |
| `seasons` | `season_id` | `year` | none | year 1950-2100 |
| `circuits` | `circuit_id` | `source_circuit_key` | none | optional positive decimal circuit length |
| `driver_team_seasons` | `driver_team_id` | (`driver_id`,`constructor_id`,`season_id`), (`constructor_id`,`season_id`,`car_number`) | driver, constructor, season each 1-to-many | supports substitute/team changes within a season; unique car number within constructor/season |
| `races` | `race_id` | `source_race_key`, (`season_id`,`race_name`) | season and circuit each 1-to-many | race date/name required; indexed by date |
| `sessions` | `session_id` | (`race_id`,`session_type`), `source_session_key` | race 1-to-many | type constrained by ENUM |
| `race_results` | `result_id` | (`race_id`,`driver_team_id`) | race and contract each 1-to-many | nullable position; nonnegative points; trigger validates the contract's season |
| `qualifying_results` | (`session_id`,`driver_team_id`) | same as primary key | session and contract each 1-to-many | optional Q1/Q2/Q3 milliseconds; trigger validates season membership |
| `lap_times` | `lap_id` | (`result_id`,`lap_number`) | result 1-to-many | positive lap number; missing time is NULL |
| `pit_stops` | `pit_stop_id` | (`result_id`,`stop_number`) | result 1-to-many | positive stop number; optional nonnegative duration |
| `tyre_compounds` | `compound_id` | `name` | none | normalized compound lookup |
| `tyre_stints` | `stint_id` | (`result_id`,`stint_number`) | result and compound each 1-to-many | positive start lap; end lap nullable or >= start |
| `weather_observations` | `observation_id` | (`session_id`,`observed_at`) | session 1-to-many | nullable sensor values; humidity 0-100; source retained |
| `users` | `user_id` | `email` | none | unique email; stores only Argon2id hash |
| `strategy_plans` | `plan_id` | none | race and driver each 1-to-many; optional creator user | trigger requires driver contract in race season; assumptions stored as JSON |
| `strategy_stints` | `strategy_stint_id` | (`plan_id`,`stint_number`) | plan and compound each 1-to-many | positive bounded lap range |
| `strategy_reports` | `report_id` | none | plan 1-to-many | report content and metadata |
| `roles` | `role_id` | `name` | none | unique role name |
| `permissions` | `permission_id` | `permission_key` | none | unique permission key |
| `user_roles` | (`user_id`,`role_id`) | same | users and roles many-to-many | cascading removal of assignment |
| `auth_sessions` | `auth_session_id` | `token_hash` | user 1-to-many | digest only, CSRF digest, expiry and revocation timestamp |
| `role_permissions` | (`role_id`,`permission_id`) | same | roles and permissions many-to-many | cascading removal of assignment |
| `audit_logs` | `audit_id` | none | optional actor user 1-to-many | append-oriented action and JSON details; actor set NULL on account deletion |
| `import_runs` | `import_run_id` | none | no hard FK to season/event (preserves failed preview/import attempt) | source, selected year/event/session, status, timestamps, row count, error summary |

## Referential behavior

- Child measurements and results cascade when their race-result parent is removed; sessions cascade from a race.
- Reference facts such as drivers, constructors, seasons, and circuits use `RESTRICT` to prevent deleting facts still referenced by records.
- User role/session rows cascade on user removal. Audit actor becomes NULL to preserve the event record.
- MongoDB identifiers are validated at the service boundary; cross-database foreign keys are not available.

The season-consistency rules span multiple relations and cannot be written as a simple `CHECK`; triggers enforce them for race results, qualifying entries and strategy plans. Trigger execution and constraint checks were verified on MySQL 8.4; see `TESTING.md` for remaining DML demonstration coverage.
