"""Import OpenF1's historical race overtake events into MySQL summaries.

OpenF1's public historical overtake endpoint begins in 2023. Its definition
includes recorded position exchanges caused by on-track passes, pit stops, or
post-race penalties; its documentation also notes that events may be incomplete.
"""

from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path
from typing import Any

import httpx
from sqlalchemy import text
from sqlalchemy.engine import Connection

BASE_URL = "https://api.openf1.org/v1"
MIN_REQUEST_INTERVAL_SECONDS = 2.1  # Public historical limit: 30 requests/minute.
_last_request_at = 0.0


def _cache_path(cache_dir: Path, endpoint: str, params: dict[str, Any]) -> Path:
    cache_dir.mkdir(parents=True, exist_ok=True)
    payload = json.dumps({"endpoint": endpoint, "params": params}, sort_keys=True)
    return cache_dir / f"{hashlib.sha256(payload.encode()).hexdigest()}.json"


def _get_json(
    client: httpx.Client,
    endpoint: str,
    params: dict[str, Any],
    cache_dir: Path,
) -> list[dict[str, Any]]:
    global _last_request_at
    cache_file = _cache_path(cache_dir, endpoint, params)
    if cache_file.is_file():
        return json.loads(cache_file.read_text(encoding="utf-8"))

    last_error: Exception | None = None
    for attempt in range(3):
        wait = MIN_REQUEST_INTERVAL_SECONDS - (time.monotonic() - _last_request_at)
        if wait > 0:
            time.sleep(wait)
        try:
            response = client.get(f"{BASE_URL}/{endpoint}", params=params)
            _last_request_at = time.monotonic()
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, list):
                raise ValueError(f"OpenF1 returned a non-list payload for {endpoint}")
            cache_file.write_text(json.dumps(payload), encoding="utf-8")
            return payload
        except (httpx.TimeoutException, httpx.TransportError, httpx.HTTPStatusError) as exc:
            last_error = exc
            if isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code < 500 and exc.response.status_code != 429:
                raise
            if attempt < 2:
                retry_after = exc.response.headers.get("Retry-After") if isinstance(exc, httpx.HTTPStatusError) else None
                try:
                    retry_delay = float(retry_after) if retry_after else 0
                except ValueError:
                    retry_delay = 0
                time.sleep(max(retry_delay, 15 * (attempt + 1)))
    assert last_error is not None
    raise last_error


def _key(value: str) -> str:
    return "".join(char.lower() for char in value if char.isalnum())


def fetch_season(year: int, client: httpx.Client | None = None, cache_dir: Path | None = None) -> list[dict[str, Any]]:
    """Return race sessions enriched with their actual OpenF1 overtake event lists."""
    owned_client = client is None
    client = client or httpx.Client(timeout=30.0, headers={"User-Agent": "F1-Race-Strategy-Intelligence/0.2"})
    cache_dir = cache_dir or Path(__file__).resolve().parents[3] / ".cache" / "openf1"
    try:
        meetings = _get_json(client, "meetings", {"year": year}, cache_dir)
        sessions = _get_json(client, "sessions", {"year": year, "session_name": "Race"}, cache_dir)
        completed: list[dict[str, Any]] = []
        for session in sessions:
            if session.get("is_cancelled"):
                continue
            # Session rows identify a meeting by key; exclude testing via the
            # associated meeting name before requesting event details.
            meeting = next((item for item in meetings if item.get("meeting_key") == session.get("meeting_key")), None)
            if meeting is None or "grandprix" not in _key(str(meeting.get("meeting_name", ""))):
                continue
            events = _get_json(client, "overtakes", {"session_key": session["session_key"]}, cache_dir)
            completed.append({"meeting": meeting, "session": session, "events": events})
        if not completed:
            raise ValueError(f"OpenF1 returned no race overtake sessions for {year}")
        return completed
    finally:
        if owned_client:
            client.close()


def map_races(connection: Connection, year: int, meetings: list[dict[str, Any]]) -> dict[int, int]:
    """Map OpenF1 meeting keys to imported local race IDs by exact event name."""
    rows = connection.execute(text("""
        SELECT r.race_id, r.race_name
        FROM races r JOIN seasons s ON s.season_id=r.season_id
        WHERE s.year=:year AND r.record_source='imported'
    """), {"year": year}).mappings().all()
    by_name = {_key(str(row["race_name"])): int(row["race_id"]) for row in rows}
    mapped: dict[int, int] = {}
    missing: list[str] = []
    for meeting in meetings:
        meeting_key = int(meeting["meeting_key"])
        meeting_name = _key(str(meeting.get("meeting_name", "")))
        race_id = by_name.get(meeting_name)
        if race_id is None:
            missing.append(str(meeting.get("meeting_name", meeting_key)))
        else:
            mapped[meeting_key] = race_id
    if missing:
        raise ValueError(f"Could not match OpenF1 meeting names to imported races: {', '.join(missing)}")
    return mapped


def persist_summaries(connection: Connection, items: list[dict[str, Any]], meeting_races: dict[int, int]) -> int:
    """Upsert a single source event count for each matched race."""
    rows = []
    for item in items:
        meeting_key = int(item["meeting"]["meeting_key"])
        rows.append({
            "race_id": meeting_races[meeting_key],
            "session_key": int(item["session"]["session_key"]),
            "overtakes": len(item["events"]),
        })
    if rows:
        connection.execute(text("""
            INSERT INTO race_overtake_summaries (race_id,source_session_key,overtake_count,source)
            VALUES (:race_id,:session_key,:overtakes,'OpenF1')
            ON DUPLICATE KEY UPDATE source_session_key=VALUES(source_session_key),
              overtake_count=VALUES(overtake_count),source='OpenF1',fetched_at=CURRENT_TIMESTAMP
        """), rows)
    return len(rows)
