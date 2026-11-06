from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.auth import require_permission
from app.db import engine
from app.vector_search import index_report, strategy_report_collection

router = APIRouter(prefix="/api/vector", tags=["semantic search"])


def _reports() -> list[dict]:
    sql = """
        SELECT sr.report_id, sr.plan_id, sr.title, sr.report_body, sp.assumptions, sp.strategy_type,
               sp.race_id, sp.driver_id, r.race_name, d.full_name AS driver_name
        FROM strategy_reports sr JOIN strategy_plans sp ON sp.plan_id = sr.plan_id
        JOIN races r ON r.race_id = sp.race_id JOIN drivers d ON d.driver_id = sp.driver_id
    """
    try:
        with engine.connect() as connection:
            rows = connection.execute(text(sql), {}).mappings().all()
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Strategy report database is unavailable") from exc
    return [dict(row) for row in rows]


@router.post("/index", status_code=202)
def index_strategy_reports(_: dict = Depends(require_permission("strategy:write", require_csrf=True))) -> dict:
    try:
        reports = _reports()
        collection = strategy_report_collection()
        for report in reports:
            index_report(report)
        return {"indexed_reports": len(reports), "collection": collection.name,
                "embedding_model": "Chroma default all-MiniLM-L6-v2", "similarity_metric": "cosine"}
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Local vector index is unavailable") from exc


@router.get("/search")
def search_strategy_reports(
    q: str = Query(min_length=3, max_length=500),
    race_id: int | None = Query(default=None, gt=0),
    limit: int = Query(default=5, ge=1, le=20),
    _: dict = Depends(require_permission("race:read")),
) -> list[dict]:
    try:
        collection = strategy_report_collection()
        if collection.count() == 0:
            return []
        filters = {"race_id": race_id} if race_id is not None else None
        result = collection.query(query_texts=[q], n_results=min(limit, collection.count()), where=filters)
        documents = result.get("documents", [[]])[0]
        metadatas = result.get("metadatas", [[]])[0]
        distances = result.get("distances", [[]])[0]
        return [{"document": document, "metadata": metadata, "cosine_distance": distance}
                for document, metadata, distance in zip(documents, metadatas, distances)]
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Semantic report search is unavailable") from exc


@router.delete("/index/{report_id}", status_code=204)
def delete_indexed_report(report_id: int, _: dict = Depends(require_permission("strategy:write", require_csrf=True))) -> None:
    try:
        collection = strategy_report_collection()
        collection.delete(ids=[f"report-{report_id}"])
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Local vector index is unavailable") from exc
