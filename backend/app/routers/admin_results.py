"""Admin-only manual race classification entry and maintenance."""

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.auth import require_permission
from app.db import engine
from app.schemas_admin import ManualRaceResultCreate, ManualRaceResultUpdate

router = APIRouter(prefix="/api/admin", tags=["administration"])


def _unavailable() -> HTTPException:
    return HTTPException(status_code=503, detail="Manual race data service unavailable")


@router.get("/races/{race_id}/entrants")
def race_entrants(race_id: int, _: dict = Depends(require_permission("data:import"))) -> list[dict]:
    try:
        with engine.connect() as connection:
            rows = connection.execute(text("""
                SELECT dt.driver_team_id,d.full_name AS driver_name,c.name AS constructor_name,dt.car_number,
                       rr.result_id,rr.record_source AS existing_source
                FROM races r JOIN seasons s ON s.season_id=r.season_id
                JOIN driver_team_seasons dt ON dt.season_id=s.season_id
                JOIN drivers d ON d.driver_id=dt.driver_id
                JOIN constructors c ON c.constructor_id=dt.constructor_id
                LEFT JOIN race_results rr ON rr.race_id=r.race_id AND rr.driver_team_id=dt.driver_team_id
                WHERE r.race_id=:race_id
                  AND (
                    EXISTS (
                      SELECT 1 FROM sessions se JOIN qualifying_results qr ON qr.session_id=se.session_id
                      WHERE se.race_id=r.race_id AND se.session_type='QUALIFYING'
                        AND qr.driver_team_id=dt.driver_team_id AND qr.record_source='imported'
                    ) OR NOT EXISTS (
                      SELECT 1 FROM sessions se JOIN qualifying_results qr ON qr.session_id=se.session_id
                      WHERE se.race_id=r.race_id AND se.session_type='QUALIFYING' AND qr.record_source='imported'
                    )
                  )
                ORDER BY c.name,d.full_name
            """), {"race_id": race_id}).mappings().all()
        return [dict(row) for row in rows]
    except SQLAlchemyError as exc:
        raise _unavailable() from exc


@router.get("/race-results")
def list_race_results(_: dict = Depends(require_permission("data:import"))) -> list[dict]:
    try:
        with engine.connect() as connection:
            rows = connection.execute(text("""
                SELECT rr.result_id,rr.race_id,rr.driver_team_id,rr.position,rr.points,rr.status,
                       rr.classified_laps,r.race_name,s.year AS season,d.full_name AS driver_name,
                       c.name AS constructor_name,rr.record_source,
                       (SELECT COUNT(*) FROM lap_times lt WHERE lt.result_id=rr.result_id) AS lap_rows,
                       (SELECT COUNT(*) FROM pit_stops ps WHERE ps.result_id=rr.result_id) AS pit_stops,
                       (SELECT COUNT(*) FROM tyre_stints ts WHERE ts.result_id=rr.result_id) AS stint_rows
                FROM race_results rr JOIN races r ON r.race_id=rr.race_id
                JOIN seasons s ON s.season_id=r.season_id
                JOIN driver_team_seasons dt ON dt.driver_team_id=rr.driver_team_id
                JOIN drivers d ON d.driver_id=dt.driver_id
                JOIN constructors c ON c.constructor_id=dt.constructor_id
                ORDER BY s.year DESC,r.race_date DESC,rr.position IS NULL,rr.position,rr.result_id
                LIMIT 10000
            """)).mappings().all()
        return [dict(row) for row in rows]
    except SQLAlchemyError as exc:
        raise _unavailable() from exc


@router.post("/race-results", status_code=201)
def create_manual_result(
    payload: ManualRaceResultCreate,
    actor: dict = Depends(require_permission("data:import", require_csrf=True)),
) -> dict:
    try:
        with engine.begin() as connection:
            entrant = connection.execute(text("""
                SELECT r.race_id,s.season_id
                FROM races r JOIN seasons s ON s.season_id=r.season_id
                JOIN driver_team_seasons dt ON dt.season_id=s.season_id
                WHERE r.race_id=:race_id AND dt.driver_team_id=:driver_team_id
                  AND (
                    EXISTS (
                      SELECT 1 FROM sessions se JOIN qualifying_results qr ON qr.session_id=se.session_id
                      WHERE se.race_id=r.race_id AND se.session_type='QUALIFYING'
                        AND qr.driver_team_id=dt.driver_team_id AND qr.record_source='imported'
                    ) OR NOT EXISTS (
                      SELECT 1 FROM sessions se JOIN qualifying_results qr ON qr.session_id=se.session_id
                      WHERE se.race_id=r.race_id AND se.session_type='QUALIFYING' AND qr.record_source='imported'
                    )
                  )
            """), {"race_id": payload.race_id, "driver_team_id": payload.driver_team_id}).first()
            if entrant is None:
                raise HTTPException(status_code=400, detail="Choose a driver entered for this event; imported qualifying records are used to verify race entrants when available")
            result_id = connection.execute(text("""
                INSERT INTO race_results
                  (race_id,driver_team_id,position,points,status,classified_laps,record_source)
                VALUES (:race_id,:driver_team_id,:position,:points,:status,:classified_laps,'manual')
            """), payload.model_dump()).lastrowid
            connection.execute(text("""
                INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_key,details)
                VALUES (:actor,'race_result.manual_created','race_result',:entity_key,:details)
            """), {"actor": actor["user_id"], "entity_key": str(result_id),
                  "details": json.dumps(payload.model_dump(mode="json"))})
    except IntegrityError as exc:
        raise HTTPException(status_code=409, detail="This driver already has a race result for this event") from exc
    except SQLAlchemyError as exc:
        raise _unavailable() from exc
    return {"result_id": result_id, **payload.model_dump(mode="json"), "record_source": "manual"}


