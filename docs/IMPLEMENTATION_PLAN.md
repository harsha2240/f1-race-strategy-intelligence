# Implementation Plan

## Repository audit

- Starting branch: `main`, tracking `origin/main`.
- Starting Git status: clean.
- History: one commit (`8604fca Initial commit`).
- Existing files: a short README only; there is no application code, schema, tests, dependency manifest, or deployment configuration to preserve.
- Remote: `origin` points to the project's GitHub repository.
- Supplied reference: the PDF describes a MySQL core for race facts and MongoDB collections for telemetry. It is a design input; the pasted project brief remains the requested scope.

## Phases and exit evidence

| Phase | Scope | Exit evidence |
|---|---|---|
| 1. Audit and plan | Inspect repository, identify existing work and gaps, establish traceability and architecture | This plan, `DELIVERABLE_TRACEABILITY.md`, and `ARCHITECTURE.md` accurately record the audit and decisions |
| 2. Requirements and data design | Requirements, ER model, relational schema, normalization, technology choices | Diagrams and schema docs agree with the implemented model |
| 3. MySQL foundation | Versioned schema, constraints, indexes, migrations, labeled seed data | Clean initialization and constraint checks against MySQL 8 |
| 4. SQL syllabus | DML, joins, nested/correlated queries, CTEs, procedures, functions, triggers, transactions and views | Repeatable SQL demos and a deliverables matrix, verified on MySQL 8 |
| 5. MongoDB | Validated telemetry/document model, indexes, RUD and aggregation examples | Repeatable local demo and consistency rules |
| 6. Vector search decision | Decide whether it adds value beyond the requested MongoDB deliverable | Implement and verify semantic retrieval, or document a clearly justified scope decision |
| 7. FastF1 ingestion | Extract, transform, validate, dry-run and idempotently load a small event | Offline tests plus a documented live import procedure and source limitations |
| 8. FastAPI | Modular API, schemas, services, repositories, errors, pagination and API docs | Endpoint tests and database integration evidence |
| 9. Authentication/RBAC | Sessions, Argon2id, database-backed roles/permissions, audit trail | Positive and denied access tests, including least-privilege database setup where supported |
| 10. Next.js | Responsive analytics dashboard and required pages connected to the API | Build and API-backed UI evidence; loading, empty and error states |
| 11. Integration and security | Cross-service workflows, authorization, safe errors, configuration and setup | Repeatable test results recorded without claiming unavailable services passed |
| 12. Documentation and delivery | Setup, demo, viva, contribution record, GitHub cleanup | Documentation matches the running implementation; clean commits and verified remote update |

## Working rules

- Make small, reviewable changes and inspect Git status before each commit.
- Keep real imported data distinguishable from synthetic fixtures.
- Do not record a check as passed unless it was run and its output was observed.
- Prefer local/offline development and Docker Compose for optional external services.
- Avoid secrets in tracked files; keep `.env.example` placeholder-only.
- Update traceability and the relevant phase evidence as implementation progresses.

## Current state

The original repository contained only a README, so there was no existing application architecture or code to replace. The implementation includes analytics, RBAC, saved hypothetical estimates, FastF1 single-race persistence, local Chroma search, race analysis, driver comparison, and admin import screens. MySQL and MongoDB are running locally. Verified public Jolpica imports loaded seasons 2018–2025 and the dashboard now filters synthetic rows from its default statistics. The season contract migration supports substitutes without duplicating driver identity. FastF1 timing still requires F1TV authentication; no telemetry/weather/tyre compounds are present. Local admin and analyst accounts have been used to verify role separation. Full FastF1 ingestion, MongoDB strategy-document CRUD and default vector embedding remain unverified. The frontend dependency audit found 16 advisories.
