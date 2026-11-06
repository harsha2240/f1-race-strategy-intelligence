"""Administrator CRUD for race-session metadata."""

import json
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.auth import require_permission
from app.db import engine
from app.schemas_admin import AdminSessionCreate, AdminSessionUpdate

router = APIRouter(prefix="/api/admin/sessions", tags=["administration"])
_MANUAL_PREFIX = "manual:"


def _db_datetime(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def _service_unavailable() -> HTTPException:
    return HTTPException(status_code=503, detail="Session administration service unavailable")


@router.get("")
def list_admin_sessions(
    _: dict = Depends(require_permission("data:import")),
    season: int | None = Query(default=None, ge=1950, le=2100),
    limit: int = Query(default=500, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> list[dict]:
    try:
        with engine.connect() as connection:
            rows = connection.execute(text("""
                SELECT se.session_id,se.race_id,se.session_type,se.session_date,se.source_session_key,
                       r.race_name,s.year AS season,c.name AS circuit,
                       COUNT(qr.driver_team_id) AS qualifying_entries
                FROM sessions se
                JOIN races r ON r.race_id=se.race_id
                JOIN seasons s ON s.season_id=r.season_id
                JOIN circuits c ON c.circuit_id=r.circuit_id
                LEFT JOIN qualifying_results qr ON qr.session_id=se.session_id
                WHERE (:season IS NULL OR s.year=:season)
                GROUP BY se.session_id,se.race_id,se.session_type,se.session_date,se.source_session_key,
                         r.race_name,s.year,c.name
                ORDER BY s.year DESC,r.race_date DESC,se.session_type
                LIMIT :limit OFFSET :offset
            """), {"season": season, "limit": limit, "offset": offset}).mappings().all()
        return [dict(row) for row in rows]
    except SQLAlchemyError as exc:
        raise _service_unavailable() from exc


@router.post("", status_code=201)
def create_admin_session(
    payload: AdminSessionCreate,
    actor: dict = Depends(require_permission("data:import", require_csrf=True)),
) -> dict:
    source_key = f"{_MANUAL_PREFIX}{uuid4().hex}"
    try:
        with engine.begin() as connection:
            race = connection.execute(text("""
                SELECT r.race_id,r.race_name,s.year
                FROM races r JOIN seasons s ON s.season_id=r.season_id
                WHERE r.race_id=:race_id
            """), {"race_id": payload.race_id}).mappings().first()
            if race is None:
                raise HTTPException(status_code=404, detail="Race not found")
            session_id = connection.execute(text("""
                INSERT INTO sessions (race_id,session_type,session_date,source_session_key)
                VALUES (:race_id,:session_type,:session_date,:source_key)
            """), {"race_id": payload.race_id, "session_type": payload.session_type,
                  "session_date": _db_datetime(payload.session_date), "source_key": source_key}).lastrowid
            details = {"race_id": payload.race_id, "race_name": race["race_name"],
                       "season": race["year"], "session_type": payload.session_type,
                       "session_date": payload.session_date.isoformat() if payload.session_date else None}
            connection.execute(text("""
                INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_key,details)
                VALUES (:actor,'session.created','session',:entity_key,:details)
            """), {"actor": actor["user_id"], "entity_key": str(session_id),
                  "details": json.dumps(details)})
    except IntegrityError as exc:
        raise HTTPException(status_code=409, detail="A session of this type already exists for this race") from exc
    except SQLAlchemyError as exc:
        raise _service_unavailable() from exc
    return {"session_id": session_id, "race_id": payload.race_id,
            "session_type": payload.session_type, "session_date": payload.session_date,
            "source_session_key": source_key, "record_source": "manual"}


@router.put("/{session_id}")
def update_admin_session(
    session_id: int,
    payload: AdminSessionUpdate,
    actor: dict = Depends(require_permission("data:import", require_csrf=True)),
) -> dict:
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=422, detail="Provide a session type or date to update")
    if "session_type" in changes and changes["session_type"] is None:
        raise HTTPException(status_code=422, detail="Session type cannot be empty")
    try:
        with engine.begin() as connection:
            existing = connection.execute(text("""
                SELECT se.session_id,se.race_id,se.session_type,se.session_date,se.source_session_key,
                       r.race_name,s.year
                FROM sessions se JOIN races r ON r.race_id=se.race_id
                JOIN seasons s ON s.season_id=r.season_id
                WHERE se.session_id=:session_id FOR UPDATE
            """), {"session_id": session_id}).mappings().first()
            if existing is None:
                raise HTTPException(status_code=404, detail="Session not found")
            is_manual = (existing["source_session_key"] or "").startswith(_MANUAL_PREFIX)
            if not is_manual and "session_type" in changes:
                raise HTTPException(status_code=409, detail="The session type of an imported record identifies its source data and cannot be changed")
            session_type = changes.get("session_type", existing["session_type"])
            session_date = _db_datetime(changes.get("session_date", existing["session_date"]))
            connection.execute(text("""
                UPDATE sessions SET session_type=:session_type,session_date=:session_date
                WHERE session_id=:session_id
            """), {"session_type": session_type, "session_date": session_date,
                  "session_id": session_id})
            details = {"race_id": existing["race_id"], "race_name": existing["race_name"],
                       "season": existing["year"], "before": {
                           "session_type": existing["session_type"],
                           "session_date": existing["session_date"].isoformat() if existing["session_date"] else None,
                       }, "after": {
                           "session_type": session_type,
                           "session_date": session_date.isoformat() if session_date else None,
                       }}
            connection.execute(text("""
                INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_key,details)
                VALUES (:actor,'session.updated','session',:entity_key,:details)
            """), {"actor": actor["user_id"], "entity_key": str(session_id),
                  "details": json.dumps(details)})
    except IntegrityError as exc:
        raise HTTPException(status_code=409, detail="A session of this type already exists for this race") from exc
    except SQLAlchemyError as exc:
        raise _service_unavailable() from exc
    return {"session_id": session_id, "race_id": existing["race_id"],
            "session_type": session_type, "session_date": session_date,
            "source_session_key": existing["source_session_key"],
            "record_source": "manual" if (existing["source_session_key"] or "").startswith(_MANUAL_PREFIX) else "imported"}


@router.delete("/{session_id}", status_code=204)
def delete_admin_session(
    session_id: int,
    actor: dict = Depends(require_permission("data:import", require_csrf=True)),
) -> None:
    try:
        with engine.begin() as connection:
            existing = connection.execute(text("""
                SELECT se.session_id,se.race_id,se.session_type,se.session_date,se.source_session_key,
                       r.race_name,s.year
                FROM sessions se JOIN races r ON r.race_id=se.race_id
                JOIN seasons s ON s.season_id=r.season_id
                WHERE se.session_id=:session_id FOR UPDATE
            """), {"session_id": session_id}).mappings().first()
            if existing is None:
                raise HTTPException(status_code=404, detail="Session not found")
            child_count = connection.execute(text(
                "SELECT COUNT(*) FROM qualifying_results WHERE session_id=:session_id"
            ), {"session_id": session_id}).scalar_one()
            details = {"race_id": existing["race_id"], "race_name": existing["race_name"],
                       "season": existing["year"], "session_type": existing["session_type"],
                       "session_date": existing["session_date"].isoformat() if existing["session_date"] else None,
                       "qualifying_entries_cascaded": child_count}
            connection.execute(text("""
                INSERT INTO audit_logs (actor_user_id,action,entity_type,entity_key,details)
                VALUES (:actor,'session.deleted','session',:entity_key,:details)
            """), {"actor": actor["user_id"], "entity_key": str(session_id),
                  "details": json.dumps(details)})
            connection.execute(text("DELETE FROM sessions WHERE session_id=:session_id"),
                               {"session_id": session_id})
    except SQLAlchemyError as exc:
        raise _service_unavailable() from exc
    return None
