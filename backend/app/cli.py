from __future__ import annotations

import argparse
import getpass

from sqlalchemy import text

from app.auth import hash_password
from app.db import engine
from app.ingestion.jolpica_import import (
    fetch_qualifying_season,
    fetch_season,
    import_qualifying_season,
    import_season,
)
from app.ingestion.openf1_overtakes import fetch_season as fetch_overtakes, map_races, persist_summaries


def create_user(email: str, display_name: str, role: str) -> None:
    password = getpass.getpass("Password (12+ characters): ")
    if len(password) < 12:
        raise SystemExit("Password must be at least 12 characters")
    confirmation = getpass.getpass("Confirm password: ")
    if password != confirmation:
        raise SystemExit("Passwords do not match")
    normalized_email = email.strip().lower()
    with engine.begin() as connection:
        result = connection.execute(text("""
            INSERT INTO users (email, password_hash, display_name)
            VALUES (:email, :password_hash, :display_name)
        """), {"email": normalized_email, "password_hash": hash_password(password),
              "display_name": display_name.strip()})
        connection.execute(text("""
            INSERT INTO user_roles (user_id, role_id)
            SELECT :user_id, role_id FROM roles WHERE name = :role
        """), {"user_id": result.lastrowid, "role": role.upper()})
        connection.execute(text("""
            INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_key, details)
            VALUES (NULL, 'user.bootstrap_created', 'user', :entity_key,
                    JSON_OBJECT('email', :email, 'role', :role))
        """), {"entity_key": str(result.lastrowid), "email": normalized_email, "role": role.upper()})
    print(f"Created {role.upper()} user {normalized_email} (ID {result.lastrowid}).")


def import_public_season(year: int, include_laps: bool = True) -> None:
    """Import actual public classifications/laps/pit stops without F1TV credentials."""
    with engine.begin() as connection:
        connection.execute(text("""
            UPDATE import_runs SET status='failed',completed_at=UTC_TIMESTAMP(),
              error_summary=COALESCE(error_summary,'Previous import ended before completion')
            WHERE source='Jolpica-F1 API' AND season_year=:year AND status='running'
        """), {"year": year})
        run_id = connection.execute(text("""
            INSERT INTO import_runs (source,season_year,event_name,session_type,status)
            VALUES ('Jolpica-F1 API',:year,:event,'RACE','running')
        """), {"year": year, "event": f"{year} season"}).lastrowid
    try:
        races = fetch_season(year, include_laps=include_laps)
        lap_note = "lap times" if include_laps else "(lap detail skipped to stay within the public API limit)"
        print(f"Validated {len(races)} races. Writing results, {lap_note}, and pit stops...", flush=True)
        with engine.begin() as connection:
            counts = import_season(
                connection, year, races,
                progress=lambda current, total, name: print(f"Staged round {current}/{total}: {name}", flush=True),
            )
            rows = counts["results"] + counts["lap_rows"] + counts["pit_stop_rows"]
            connection.execute(text("""
                UPDATE import_runs SET status='succeeded',completed_at=UTC_TIMESTAMP(),rows_written=:rows
                WHERE import_run_id=:run_id
            """), {"rows": rows, "run_id": run_id})
    except KeyboardInterrupt:
        with engine.begin() as connection:
            connection.execute(text("""
                UPDATE import_runs SET status='failed',completed_at=UTC_TIMESTAMP(),
                  error_summary='Import interrupted; database transaction rolled back'
                WHERE import_run_id=:run_id
            """), {"run_id": run_id})
        raise SystemExit(f"Import interrupted (run {run_id}); database transaction rolled back")
    except Exception as exc:
        with engine.begin() as connection:
            connection.execute(text("""
                UPDATE import_runs SET status='failed',completed_at=UTC_TIMESTAMP(),error_summary=:error
                WHERE import_run_id=:run_id
            """), {"error": f"{type(exc).__name__}: {exc}"[:1000], "run_id": run_id})
        raise SystemExit(f"Season import failed (run {run_id}): {type(exc).__name__}: {exc}") from exc
    print(f"Imported {year}: {counts['races']} races, {counts['results']} results, "
          f"{counts['lap_rows']} lap times, {counts['pit_stop_rows']} pit stops (run {run_id}).")


def import_public_qualifying_season(year: int) -> None:
    """Import actual Jolpica qualifying classifications for a season already in MySQL."""
    with engine.begin() as connection:
        run_id = connection.execute(text("""
            INSERT INTO import_runs (source,season_year,event_name,session_type,status)
            VALUES ('Jolpica-F1 API',:year,:event,'QUALIFYING','running')
        """), {"year": year, "event": f"{year} qualifying sessions"}).lastrowid
    try:
        records_by_round = fetch_qualifying_season(year)
        with engine.begin() as connection:
            counts = import_qualifying_season(connection, year, records_by_round)
            connection.execute(text("""
                UPDATE import_runs SET status='succeeded',completed_at=UTC_TIMESTAMP(),rows_written=:rows
                WHERE import_run_id=:run_id
            """), {"rows": counts["qualifying_rows"], "run_id": run_id})
    except KeyboardInterrupt:
        with engine.begin() as connection:
            connection.execute(text("""
                UPDATE import_runs SET status='failed',completed_at=UTC_TIMESTAMP(),
                  error_summary='Qualifying import interrupted; database transaction rolled back'
                WHERE import_run_id=:run_id
            """), {"run_id": run_id})
        raise SystemExit(f"Qualifying import interrupted (run {run_id})")
    except Exception as exc:
        with engine.begin() as connection:
            connection.execute(text("""
                UPDATE import_runs SET status='failed',completed_at=UTC_TIMESTAMP(),error_summary=:error
                WHERE import_run_id=:run_id
            """), {"error": f"{type(exc).__name__}: {exc}"[:1000], "run_id": run_id})
        raise SystemExit(f"Qualifying import failed for {year} (run {run_id}): {type(exc).__name__}: {exc}") from exc
    print(f"Imported {year} qualifying data: {counts['qualifying_rows']} drivers in "
          f"{counts['races']} races (run {run_id}).")


