# Requirements

## Purpose

F1 Race Strategy and Performance Intelligence System stores and presents race facts, supports strategy analysis, and demonstrates relational and document database concepts. Data must be labeled by provenance so imported source records are distinguishable from synthetic fixtures.

## Functional requirements

1. Maintain drivers, constructors, circuits, seasons, events, sessions, qualifying/race results, lap times, pit stops, compounds, stints, and weather observations.
2. Explore race data, compare drivers and teams, and analyze lap, pit-stop, tyre and strategy patterns.
3. Create, list, update, and search strategy plans and reports.
4. Import supported FastF1 session data using a preview/dry-run and idempotent load path; preserve unavailable values as missing.
5. Store high-frequency telemetry and flexible analysis documents in MongoDB with explicit indexes and validation.
6. Provide dashboard, directories, event/results, comparison, lap, pit-stop, tyre, report, and search views.
7. Authenticate users and enforce database-backed ADMIN and ANALYST permissions on the server.
8. Record security-relevant administrative changes and demonstrate all required SQL operation categories.

## Quality and security requirements

- MySQL 8 is the source of truth for structured data; schema changes are versioned.
- Relational design targets 3NF where appropriate; decimals and durations use suitable exact types.
- Database credentials and secrets come from environment configuration. No plaintext passwords or session tokens are stored or logged.
- Browser code talks only to the API. Protected actions are rechecked by FastAPI.
- API inputs are validated; errors do not expose stack traces or secrets.
- Missing data remains NULL/absent, never fabricated as zero. Synthetic data is clearly labeled.
- Local setup and demonstrations must work without downloading a full season; live ingestion is optional and network-dependent.
- Tests and documentation report observed outcomes only.

## Scope and acceptance

The implementation follows the deliverables in `DELIVERABLE_TRACEABILITY.md`. ChromaDB is conditional: it will be used only if semantic strategy-report retrieval is delivered as a genuine embedding workflow with an explicit rebuild path. The supplied PDF informs the core data boundaries but does not supersede these requirements.
