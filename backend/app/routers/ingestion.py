import json
import os
from pathlib import Path

import fastf1
import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.auth import require_permission
from app.db import engine
from app.ingestion.fastf1_import import persist_race_session
from app.ingestion.jolpica_import import existing_session, fetch_qualifying_season, fetch_round, fetch_season, find_round_by_name, import_qualifying_season, import_round, import_season
from app.schemas_ingestion import FastF1RaceImport, JolpicaSeasonImport, JolpicaSessionImport

router = APIRouter(prefix="/api/ingestion", tags=["data ingestion"])
_progress: dict[int, str] = {}


@router.get("/history")
def import_history(
    _: dict = Depends(require_permission("data:import")),
    limit: int = Query(default=50, ge=1, le=200),
) -> list[dict]:
    try:
        with engine.connect() as connection:
            rows = connection.execute(text("""
                SELECT import_run_id, source, season_year, event_name, session_type, status,
                       started_at, completed_at, rows_written, error_summary
                FROM import_runs ORDER BY import_run_id DESC LIMIT :limit
            """), {"limit": limit}).mappings().all()
            return [{**row, "progress": _progress.get(row["import_run_id"])} for row in rows]
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Import history is unavailable") from exc


@router.post("/fastf1/race", status_code=201)
def import_fastf1_race(
    payload: FastF1RaceImport,
    _: dict = Depends(require_permission("data:import", require_csrf=True)),
) -> dict:
    """Import one race session. Requires an explicit ADMIN role permission and live FastF1 access."""
    try:
        with engine.begin() as connection:
            run_id = connection.execute(text("""
                INSERT INTO import_runs (source, season_year, event_name, session_type, status)
                VALUES ('FastF1', :season, :event, 'RACE', 'running')
            """), {"season": payload.season, "event": payload.event}).lastrowid
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Import history database is unavailable") from exc

    try:
        _progress[run_id] = "Loading FastF1 race timing and weather"
        cache_dir = Path(os.getenv("FASTF1_CACHE_DIR", "../.cache/fastf1")).resolve()
        cache_dir.mkdir(parents=True, exist_ok=True)
        fastf1.Cache.enable_cache(str(cache_dir))
        session = fastf1.get_session(payload.season, payload.event, "R")
        session.load(laps=True, telemetry=False, weather=True, messages=False)
        _progress[run_id] = "Saving FastF1 race and timing records"
        with engine.begin() as connection:
            counts = persist_race_session(connection, session, payload.season, payload.event)
            connection.execute(text("""
                UPDATE import_runs SET status = 'succeeded', completed_at = UTC_TIMESTAMP(), rows_written = :rows
                WHERE import_run_id = :run_id
            """), {"rows": sum(value for key, value in counts.items() if key != "race_id"), "run_id": run_id})
    except ValueError as exc:
        with engine.begin() as connection:
            connection.execute(text("""
                UPDATE import_runs SET status = 'failed', completed_at = UTC_TIMESTAMP(), error_summary = :error
                WHERE import_run_id = :run_id
            """), {"error": str(exc)[:1000], "run_id": run_id})
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        try:
            with engine.begin() as connection:
                connection.execute(text("""
                    UPDATE import_runs SET status = 'failed', completed_at = UTC_TIMESTAMP(), error_summary = :error
                    WHERE import_run_id = :run_id
                """), {"error": f"{type(exc).__name__}: {exc}"[:1000], "run_id": run_id})
        except SQLAlchemyError:
            pass
        raise HTTPException(status_code=502, detail="FastF1 import failed; inspect the import history for a safe error summary") from exc
    finally:
        _progress.pop(run_id, None)
    return {"import_run_id": run_id, "source": "FastF1", "status": "succeeded", **counts}


def _run_jolpica_season(
    run_id: int, year: int, include_laps: bool, actor_id: int | None,
    round_number: int | None = None, session_type: str = "RACE",
) -> None:
    def progress(message: str) -> None:
        _progress[run_id] = message

    try:
        if round_number is None:
            progress("Fetching season schedule and classifications")
            races = fetch_season(year, include_laps=include_laps, progress=progress)
            progress("Downloading season qualifying results")
            qualifying = fetch_qualifying_season(year)
        else:
            event = fetch_round(year, round_number, session_type, progress)
        progress("Saving results")
        with engine.begin() as connection:
            summary = None
            if round_number is None:
                race_counts = import_season(connection, year, races)
                qualifying_counts = import_qualifying_season(connection, year, qualifying)
                rows_written = (race_counts["results"] + race_counts["lap_rows"] +
                                race_counts["pit_stop_rows"] + qualifying_counts["qualifying_rows"])
            else:
                rows_written = import_round(connection, year, round_number, session_type, event)
                if rows_written is None:
                    rows_written = 0
                    summary = "Session already present. No data imported."
            connection.execute(text("""
                UPDATE import_runs SET status='succeeded',completed_at=UTC_TIMESTAMP(),rows_written=:rows,
                  error_summary=:summary WHERE import_run_id=:run_id
            """), {"rows": rows_written, "run_id": run_id, "summary": summary})
            if summary:
                return
            connection.execute(text("""
                INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_key,details)
                VALUES (:actor,:action,'import_run',:entity_key,:details)
            """), {"actor": actor_id, "entity_key": str(run_id),
                  "action": "season.imported" if round_number is None else "session.imported",
                  "details": json.dumps({"season": year, "source": "Jolpica-F1 API",
                                         "round": round_number, "session_type": session_type,
                                         "include_laps": include_laps, "rows_written": rows_written})})
    except Exception as exc:
        try:
            with engine.begin() as connection:
                connection.execute(text("""
                    UPDATE import_runs SET status='failed',completed_at=UTC_TIMESTAMP(),error_summary=:error
                    WHERE import_run_id=:run_id
                """), {"error": f"{type(exc).__name__}: {exc}"[:1000], "run_id": run_id})
        except SQLAlchemyError:
            pass
    finally:
        _progress.pop(run_id, None)


