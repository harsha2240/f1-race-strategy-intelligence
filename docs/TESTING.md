# Testing and Verification

## Readiness audit on 2026-11-09

| Check | Result | Evidence/limitation |
|---|---|---|
| Repository state | Passed | Clean `main`, at `f8ef69e` (`Reconcile verification and delivery notes`), tracking `origin/main` before this readiness pass. |
| Frontend lint and typecheck | Passed | `npm run lint` and `npm run typecheck` completed. |
| Frontend production build | Passed | Escalated retry of `npm run build` completed; all 19 routes generated, including the added tyre-stint analysis tab. |
| Backend syntax | Passed | `python -m compileall -q backend\app backend\tests` completed. |
| Focused backend tests | Passed | FastF1 preview, Jolpica, OpenF1, strategy simulator, and vector tests: 14 passed, one Chroma deprecation warning. The separate Starlette TestClient RBAC tests still stall under Python 3.14. |
| Existing database services | Passed | MySQL 8.4 and MongoDB 8 were healthy on their existing Compose volumes. No initialization/reset was run. |
| Website/API smoke checks | Passed | All 17 Next.js routes returned HTTP 200; health, dashboard, driver, constructor, race, season, championship, podium, circuit, pit-stop, tyre-stint, result, and strategy-report reads returned HTTP 200. Browser analysis showed 1,033 lap rows and 28 pit stops for 2024 Abu Dhabi; the tyre-stint tab displayed an honest 0-record state. |
| Authentication/RBAC integration | Passed | Through the Next.js proxy: registration/login/me, ADMIN access 200, ANALYST denial 403, role grant/revoke, Admin user creation, and access refresh. Temporary users and audit entries were removed. |
| Admin result/session CRUD | Passed | Temporary manual result and session each completed create/edit/delete (201/200/204) through the API proxy. Baseline SQL counts were restored. |
| MongoDB RUD | Passed | `02_rud_and_aggregation_demo.js` created/read/updated/aggregated/deleted its reserved synthetic fixture; post-run fixture count was zero. Strategy-document API CRUD also passed. |
| Vector semantic search | Passed | Default Chroma MiniLM ONNX model downloaded and loaded; authenticated report indexing and semantic search succeeded. Temporary vectors were removed; the persistent collection contains the 3 current saved reports. |
| SQL query/DML demonstration | Passed | `10_query_demonstrations.sql` ran to exit code 0 (5,333 output lines). Nested/correlated queries, joins, window functions, both CTEs, and transaction examples executed; DML changes rolled back. |
| Strategy-document create response | Fixed and verified | PyMongo adds an `ObjectId` to the inserted mapping. The API now omits `_id` from its JSON response; full create/read/update/delete flow passes. |
| FastF1 authenticated import | Not verified | Requires F1TV Access credentials; none were provided. Public Jolpica import remains the demo path and was previously exercised through Admin UI. |

The existing `.env` and source data were left unchanged. Test users, result/session rows, audit entries, Mongo documents, and temporary vectors were cleaned; SQL counts returned to their baseline (174 races, 3,460 total results, 3 users, 7 audit entries, 347 sessions, 3 strategy plans/reports). The Chroma index is intentionally populated with the 3 current reports so semantic search is ready to demonstrate. The app is running locally at `http://127.0.0.1:3000` with FastAPI at `http://127.0.0.1:8001`. Changes from this readiness pass are local and have not been pushed. FastF1 authenticated ingestion remains credential-dependent; it is not needed to demonstrate the public import path.

## Results observed on 2026-11-02