@router.put("/race-results/{result_id}")
def update_manual_result(
    result_id: int,
    payload: ManualRaceResultUpdate,
    actor: dict = Depends(require_permission("data:import", require_csrf=True)),
) -> dict:
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=422, detail="Provide at least one result field to update")
    for field in ("points", "status"):
        if field in changes and changes[field] is None:
            raise HTTPException(status_code=422, detail=f"{field.replace('_', ' ').title()} cannot be empty")
    try:
        with engine.begin() as connection:
            existing = connection.execute(text("""
                SELECT result_id,race_id,driver_team_id,position,points,status,classified_laps,record_source
                FROM race_results WHERE result_id=:result_id FOR UPDATE
            """), {"result_id": result_id}).mappings().first()
            if existing is None:
                raise HTTPException(status_code=404, detail="Race result not found")
            connection.execute(text("""
                UPDATE race_results SET
                  position=IF(:position_set,:position,position),
                  points=IF(:points_set,:points,points),
                  status=IF(:status_set,:status,status),
                  classified_laps=IF(:laps_set,:classified_laps,classified_laps)
                WHERE result_id=:result_id
            """), {"position_set": "position" in changes, "position": changes.get("position"),
                  "points_set": "points" in changes, "points": changes.get("points"),
                  "status_set": "status" in changes, "status": changes.get("status"),
                  "laps_set": "classified_laps" in changes, "classified_laps": changes.get("classified_laps"),
                  "result_id": result_id})
            after = {key: changes.get(key, existing[key]) for key in existing.keys() if key != "result_id"}
            connection.execute(text("""
                INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_key,details)
                VALUES (:actor,'race_result.admin_updated','race_result',:entity_key,:details)
            """), {"actor": actor["user_id"], "entity_key": str(result_id),
                  "details": json.dumps({"before": dict(existing), "after": after}, default=str)})
    except IntegrityError as exc:
        raise HTTPException(status_code=409, detail="The manual result conflicts with an existing race result") from exc
    except SQLAlchemyError as exc:
        raise _unavailable() from exc
    return {"result_id": result_id, **after, "record_source": existing["record_source"]}


@router.delete("/race-results/{result_id}", status_code=204)
def delete_manual_result(
    result_id: int,
    actor: dict = Depends(require_permission("data:import", require_csrf=True)),
) -> None:
    try:
        with engine.begin() as connection:
            existing = connection.execute(text("""
                SELECT result_id,race_id,driver_team_id,position,points,status,classified_laps,record_source
                FROM race_results WHERE result_id=:result_id FOR UPDATE
            """), {"result_id": result_id}).mappings().first()
            if existing is None:
                raise HTTPException(status_code=404, detail="Race result not found")
            dependents = {
                "lap_times": connection.execute(text("SELECT COUNT(*) FROM lap_times WHERE result_id=:id"), {"id": result_id}).scalar_one(),
                "pit_stops": connection.execute(text("SELECT COUNT(*) FROM pit_stops WHERE result_id=:id"), {"id": result_id}).scalar_one(),
                "tyre_stints": connection.execute(text("SELECT COUNT(*) FROM tyre_stints WHERE result_id=:id"), {"id": result_id}).scalar_one(),
            }
            connection.execute(text("""
                INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_key,details)
                VALUES (:actor,'race_result.admin_deleted','race_result',:entity_key,:details)
            """), {"actor": actor["user_id"], "entity_key": str(result_id),
                  "details": json.dumps({"record": dict(existing), "cascaded": dependents}, default=str)})
            connection.execute(text("DELETE FROM race_results WHERE result_id=:result_id"), {"result_id": result_id})
    except SQLAlchemyError as exc:
        raise _unavailable() from exc
    return None
