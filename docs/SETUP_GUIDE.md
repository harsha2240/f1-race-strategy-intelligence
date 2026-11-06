# Setup Guide

## Requirements

- Windows 10/11 with PowerShell
- Docker Desktop and Docker Compose v2 (recommended for isolated local databases)
- Python 3.12 or later
- Node.js 20 or later and npm
- Internet access for first-time package installs and optional FastF1 imports

## Database services

From the repository root:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# Edit .env only when creating a new local setup; keep existing credentials intact.
docker compose up -d mysql mongodb
docker compose ps
```

Initialize MySQL from the mounted SQL directory:

```powershell
docker compose exec -T mysql sh -lc 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" < /sql/00_create_database.sql'
docker compose exec -T mysql sh -lc 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" < /sql/01_schema.sql'
docker compose exec -T mysql sh -lc 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" < /sql/02_reference_and_synthetic_seed.sql'
docker compose exec -T mysql sh -lc 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" < /sql/11_views.sql'
docker compose exec -T mysql sh -lc 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" < /sql/12_routines_and_triggers.sql'
docker compose exec -T mysql sh -lc 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" < /sql/13_driver_team_transfers.sql'
docker compose exec -T mysql sh -lc 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" < /sql/14_race_overtake_summaries.sql'
docker compose exec -T mysql sh -lc 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" < /sql/04_constraint_verification.sql'
docker compose exec -T mysql sh -lc 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" < /sql/05_database_privileges.sql'
```

All database rows in the seed script use fictional demo identities and `record_source='synthetic'`. Query/DML examples are in `10_query_demonstrations.sql`. Use a disposable database because the examples include data changes (the provided DML examples roll back). Do not point these initialization scripts at a database containing data you need: the seed uses upserts and the schema scripts change database structure. Compose creates an isolated MySQL volume for this project.

Initialize MongoDB validators and indexes:

```powershell
docker compose exec mongodb mongosh "mongodb://localhost:27017/f1_strategy" --file /mongo-scripts/01_collections_and_indexes.js
```

The MongoDB RUD/aggregation demo is `database/mongodb/02_rud_and_aggregation_demo.js`.

## API

```powershell
Set-Location backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

From another PowerShell window, create an administrator (password is entered with hidden prompt):

```powershell
Set-Location backend
python -m app.cli create-user --email admin@example.test --display-name "Project Admin" --role ADMIN
```

API documentation is at `http://localhost:8001/docs`. Configuration is read from the repository `.env`; the isolated Compose services use host ports 3307 (MySQL) and 27018 (MongoDB) by default to avoid colliding with local database services. Keep `MYSQL_PORT=3307`, `MONGODB_PORT=27018`, and `MONGODB_URI=mongodb://127.0.0.1:27018/f1_strategy` aligned. Chroma keeps its persistent local report index under `.data/chroma` by default. The first embedding request downloads the local all-MiniLM model if it is not cached.

After creating a local admin, import actual race classifications, lap times, and pit stops through the public Jolpica-F1 API:

```powershell
python -m app.cli import-jolpica-season --season 2024
```

To populate qualifying positions and pole-position comparisons for the imported historical seasons, run:

```powershell
python -m app.cli import-jolpica-qualifying-range --from-season 2019 --to-season 2025
```

This imports qualifying classifications into `qualifying_results`; pole counts use qualifying P1 records and remain separate from race wins.

For wider historical comparisons, import consecutive seasons of race classifications and pit stops while skipping the high-volume lap feed. The local demo database has been loaded with 2018–2025:

```powershell
python -m app.cli import-jolpica-range --from-season 2018 --to-season 2025 --skip-laps
```

Lap data can be imported by omitting `--skip-laps`, but lap pages are paginated heavily. The importer paces requests for [Jolpica's published unauthenticated limit of 500 requests per hour](https://github.com/jolpica/jolpica-f1/blob/main/docs/rate_limits.md). Cached source responses are reused on retries. A skipped lap feed stays absent in the database and is not synthesized. The dashboard's season cards show which types of source records exist for each year.

The import is repeatable and caches paginated API responses in the repository `.cache/jolpica` folder. It uses a documented request pace to respect API rate limits.

The importer validates driver/team contracts before writing and records source and row counts in `import_runs`. The public Jolpica season importer is the recommended path when you do not have F1TV: it imports classifications, qualifying positions and pit stops without credentials. It does not invent tyre compounds, weather or telemetry; those remain unavailable from this source. The separate FastF1 session importer provides detailed timing where available, but current FastF1 versions require an F1TV Access-or-higher account for protected session data. Without that account, FastF1 imports can fail before any race data is written. If you have eligible access, authenticate locally with `python -m fastf1 auth f1tv --authenticate` before using `/api/ingestion/fastf1/race`; enter credentials only in the local prompt, never in `.env` or chat. See the [FastF1 authentication documentation](https://github.com/theOehrly/Fast-F1/blob/main/docs/api_reference/accounts_auth.rst) and [Jolpica API documentation](https://github.com/jolpica/jolpica-f1/blob/main/docs/README.md).

Import source-reported overtake counts for 2023–2025 (OpenF1 historical coverage begins in 2023):

```powershell
python -m app.cli import-openf1-overtakes --from-season 2023 --to-season 2025
```

The importer stores one count per matched race in `race_overtake_summaries` and respects OpenF1's public request limit. Counts may be incomplete and include position exchanges associated with on-track passes, pit stops or penalties. Seasons before 2023 remain unavailable; the dashboard displays that gap rather than treating it as zero. See [OpenF1's overtake endpoint documentation](https://openf1.org/docs/).

## Frontend

```powershell
Set-Location frontend
Copy-Item .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000` (or `http://127.0.0.1:3000`). The Next.js app proxies `/api` requests to `API_PROXY_TARGET` (default `http://127.0.0.1:8001`), keeping session cookies on the same browser origin and avoiding `localhost` versus `127.0.0.1` cookie mismatches. If the API/database services are stopped, the dashboard displays an error or empty state rather than sample data.

## Tests and troubleshooting

From repository root:

```powershell
python -m compileall -q backend\app backend\tests
python -m pytest backend\tests
```

In `frontend/`, run `npm run build`. MySQL and MongoDB verification requires running Compose services. If credentials or ports changed in `.env`, restart the relevant service and keep the API's connection settings aligned. FastF1 preview requires network access and may return incomplete sessions; it does not write records to the databases.

Observed database, API, browser, and build checks are recorded in `TESTING.md`; FastF1-authenticated import, MongoDB strategy-document writes, and default vector embedding still require separate verification. For a focused backend test run on Windows, from `backend`: `.\.venv\Scripts\python.exe -m pytest -p no:cacheprovider --basetemp .pytest-tmp-target tests\test_fastf1_preview.py tests\test_jolpica_import.py tests\test_openf1_overtakes.py tests\test_strategy_simulator.py tests\test_vector_search.py`.