| Check | Result | Evidence/limitation |
|---|---|---|
| Repository audit | Passed | Started on clean `main` at `8604fca`; work since then is uncommitted and preserved |
| Python source syntax | Passed | `python -m compileall -q backend\app backend\tests` completed successfully |
| Pytest suite | Passed | `backend\.venv\Scripts\python.exe -m pytest -q --basetemp .pytest-tmp\codex-run` completed: 16 passed, 1 Chroma deprecation warning. Running without a workspace basetemp hit a Windows permission error in the user temp directory; the suite passed when directed to a workspace path |
| Frontend dependency install | Passed | `npm install` completed; generated `frontend/package-lock.json` is retained |
| Frontend typecheck | Passed | `npm run typecheck` completed with dashboard championship controls, account registration, analysis, comparison, strategy, import, admin and semantic-search routes |
| Frontend lint | Passed | `npm run lint` completed with all current frontend routes |
| Frontend production build | Passed | `npm run build` completed with Next.js 15.5.28; 16 routes generated |
| Browser UI and analytics flow | Passed | Dashboard, race analysis and driver-comparison pages returned HTTP 200. Podium rows are collapsed behind “Expand race podiums.” Race analysis defaults to a lap-data event, labels lap coverage in the selector, and offers results, lap times and pit-stop activity. Comparison can query a selected season or all imported seasons. 2024 Abu Dhabi returned 1,033 lap rows; 2025 podium query returned 24 races; 2024 vs 2025 driver comparisons returned different season-specific start totals |
| Sign-in/sign-out and role access | Passed | Local ADMIN and ANALYST test accounts signed in through the same-origin proxy; `/api/auth/me` returned each role, ADMIN user-list access returned 200, ANALYST access returned 403, logout returned 204 and the next `/api/auth/me` returned 401. Logout clears both cookies |
| Strategy comparison | Passed | With a temporary Analyst session, 2025 Abu Dhabi returned two saved hypothetical plans (one-stop and two-stop), used the stored 58-lap race distance, returned the generic baseline caveat, and displayed the modeled time delta. Temporary plans, reports, account and audit row were removed |
| MySQL service/schema | Passed | Isolated MySQL 8.4 Compose container healthy; schema, seed, views, routines/triggers, constraint checks, grants, migrations 13 and 14 executed. API summary and race/driver/constructor endpoints returned 200 |
| Jolpica-F1 multi-season import | Passed | 2019–2025: 152 imported races, 3,038 results and 5,405 pit stops (5,015 with a recorded pit duration). 2024 includes 26,574 lap rows. Other seasons intentionally omit lap detail; the dashboard reports `0` lap records for those years. Season API and 2019/2025 race filters returned expected records. One synthetic example remains labeled and excluded from imported-only analytics |
| Jolpica qualifying import and driver metrics | Passed | Imported qualifying classifications for 2019–2025: 3,035 driver entries across 152 races, including one P1 per qualifying session. API comparisons return actual wins and qualifying P1 counts; e.g., 2024 Max Verstappen: 9 wins and 10 qualifying P1s; Lewis Hamilton: 2 wins and 0 qualifying P1s |
| OpenF1 overtake import | Passed | Source counts imported into MySQL for 70 races across 2023–2025: 17,589 events. Per-season API returns averages and coverage; per-race API exposes event counts. OpenF1 historical source does not cover 2019–2022; those years are unavailable, not zero. Source caveat: counts can include pit/penalty position exchanges and may be incomplete |
| MongoDB scripts | Passed | MongoDB 8 Compose container healthy; validators and indexes initialized successfully in `f1_strategy` |
| Chroma vector store | Partial | ChromaDB 1.5.9 installed into ignored backend virtualenv; persistence and metadata-filter unit test passed. Default MiniLM model download was interrupted at 13% due very slow network; actual embedding remains unverified |
| FastF1 live import | Not run | Installed FastF1 3.9.1 reported `Not authenticated`; current protected timing data requires an F1TV Access-or-higher account. No account credentials were provided or entered. Jolpica supplies actual race results/laps/pit stops instead |
| API/database/auth integration | Partial | Public read endpoints, per-season coverage, championship tables, exact-race entrant lists, season-filtered race lists, login/logout cookies and ADMIN/ANALYST role separation were exercised against MySQL through the Next.js proxy. Other role-protected write paths remain unverified |
| Dependency audit | Attention | `npm audit` reported 16 advisories (15 moderate, 1 high); review safe upgrades before delivery |

The public-data integration is verified separately from FastF1 telemetry. Historical result and pit-stop data spans eight seasons (2018–2025); only 2024 has detailed lap rows. OpenF1 overtakes are present for 2023–2025 only. Current tests do not exercise MongoDB strategy-document CRUD, the FastF1 authenticated import, or the default embedding model. `npm audit` previously reported 16 advisories (15 moderate, 1 high); rerun it before delivery if dependency-advisory status is required.

## Follow-up verification on 2026-11-06

| Check | Result | Evidence/limitation |
|---|---|---|
| Backend tests after Admin data/import additions | Partial | Focused importer, strategy, vector and FastF1 preview tests passed below; the full suite stalled on the live-health TestClient request in this Python 3.14 environment |
| Backend syntax | Passed | `python -m compileall -q backend/app backend/tests` |
| Frontend lint and typecheck | Passed | `npm run lint` and `npm run typecheck` |
| Frontend production build | Passed | `npm run build`; Next.js generated 19 routes, including `/admin/data` and `/admin/imports` |
| Running local site and API | Passed | Dashboard, Admin manual-data, Admin imports, API health and OpenAPI returned HTTP 200. Dashboard response includes “RACE RESULT RECORDS” and no “FASTEST LAP” metric. |
| Admin manual create/edit | Verified locally | A temporary TEST ONLY result was created and edited in Admin Data; the row disappeared after refresh and baseline totals returned. No test row remains. |
| Jolpica public season import | Verified locally | Admin Imports successfully imported 2018 via Jolpica: 21 races, 420 classifications and accompanying public-data records. It required no F1TV credentials. |

The website and API are running locally at `http://127.0.0.1:3000` and `http://127.0.0.1:8001`. Existing data is unchanged by this follow-up verification.


## Latest verification notes

| Check | Result | Evidence/limitation |
|---|---|---|
| Backend focused unit tests | Passed | From `backend`: `.\.venv\Scripts\python.exe -m pytest -p no:cacheprovider --basetemp .pytest-tmp-target tests\test_fastf1_preview.py tests\test_jolpica_import.py tests\test_openf1_overtakes.py tests\test_strategy_simulator.py tests\test_vector_search.py`: 14 passed, one Chroma deprecation warning. |
| Backend full suite | Blocked in this environment | `tests/test_health.py::test_live_health` stalled in Starlette TestClient. The focused pure/unit suites passed; remaining HTTP integration and RBAC checks need a compatible Python/dependency environment. |
| Frontend lint and typecheck after config fix | Passed | `npm run lint` and `npm run typecheck`. |
| Frontend production build with dev server running | Passed | `npm run build`; development and production output now use separate folders to avoid Windows file-lock collisions. |
| Data coverage in running site | Passed | Dashboard shows 2018–2025, 173 races and 3,458 imported classifications; lap analysis shows 1,033 records for 2024 Abu Dhabi. 2018 has 21 races and 420 classifications; lap detail varies by season and is shown as coverage. |
| Setup proxy default | Fixed | `frontend/.env.example` now points at API port 8001, matching the documented FastAPI port. |
| GitHub delivery (at that time) | Passed | Historical push record. The current user-reported latest pushed commit is `f8ef69e`; see readiness audit above. |
