# Demonstration Script

This walkthrough uses the existing local database. **Do not run the MySQL initialization scripts or reset/recreate database volumes for the demo.** Use a separate disposable database only when you need to demonstrate initialization or destructive SQL examples.

## Preflight

1. Confirm MySQL and MongoDB are running with `docker compose ps`. If they are stopped, start only the existing services with `docker compose up -d mysql mongodb`; do not initialize them.
2. Start FastAPI from `backend` with `uvicorn app.main:app --reload --port 8001` and Next.js from `frontend` with `npm run dev`.
3. Open `http://localhost:3000` and `http://localhost:8001/docs`. Confirm the existing local ADMIN and ANALYST accounts can sign in before the presentation; use only those accounts during the demo.
4. If a service or account is unavailable, show the relevant code/docs and state that the live integration was not verified. Never substitute fabricated results.

## Suggested 10–12 minute walkthrough

1. **Design (1 min):** Show `ER_DIAGRAM.md`, then `RELATIONAL_SCHEMA.md`. Trace a race result through race, season, driver/team/season, and classification relationships; point out primary/foreign keys and constraints.
2. **Architecture (1 min):** Use `TECHNOLOGY_JUSTIFICATION.md` to explain Next.js, FastAPI, MySQL, MongoDB, and Chroma. Clarify that FastF1 protected timing imports require F1TV Access; public Jolpica season results do not.
3. **Dashboard (2 min):** Show the season range and imported result counts. Open driver/constructor pages and compare drivers across seasons. State the data coverage caveats: detailed laps are available for 2024 only; OpenF1 overtake coverage is 2023–2025.
4. **Race analysis (2 min):** Find a race, open its results, and use Analysis to show result, lap, pit-stop, and tyre-stint views. Missing source coverage should appear as unavailable/empty, not as invented data.
5. **Track layouts (1 min):** Search/select a circuit, switch seasons, and show the outline and unmatched-circuit state.
6. **Strategy and reports (2 min):** Compare one-stop and two-stop estimates; explain the assumptions and that they are hypothetical. Show saved reports. If the vector model is already cached, run semantic search; otherwise explain that model-backed search has not been verified and skip the live search.
7. **Roles and admin (2 min):** Show sign-in and `/api/auth/me` for ADMIN and ANALYST. Demonstrate that an admin page/API is denied to ANALYST (403), and show user/role management and import history as ADMIN. Do not change/delete real records in the presentation database.
8. **Database concepts (1–2 min):** Show the relevant sections of `SQL_CONCEPTS.md`, then the DDL, views, routines/triggers, and MongoDB validators/RUD script. Explain the join, nested/correlated queries, recursive CTE, transaction rollback, stored procedure/function, and trigger. Run only read-only SQL against the existing demo database; run the SQL DML or MongoDB RUD fixtures only after confirming their synthetic fixture scope and cleanup behavior.

## Safety and scope

- Never run `00_create_database.sql`, `01_schema.sql`, `02_reference_and_synthetic_seed.sql`, or setup initialization commands against the populated demo database.
- The MySQL DML examples use a transaction and end with `ROLLBACK`. Confirm the connection targets the intended database before using them; prefer a disposable database for SQL demonstrations.
- `database/mongodb/02_rud_and_aggregation_demo.js` uses reserved synthetic IDs and deletes only its matching synthetic fixture. Verify the collection/index setup and cleanup output before claiming the live MongoDB RUD demonstration passed.
- Admin CRUD demonstrations require a separate disposable/test dataset to avoid changing imported records and leaving audit history in the demo database.
- Do not claim a FastF1 authenticated import, live MongoDB CRUD, or model-backed vector search unless it succeeds during the demo and the outcome is recorded in `TESTING.md`.

## Website route/action checklist

This is the route inventory of the shipped Next.js app. Route HTTP checks and the live interactions listed below were run on 2026-11-09; older observations are identified separately.

| Route | User-facing functions | Verification status |
|---|---|---|
| `/` | Season coverage, champions, race podiums, classification totals, overtake summaries | HTTP 200; dashboard and coverage data were previously observed. |
| `/drivers` | Search driver directory; navigate to comparisons | HTTP 200; driver API returned 200. Search input interaction not separately browser-automated. |
| `/constructors` | Browse constructor summaries | HTTP 200; constructor API returned 200. |
| `/compare` | Compare selected drivers by season or across imported seasons | HTTP 200; season/driver comparison was exercised in earlier runs. |
| `/races` | Browse/filter imported race events and open a result page | HTTP 200; race list, event drivers, and results APIs returned 200. |
| `/races/[raceId]` | View event classifications and source provenance | `/races/166` returned 200; results API returned 200. |
| `/analysis` | Switch between result, lap, pit-stop, and tyre-stint views | Browser checked 2024 Abu Dhabi: 1,033 lap records, 28 pit stops; tyre-stint tab is present and correctly shows 0 records. |
| `/track-layouts` | Search circuits, select a season, inspect track outlines and unmatched circuits | HTTP 200; layouts were observed working in earlier runs. |
| `/strategy` | Compare hypothetical pit strategies and display assumptions/time delta | HTTP 200; authenticated strategy comparison returned 200 and generated two temporary plans, which were removed. |
| `/reports` | Browse saved strategy reports | HTTP 200; strategy report API returned 200. |
| `/search` | Search saved reports semantically; rebuild/refresh the vector index | HTTP 200; MiniLM index and semantic search passed; 3 current reports remain indexed. |
| `/login`, `/register` | Sign in, register, and establish role-backed sessions | Both routes returned 200; temporary registration/login and role checks passed, then test accounts were removed. |
| `/admin/users` | List/create accounts and update roles | HTTP 200; Admin create and role grant/revoke passed; analyst access returned 403. |
| `/admin/data` | Create/edit/delete manual race classifications | HTTP 200; temporary create/edit/delete passed; test row and audit entries were removed. |
| `/admin/sessions` | Create/edit/delete manual sessions | HTTP 200; temporary create/edit/delete passed; test row and audit entries were removed. |
| `/admin/imports` | View import history; launch public Jolpica or protected FastF1 import | HTTP 200; 2018 Jolpica import previously completed in the UI. Authenticated FastF1 import requires F1TV Access and was not run. |
