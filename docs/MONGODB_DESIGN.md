# MongoDB Design

## Collections

- `laps_telemetry`: one document per race, driver and lap, containing optional sector durations and speed traps.
- `session_telemetry_stream`: a bounded time window of nested telemetry samples for one session and driver.
- `weather_conditions`: one observation per session timestamp.
- `strategy_documents`: flexible report metadata and analysis content, keyed by the corresponding relational strategy plan.

MySQL remains authoritative for race, driver, and session identifiers. MongoDB stores those stable IDs as scalar values and cannot enforce foreign keys across stores. The strategy-document API verifies its relational strategy-plan parent before writing. The telemetry demo uses synthetic data and is not wired to a live importer. Duplicate telemetry keys are rejected through unique compound indexes. Parent deletion requires explicit cleanup; no automatic reconciliation worker currently exists.

## Validation, indexes, and examples

`database/mongodb/01_collections_and_indexes.js` creates or updates strict JSON Schema validators and retrieval indexes. `02_rud_and_aggregation_demo.js` demonstrates upsert, projected read, update, aggregation, and deletion using an explicitly synthetic fixture.

High-frequency samples are grouped into bounded windows to avoid unbounded growing documents. Numeric observations may be absent; null/missing values are not replaced by zero. Real imported documents must carry `recordSource: "imported"` and provenance metadata.

## Consistency limitation

There is no distributed transaction with MySQL. The strategy-document endpoint checks that the MySQL plan exists, then inserts into MongoDB. A failure between those operations can leave the relational plan without a document; there is currently no retry queue, outbox, or reconciliation job. Validators and indexes were initialized on MongoDB 8; strategy-document CRUD and the RUD demo still need a full end-to-end verification.