def import_overtake_season(year: int) -> None:
    """Import source-reported overtake event counts for one historical season."""
    with engine.begin() as connection:
        run_id = connection.execute(text("""
            INSERT INTO import_runs (source,season_year,event_name,session_type,status)
            VALUES ('OpenF1',:year,:event,'RACE','running')
        """), {"year": year, "event": f"{year} race overtakes"}).lastrowid
    try:
        items = fetch_overtakes(year)
        meetings = list({int(item["meeting"]["meeting_key"]): item["meeting"] for item in items}.values())
        with engine.begin() as connection:
            meeting_races = map_races(connection, year, meetings)
            count = persist_summaries(connection, items, meeting_races)
            event_count = sum(len(item["events"]) for item in items)
            connection.execute(text("""
                UPDATE import_runs SET status='succeeded',completed_at=UTC_TIMESTAMP(),rows_written=:rows
                WHERE import_run_id=:run_id
            """), {"rows": event_count, "run_id": run_id})
    except Exception as exc:
        with engine.begin() as connection:
            connection.execute(text("""
                UPDATE import_runs SET status='failed',completed_at=UTC_TIMESTAMP(),error_summary=:error
                WHERE import_run_id=:run_id
            """), {"error": f"{type(exc).__name__}: {exc}"[:1000], "run_id": run_id})
        raise SystemExit(f"Overtake import failed for {year} (run {run_id}): {type(exc).__name__}: {exc}") from exc
    print(f"Imported OpenF1 overtake counts for {count} races in {year}: {event_count} recorded events (run {run_id}).")


def main() -> None:
    parser = argparse.ArgumentParser(description="F1 Strategy Intelligence administrative commands")
    commands = parser.add_subparsers(dest="command", required=True)
    create = commands.add_parser("create-user", help="Create an initial ADMIN or ANALYST user")
    create.add_argument("--email", required=True)
    create.add_argument("--display-name", required=True)
    create.add_argument("--role", required=True, choices=["ADMIN", "ANALYST"])
    season = commands.add_parser("import-jolpica-season", help="Import actual public race results, lap times, and pit stops")
    season.add_argument("--season", type=int, required=True, choices=range(1950, 2101))
    seasons = commands.add_parser("import-jolpica-range", help="Import a consecutive range of completed seasons")
    seasons.add_argument("--from-season", type=int, required=True, choices=range(1950, 2101))
    seasons.add_argument("--to-season", type=int, required=True, choices=range(1950, 2101))
    seasons.add_argument("--skip-laps", action="store_true", help="Skip high-volume lap pages; import classifications and pit stops only")
    qualifying = commands.add_parser("import-jolpica-qualifying-range", help="Import official qualifying classifications for already-imported seasons")
    qualifying.add_argument("--from-season", type=int, required=True, choices=range(1950, 2101))
    qualifying.add_argument("--to-season", type=int, required=True, choices=range(1950, 2101))
    overtakes = commands.add_parser("import-openf1-overtakes", help="Import source-reported race overtake counts (historical coverage from 2023)")
    overtakes.add_argument("--from-season", type=int, required=True, choices=range(2023, 2101))
    overtakes.add_argument("--to-season", type=int, required=True, choices=range(2023, 2101))
    args = parser.parse_args()
    if args.command == "create-user":
        create_user(args.email, args.display_name, args.role)
    elif args.command == "import-jolpica-season":
        import_public_season(args.season)
    elif args.command == "import-jolpica-range":
        if args.to_season < args.from_season:
            raise SystemExit("--to-season must be greater than or equal to --from-season")
        for year in range(args.from_season, args.to_season + 1):
            print(f"\n=== Importing {year} ===", flush=True)
            import_public_season(year, include_laps=not args.skip_laps)
    elif args.command == "import-jolpica-qualifying-range":
        if args.to_season < args.from_season:
            raise SystemExit("--to-season must be greater than or equal to --from-season")
        for year in range(args.from_season, args.to_season + 1):
            print(f"\n=== Importing qualifying for {year} ===", flush=True)
            import_public_qualifying_season(year)
    elif args.command == "import-openf1-overtakes":
        if args.to_season < args.from_season:
            raise SystemExit("--to-season must be greater than or equal to --from-season")
        for year in range(args.from_season, args.to_season + 1):
            print(f"\n=== Importing OpenF1 overtakes for {year} ===", flush=True)
            import_overtake_season(year)


if __name__ == "__main__":
    main()