@router.post("/jolpica/session", status_code=202)
def import_jolpica_session(
    payload: JolpicaSessionImport,
    background_tasks: BackgroundTasks,
    actor: dict = Depends(require_permission("data:import", require_csrf=True)),
) -> dict:
    round_number = payload.round_number
    event_name = f"Round {round_number}"
    try:
        if payload.race_name is not None:
            name = " ".join(payload.race_name.split())
            with engine.connect() as connection:
                race = connection.execute(text("""
                    SELECT r.race_name,r.source_race_key,se.session_id FROM races r
                    JOIN seasons s ON s.season_id=r.season_id
                    LEFT JOIN sessions se ON se.race_id=r.race_id AND se.session_type=:type
                    WHERE s.year=:year AND r.race_name=:name
                """), {"year": payload.season, "name": name, "type": payload.session_type}).mappings().first()
            if race and race["session_id"] is not None:
                return {"status": "already_present", "message": "Session already present. No data imported."}
            prefix = f"jolpica:{payload.season}:"
            key = (race["source_race_key"] or "") if race else ""
            if key.startswith(prefix) and key[len(prefix):].isdigit():
                round_number, event_name = int(key[len(prefix):]), race["race_name"]
            else:
                round_number, event_name = find_round_by_name(payload.season, name)
        assert round_number is not None
        with engine.begin() as connection:
            if existing_session(connection, payload.season, round_number, payload.session_type) is not None:
                return {"status": "already_present", "message": "Session already present. No data imported."}
            params = {"year": payload.season, "event": event_name, "round": f"Round {round_number}", "type": payload.session_type}
            if connection.execute(text("""
                SELECT 1 FROM import_runs WHERE source='Jolpica-F1 API'
                  AND season_year=:year AND event_name IN (:event,:round) AND session_type=:type AND status='running'
                  AND started_at >= UTC_TIMESTAMP() - INTERVAL 30 MINUTE
                LIMIT 1
            """), params).first():
                raise HTTPException(status_code=409, detail="An import for this session is already running")
            run_id = connection.execute(text("""
                INSERT INTO import_runs (source,season_year,event_name,session_type,status)
                VALUES ('Jolpica-F1 API',:year,:event,:type,'running')
            """), params).lastrowid
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Import history database is unavailable") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Could not load the race schedule from Jolpica. Try again shortly.") from exc
    background_tasks.add_task(_run_jolpica_season, run_id, payload.season, False, actor["user_id"],
                              round_number, payload.session_type)
    return {"import_run_id": run_id, "status": "running"}


@router.post("/jolpica/season", status_code=202)
def import_jolpica_season(
    payload: JolpicaSeasonImport,
    background_tasks: BackgroundTasks,
    actor: dict = Depends(require_permission("data:import", require_csrf=True)),
) -> dict:
    """Queue an idempotent completed-season import from the public Jolpica API."""
    try:
        with engine.begin() as connection:
            connection.execute(text("""
                UPDATE import_runs SET status='failed',completed_at=UTC_TIMESTAMP(),
                  error_summary=COALESCE(error_summary,'Previous import ended before completion')
                WHERE source='Jolpica-F1 API' AND season_year=:season AND event_name=:event AND status='running'
                  AND started_at < UTC_TIMESTAMP() - INTERVAL 30 MINUTE
            """), {"season": payload.season, "event": f"{payload.season} season"})
            active = connection.execute(text("""
                SELECT import_run_id FROM import_runs
                WHERE source='Jolpica-F1 API' AND season_year=:season AND event_name=:event AND status='running'
                LIMIT 1 FOR UPDATE
            """), {"season": payload.season, "event": f"{payload.season} season"}).first()
            if active is not None:
                raise HTTPException(status_code=409, detail="An import for this season is already running")
            run_id = connection.execute(text("""
                INSERT INTO import_runs (source,season_year,event_name,session_type,status)
                VALUES ('Jolpica-F1 API',:season,:event,'RACE','running')
            """), {"season": payload.season, "event": f"{payload.season} season"}).lastrowid
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Import history database is unavailable") from exc
    background_tasks.add_task(_run_jolpica_season, run_id, payload.season, payload.include_laps, actor["user_id"])
    return {"import_run_id": run_id, "source": "Jolpica-F1 API", "status": "running", "season": payload.season}
