"""Preview and validate a FastF1 session before any database write."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import pandas as pd


def _duration_ms(value: Any) -> int | None:
    if value is None or pd.isna(value):
        return None
    try:
        milliseconds = int(round(value.total_seconds() * 1000))
    except (AttributeError, TypeError, ValueError, OverflowError):
        return None
    return milliseconds if milliseconds > 0 else None


def transform_laps(laps: pd.DataFrame) -> list[dict[str, Any]]:
    """Convert FastF1 lap rows into validated, provenance-tagged records."""
    records: list[dict[str, Any]] = []
    for _, row in laps.iterrows():
        driver = row.get("Driver")
        number = row.get("LapNumber")
        if pd.isna(driver) or pd.isna(number):
            continue
        lap_number = int(number)
        if lap_number < 1:
            continue
        records.append({
            "driver_code": str(driver),
            "lap_number": lap_number,
            "lap_time_ms": _duration_ms(row.get("LapTime")),
            "compound": None if pd.isna(row.get("Compound")) else str(row.get("Compound")),
            "stint_number": None if pd.isna(row.get("Stint")) else int(row.get("Stint")),
            "tyre_life_laps": None if pd.isna(row.get("TyreLife")) else int(row.get("TyreLife")),
            "record_source": "imported",
        })
    return records


def validate_records(records: list[dict[str, Any]]) -> list[str]:
    errors: list[str] = []
    seen: set[tuple[str, int]] = set()
    for index, record in enumerate(records):
        key = (record["driver_code"], record["lap_number"])
        if key in seen:
            errors.append(f"duplicate driver/lap key at row {index}: {key}")
        seen.add(key)
        duration = record["lap_time_ms"]
        if duration is not None and duration <= 0:
            errors.append(f"non-positive lap time at row {index}")
    return errors


def fetch_preview(year: int, event: str, session_name: str, cache_dir: Path) -> dict[str, Any]:
    import fastf1

    cache_dir.mkdir(parents=True, exist_ok=True)
    fastf1.Cache.enable_cache(str(cache_dir))
    session = fastf1.get_session(year, event, session_name)
    session.load(laps=True, telemetry=False, weather=True, messages=False)
    records = transform_laps(session.laps)
    errors = validate_records(records)
    weather_count = len(session.weather_data) if session.weather_data is not None else 0
    return {
        "source": "FastF1",
        "season": year,
        "event": event,
        "session": session_name,
        "preview_only": True,
        "lap_rows": len(records),
        "weather_rows": weather_count,
        "validation_errors": errors,
        "laps": records,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--season", type=int, required=True)
    parser.add_argument("--event", required=True, help="FastF1 event name or round")
    parser.add_argument("--session", required=True, help="For example FP1, Q, or R")
    parser.add_argument("--cache-dir", type=Path, default=Path(".cache/fastf1"))
    args = parser.parse_args()
    preview = fetch_preview(args.season, args.event, args.session, args.cache_dir)
    print(json.dumps(preview, indent=2, default=str))
    if preview["validation_errors"]:
        raise SystemExit("Preview contains validation errors; no database write was attempted.")


if __name__ == "__main__":
    main()
