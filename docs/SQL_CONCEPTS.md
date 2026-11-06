# SQL Concepts and Demonstrations

The runnable SQL examples are under `database/mysql/`. Execute against a disposable MySQL 8 database initialized with the provided scripts.

| Category | File | Purpose / expected result | Viva explanation | Status |
|---|---|---|---|---|
| DDL and constraints | `01_schema.sql` | Creates normalized relations, keys, checks, indexes and referential actions | Explain why a fact is a separate relation and how a foreign key prevents orphan rows | Executed and verified on MySQL 8.4 |
| Reference and seed rows | `02_reference_and_synthetic_seed.sql` | Idempotently inserts fictional demo identities and race results labeled `synthetic` | Explain upsert idempotency and provenance | Executed and verified on MySQL 8.4 |
| INNER and multi-table joins | `10_query_demonstrations.sql` | Lists results with event, driver, constructor and season | Each join follows a declared FK path | Written; execution of the full demo script remains unverified |
| LEFT JOIN and aggregation | `10_query_demonstrations.sql` | Retains drivers with no result and counts starts | LEFT JOIN preserves unmatched left-side rows | Written; execution of the full demo script remains unverified |
| Nested query | `10_query_demonstrations.sql` | Finds drivers with a win and compares average finish with the field | Inner query supplies a set or aggregate to the outer query | Written; execution of the full demo script remains unverified |
| Correlated query | `10_query_demonstrations.sql` | Finds fastest lap per event and above-average pit stops per event | Inner query refers to the current outer event | Written; execution of the full demo script remains unverified |
| Nonrecursive CTE | `10_query_demonstrations.sql` | Summarizes points and average finish per season/driver | CTE names an intermediate result for readability | Written; execution of the full demo script remains unverified |
| Window functions | `10_query_demonstrations.sql`; `GET /api/analytics/laps` | Ranks lap pace and computes within-event/lap mean and previous-lap deltas without collapsing rows | `RANK`, `AVG OVER`, and `LAG` operate across defined partitions | Written; execution of the full demo script remains unverified |
| Recursive CTE | `10_query_demonstrations.sql` | Generates lap numbers through the maximum observed lap for a selected demo race | Anchor is lap 1; recursive member adds 1; max-lap predicate terminates recursion | Written; execution of the full demo script remains unverified |
| Transactions and DML | `10_query_demonstrations.sql` | Demonstrates insert, select, update, delete, and rollback using synthetic rows | Transaction makes a multi-step operation atomic; rollback leaves fixture unchanged | Written; execution of the full demo script remains unverified |
| Views | `11_views.sql` | Driver season standings and race pit-stop summary | View packages a reusable query, not a separate source of truth | Executed and verified on MySQL 8.4 |
| Function | `12_routines_and_triggers.sql` | Returns average available lap time in milliseconds | Aggregate ignores NULL measurements; no data returns NULL | Executed and verified on MySQL 8.4 |
| Procedure | `12_routines_and_triggers.sql` | Returns a driver's season summary | Inputs are typed and filtering is parameterized | Executed and verified on MySQL 8.4 |
| Triggers | `12_routines_and_triggers.sql` | Reject a race result whose driver contract is from another season; audit strategy-plan updates | A cross-table season rule cannot be expressed as a simple CHECK; audit capture is centralized | Executed and verified on MySQL 8.4 |

MySQL's `DELIMITER` is a command-line client directive used to submit stored program bodies; it is not a server SQL statement. Core DDL, seed, views, routines, triggers, privilege grants and constraint checks were exercised on MySQL 8.4. The full query/DML demonstration script still needs a clean disposable-database run before every query row can be called verified.
