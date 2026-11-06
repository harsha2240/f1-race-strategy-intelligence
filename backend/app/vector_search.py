"""Persistent local semantic index for relational strategy reports."""

import os
from pathlib import Path

import chromadb


def strategy_report_collection():
    path = Path(os.getenv("CHROMA_PATH", "../.data/chroma")).resolve()
    path.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(path=str(path))
    return client.get_or_create_collection(
        name="strategy_reports",
        metadata={"hnsw:space": "cosine", "embedding_model": "Chroma default all-MiniLM-L6-v2"},
    )


def index_report(report: dict) -> None:
    text = "\n".join(filter(None, [
        str(report.get("title") or ""), str(report.get("strategy_type") or ""),
        str(report.get("report_body") or ""), str(report.get("assumptions") or ""),
    ]))
    if not text.strip():
        return
    strategy_report_collection().upsert(
        ids=[f"report-{report['report_id']}"],
        documents=[text],
        metadatas=[{"report_id": int(report["report_id"]), "plan_id": int(report["plan_id"]),
                    "race_id": int(report["race_id"]), "driver_id": int(report["driver_id"]),
                    "race_name": str(report["race_name"]), "driver_name": str(report["driver_name"]),
                    "strategy_type": str(report["strategy_type"])}],
    )
