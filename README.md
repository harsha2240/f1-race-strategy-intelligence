# F1 Race Strategy and Performance Intelligence System

A DBMS mini-project for exploring Formula 1 results and strategy data with MySQL, MongoDB, FastAPI, and a Next.js dashboard. The database design separates normalized race facts from flexible/high-volume telemetry. Any offline demo records are explicitly labeled synthetic.

## Current implementation status

The local model is running against MySQL and MongoDB. It includes imported race results for eight seasons (2018–2025): 173 races, 3,458 classifications, 5,941 pit stops and 3,455 qualifying classifications (173 recorded qualifying P1s). Detailed lap timing is available for 2024 (26,574 lap records); other imported seasons intentionally omit lap rows unless imported separately to stay within the public source's request limits. OpenF1 overtake counts are loaded for 70 races from 2023–2025 (17,589 recorded position-exchange events); the source does not cover 2019–2022. The dashboard displays per-season coverage so missing detail is visible. Synthetic classroom rows are excluded from default analytics. Current FastF1 session data requires local F1TV authentication, so high-frequency telemetry, weather and tyre compounds are still absent. See [`docs/DELIVERABLE_TRACEABILITY.md`](docs/DELIVERABLE_TRACEABILITY.md) and [`docs/TESTING.md`](docs/TESTING.md) for checks and limitations.

The home dashboard charts driver and constructor champions by season, shows the total imported race-result record count, and lists each race's top-three finishers by circuit. A separate Track layouts workspace matches database circuits to a third-party MIT-licensed GeoJSON outline dataset and labels unmatched circuits. The strategy workspace compares one-stop and two-stop hypothetical estimates for selected race entrants and shows the assumptions and time difference inline. Race browsing searches imported records; lap-time analysis is only available for 2024, and tyre stint data is not imported. Admins have a separate console for manual race/session maintenance, historical season imports and account/role management; Analysts can explore race data and run strategy analysis. The frontend proxies `/api` through Next.js so session cookies stay on the UI's origin whether it is opened with `localhost` or `127.0.0.1`.

## Architecture

- **MySQL 8**: normalized structured source of truth, roles/permissions, sessions, strategy plans and audit records.
- **MongoDB 8**: flexible strategy documents and telemetry samples, with explicit validators and indexes.
- **FastAPI**: validated API, opaque server-side sessions, Argon2id, and server-side permission checks.
- **Next.js App Router**: responsive dashboard. Browser requests go through the API, not directly to a database.
- **FastF1**: preview/transformation plus a role-protected single-race persistence path; protected session timing data needs local F1TV authentication.
- **Jolpica-F1**: public importer supports completed-season classifications, lap times and pit stops, with rate-limited multi-season imports. It does not provide tyre compounds, weather or high-frequency telemetry.

Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/ER_DIAGRAM.md`](docs/ER_DIAGRAM.md), [`docs/RELATIONAL_SCHEMA.md`](docs/RELATIONAL_SCHEMA.md), and the [`docs/DATA_DICTIONARY.md`](docs/DATA_DICTIONARY.md) for design details.

## Local setup

Requirements: Docker Desktop with Compose, Python 3.12+, Node.js 20+, and npm.

1. Copy `.env.example` to `.env` and replace the local placeholder credentials.
2. Start local database services: `docker compose up -d mysql mongodb`.
3. Initialize the MySQL schema and clearly labeled synthetic fixtures using the commands in [`docs/SETUP_GUIDE.md`](docs/SETUP_GUIDE.md).
4. Apply MongoDB validators/indexes from `database/mongodb/01_collections_and_indexes.js`.
5. Install API dependencies from `backend/requirements.txt` and start FastAPI from the `backend` folder with `uvicorn app.main:app --reload`.
6. Create the first administrator with `python -m app.cli create-user --email admin@example.test --display-name "Project Admin" --role ADMIN`.
7. Install frontend dependencies in `frontend/` and run `npm run dev`.
8. Open `http://localhost:3000`; interactive API documentation is at `http://localhost:8001/docs`.

Exact PowerShell commands and troubleshooting are in [`docs/SETUP_GUIDE.md`](docs/SETUP_GUIDE.md). Never commit `.env` or live credentials.

## SQL and database demos

SQL is organized under `database/mysql/`: database creation, schema and constraints, synthetic seed, constraint verification, query/DML demonstrations, views, and stored routines/triggers. Run against a disposable MySQL 8 instance. `database/mongodb/` contains validators/indexes and RUD/aggregation examples. Each result must be executed before it is recorded as passed.

## Checks

```powershell
python -m compileall -q backend\app backend\tests
backend\.venv\Scripts\python.exe -m pytest backend\tests --basetemp backend\.pytest-tmp\run
Set-Location frontend
npm install
npm run build
```

Run MySQL/MongoDB checks only after the local services are available. Record actual output in [`docs/TESTING.md`](docs/TESTING.md).

## Academic walkthrough

Use [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) and [`docs/VIVA_QUESTIONS.md`](docs/VIVA_QUESTIONS.md) alongside the verification status in [`docs/TESTING.md`](docs/TESTING.md). The supplied database PDF is treated as a design reference; the full brief extends it with RBAC, audit and strategy entities.
