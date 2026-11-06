from datetime import datetime, timezone

from bson.int64 import Int64
from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.errors import DuplicateKeyError, PyMongoError
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.auth import current_session, require_permission
from app.db import engine
from app.mongo import database
from app.schemas_strategy import StrategyDocumentCreate, StrategyDocumentUpdate

router = APIRouter(prefix="/api/strategy-documents", tags=["strategy documents"])


def _mongo_error() -> HTTPException:
    return HTTPException(status_code=503, detail="Strategy document service unavailable")


@router.get("")
def list_strategy_documents(
    _: dict = Depends(require_permission("race:read")),
    race_id: int | None = Query(default=None, gt=0),
    driver_id: int | None = Query(default=None, gt=0),
    strategy_type: str | None = Query(default=None, max_length=64),
    limit: int = Query(default=50, ge=1, le=100),
) -> list[dict]:
    selector: dict = {}
    if race_id is not None:
        selector["raceId"] = Int64(race_id)
    if driver_id is not None:
        selector["driverId"] = Int64(driver_id)
    if strategy_type:
        selector["strategyType"] = strategy_type
    try:
        documents = database.strategy_documents.find(selector, {"_id": 0}).sort("createdAt", -1).limit(limit)
        return list(documents)
    except PyMongoError as exc:
        raise _mongo_error() from exc


@router.post("", status_code=201)
def create_strategy_document(
    payload: StrategyDocumentCreate,
    _: dict = Depends(require_permission("strategy:write", require_csrf=True)),
) -> dict:
    try:
        with engine.connect() as connection:
            parent = connection.execute(text("""
                SELECT sp.plan_id, sp.race_id, dt.driver_id
                FROM strategy_plans sp
                JOIN drivers dt ON dt.driver_id = sp.driver_id
                WHERE sp.plan_id = :plan_id AND sp.race_id = :race_id AND sp.driver_id = :driver_id
            """), {"plan_id": payload.strategy_id, "race_id": payload.race_id,
                  "driver_id": payload.driver_id}).first()
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Relational database unavailable") from exc
    if parent is None:
        raise HTTPException(status_code=404, detail="Strategy plan or related race/driver not found")

    document = {
        "strategyId": Int64(payload.strategy_id),
        "raceId": Int64(payload.race_id),
        "driverId": Int64(payload.driver_id),
        "strategyType": payload.strategy_type,
        "assumptions": payload.assumptions,
        "tyreSequence": payload.tyre_sequence,
        "analysisMetrics": payload.analysis_metrics,
        "reportText": payload.report_text,
        "recordSource": "manual",
        "createdAt": datetime.now(timezone.utc),
    }
    try:
        database.strategy_documents.insert_one(document)
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=409, detail="A strategy document already exists for this plan") from exc
    except PyMongoError as exc:
        raise _mongo_error() from exc
    return {key: value for key, value in document.items()}


@router.patch("/{strategy_id}")
def update_strategy_document(
    strategy_id: int,
    payload: StrategyDocumentUpdate,
    _: dict = Depends(require_permission("strategy:write", require_csrf=True)),
) -> dict:
    changes = payload.model_dump(exclude_unset=True, exclude_none=True)
    if not changes:
        raise HTTPException(status_code=422, detail="Provide at least one field to update")
    keys = {
        "strategy_type": "strategyType",
        "assumptions": "assumptions",
        "tyre_sequence": "tyreSequence",
        "analysis_metrics": "analysisMetrics",
        "report_text": "reportText",
    }
    update = {keys[key]: value for key, value in changes.items()}
    try:
        result = database.strategy_documents.update_one({"strategyId": Int64(strategy_id)}, {"$set": update})
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Strategy document not found")
        return database.strategy_documents.find_one({"strategyId": Int64(strategy_id)}, {"_id": 0})
    except PyMongoError as exc:
        raise _mongo_error() from exc


@router.delete("/{strategy_id}", status_code=204)
def delete_strategy_document(
    strategy_id: int,
    _: dict = Depends(require_permission("strategy:write", require_csrf=True)),
) -> None:
    try:
        result = database.strategy_documents.delete_one({"strategyId": Int64(strategy_id)})
    except PyMongoError as exc:
        raise _mongo_error() from exc
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Strategy document not found")
