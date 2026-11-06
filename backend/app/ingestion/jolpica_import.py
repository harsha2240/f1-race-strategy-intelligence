"""Import public F1 classifications, lap times, and pit stops from Jolpica-F1.

Jolpica's Ergast-compatible API provides race facts without the F1TV login
required by current FastF1 releases. It does not provide FastF1 telemetry,
weather, or tyre compounds; those values remain absent until a separate
authenticated FastF1 session import is available.
"""

from __future__ import annotations

import hashlib
import json
import time
from datetime import date, datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
from typing import Any, Callable

import httpx
from sqlalchemy import text
from sqlalchemy.engine import Connection

BASE_URL = "https://api.jolpi.ca/ergast/f1"
PAGE_SIZE = 100  # Jolpica caps each Ergast-compatible response at 100 rows.
# Jolpica documents a 500 requests/hour sustained unauthenticated limit.
# Keep a small margin below that ceiling even when bulk-importing years.
MIN_REQUEST_INTERVAL_SECONDS = 7.25
_last_request_at = 0.0


def _get_json(client: httpx.Client, path: str, offset: int = 0, cache_dir: Path | None = None) -> dict[str, Any]:
    global _last_request_at
    cache_file = None
    if cache_dir is not None:
        cache_dir.mkdir(parents=True, exist_ok=True)
        cache_key = hashlib.sha256(f"{path}?limit={PAGE_SIZE}&offset={offset}".encode()).hexdigest()
        cache_file = cache_dir / f"{cache_key}.json"
        if cache_file.is_file():
            return json.loads(cache_file.read_text(encoding="utf-8"))

    last_error: Exception | None = None
    for attempt in range(3):
        try:
            wait = MIN_REQUEST_INTERVAL_SECONDS - (time.monotonic() - _last_request_at)
            if wait > 0:
                time.sleep(wait)
            response = client.get(f"{BASE_URL}/{path.lstrip('/')}" , params={"limit": PAGE_SIZE, "offset": offset})
            _last_request_at = time.monotonic()
            response.raise_for_status()
            payload = response.json()["MRData"]
            if cache_file is not None:
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


def _collection(client: httpx.Client, path: str, key: str, cache_dir: Path | None = None) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    offset = 0
    total = None
    while total is None or offset < total:
        payload = _get_json(client, path, offset, cache_dir)
        total = int(payload["total"])
        race_rows = payload.get("RaceTable", {}).get("Races", [])
        if key == "Races":
            page_rows = race_rows
        else:
            page_rows = race_rows[0].get(key, []) if race_rows else []
        rows.extend(page_rows)
        if not page_rows or offset + PAGE_SIZE >= total:
            break
        offset += PAGE_SIZE
    return rows


def _season_records(
    client: httpx.Client,
    path: str,
    key: str,
    cache_dir: Path | None = None,
) -> dict[str, list[dict[str, Any]]]:
    """Fetch season-wide result/stop records and group them by round."""
    by_round: dict[str, list[dict[str, Any]]] = {}
    offset = 0
    total: int | None = None
    while total is None or offset < total:
        payload = _get_json(client, path, offset, cache_dir)
        total = int(payload["total"])
        race_rows = payload.get("RaceTable", {}).get("Races", [])
        for race in race_rows:
            round_number = str(race.get("round", ""))
            if not round_number:
                continue
            by_round.setdefault(round_number, []).extend(race.get(key, []))
        if not race_rows or offset + PAGE_SIZE >= total:
            break
        offset += PAGE_SIZE
    return by_round


def fetch_qualifying_season(
    year: int,
    client: httpx.Client | None = None,
    cache_dir: Path | None = None,
) -> dict[str, list[dict[str, Any]]]:
    """Fetch official qualifying classifications, grouped by race round."""
    owned_client = client is None
    client = client or httpx.Client(timeout=30.0, headers={"User-Agent": "F1-Race-Strategy-Intelligence/0.1"})
    cache_dir = cache_dir or Path(__file__).resolve().parents[3] / ".cache" / "jolpica"
    try:
        records = _season_records(client, f"{year}/qualifying.json", "QualifyingResults", cache_dir)
        return records
    finally:
        if owned_client:
            client.close()


def _positive_int(value: Any, field: str) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError, OverflowError) as exc:
        raise ValueError(f"Invalid {field} in Jolpica data") from exc
    if parsed <= 0:
        raise ValueError(f"Invalid {field} in Jolpica data")
    return parsed


def _lap_ms(value: Any) -> int | None:
    if not value:
        return None
    try:
        parts = str(value).split(":")
        seconds = Decimal(parts[-1]) + (Decimal(parts[-2]) * 60 if len(parts) > 1 else 0)
        milliseconds = int((seconds * 1000).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
        return milliseconds if milliseconds > 0 else None
    except (InvalidOperation, ValueError):
        return None


def _seconds_ms(value: Any) -> int | None:
    if value is None:
        return None
    try:
        milliseconds = int((Decimal(str(value)) * 1000).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
        return milliseconds if milliseconds > 0 else None
    except (InvalidOperation, ValueError):
        return None


def _driver_contracts(races: list[dict[str, Any]]) -> None:
    for race in races:
        for result in race.get("Results", []):
            driver_id = result.get("Driver", {}).get("driverId")
            constructor_id = result.get("Constructor", {}).get("constructorId")
            if not driver_id or not constructor_id:
                raise ValueError("Jolpica result is missing a driver or constructor source key")


def fetch_season(
    year: int,
    client: httpx.Client | None = None,
    cache_dir: Path | None = None,
    include_laps: bool = True,
) -> list[dict[str, Any]]:
    """Fetch and validate all season race, result, lap, and pit-stop payloads."""
    owned_client = client is None
    client = client or httpx.Client(timeout=30.0, headers={"User-Agent": "F1-Race-Strategy-Intelligence/0.1"})
    cache_dir = cache_dir or Path(__file__).resolve().parents[3] / ".cache" / "jolpica"
    try:
        races = _collection(client, f"{year}/races.json", "Races", cache_dir)
        if not races:
            raise ValueError(f"Jolpica returned no races for {year}")
        if not include_laps:
            results_by_round = _season_records(client, f"{year}/results.json", "Results", cache_dir)
        completed: list[dict[str, Any]] = []
        for race in races:
            round_number = _positive_int(race.get("round"), "round")
            if include_laps:
                results = _collection(client, f"{year}/{round_number}/results.json", "Results", cache_dir)
                pit_stops = None
            else:
                results = results_by_round.get(str(round_number), [])
                pit_stops = None
            if not results:
                continue  # A scheduled future/cancelled round is not a race result.
            laps = _collection(client, f"{year}/{round_number}/laps.json", "Laps", cache_dir) if include_laps else []
            if pit_stops is None:
                pit_stops = _collection(client, f"{year}/{round_number}/pitstops.json", "PitStops", cache_dir)
            event = {**race, "Results": results, "Laps": laps, "PitStops": pit_stops}
            completed.append(event)
        if not completed:
            raise ValueError(f"Jolpica returned no completed race results for {year}")
        _driver_contracts(completed)
        return completed
    finally:
        if owned_client:
            client.close()


def _upsert_event(connection: Connection, year: int, event: dict[str, Any]) -> tuple[int, datetime, dict[str, int]]:
    season = _positive_int(year, "season")
    round_number = _positive_int(event.get("round"), "round")
    circuit = event["Circuit"]
    location = circuit["Location"]
    circuit_key = f"jolpica:{circuit['circuitId']}"
    race_key = f"jolpica:{year}:{round_number}"
    race_name = str(event["raceName"]).strip()
    race_date = date.fromisoformat(event["date"])

    collision = connection.execute(text("""
        SELECT source_race_key FROM races
        WHERE season_id = (SELECT season_id FROM seasons WHERE year = :year)
          AND race_name = :name
    """), {"year": season, "name": race_name}).first()
    if collision and collision[0] != race_key:
        raise ValueError(f"Race name collision for {year} {race_name}; refusing to replace another source")

    connection.execute(text("INSERT INTO seasons (year) VALUES (:year) ON DUPLICATE KEY UPDATE year=VALUES(year)"),
                       {"year": season})
    connection.execute(text("""
        INSERT INTO circuits (source_circuit_key, name, location, country, record_source)
        VALUES (:key, :name, :location, :country, 'imported')
        ON DUPLICATE KEY UPDATE name=VALUES(name), location=VALUES(location), country=VALUES(country), record_source='imported'
    """), {"key": circuit_key, "name": circuit["circuitName"], "location": location.get("locality"),
          "country": location.get("country")})
    circuit_name = connection.execute(text("SELECT circuit_id FROM circuits WHERE source_circuit_key=:key"),
                                      {"key": circuit_key}).scalar_one()
    connection.execute(text("""
        INSERT INTO races (season_id,circuit_id,source_race_key,race_name,race_date,record_source)
        VALUES ((SELECT season_id FROM seasons WHERE year=:year),:circuit,:key,:name,:date,'imported')
        ON DUPLICATE KEY UPDATE circuit_id=VALUES(circuit_id),race_name=VALUES(race_name),race_date=VALUES(race_date),record_source='imported'
    """), {"year": season, "circuit": circuit_name, "key": race_key, "name": race_name, "date": race_date})
    race_id = int(connection.execute(text("SELECT race_id FROM races WHERE source_race_key=:key"),
                                     {"key": race_key}).scalar_one())
    session_key = f"{race_key}:R"
    session_date = datetime.fromisoformat(f"{event['date']}T{event.get('time', '00:00:00').replace('Z', '+00:00')}").replace(tzinfo=None)
    connection.execute(text("""
        INSERT INTO sessions (race_id,session_type,session_date,source_session_key)
        VALUES (:race,'RACE',:date,:key)
        ON DUPLICATE KEY UPDATE session_date=VALUES(session_date),source_session_key=VALUES(source_session_key)
    """), {"race": race_id, "date": session_date, "key": session_key})

    driver_result_ids: dict[str, int] = {}
    for result in event["Results"]:
        driver = result["Driver"]
        constructor = result["Constructor"]
        driver_key = f"jolpica:{driver['driverId']}"
        team_key = f"jolpica:{constructor['constructorId']}"
        number = _positive_int(result.get("number"), "car number")
        driver_name = f"{driver['givenName']} {driver['familyName']}".strip()
        for table, column, key, name in (("drivers", "source_driver_key", driver_key, driver_name),
                                         ("constructors", "source_constructor_key", team_key, constructor["name"])):
            by_name = connection.execute(text(f"SELECT {column} FROM {table} WHERE name=:name" if table == "constructors"
                                              else f"SELECT {column} FROM {table} WHERE full_name=:name"),
                                         {"name": name}).first()
            if by_name and by_name[0] not in (None, key):
                raise ValueError(f"{name} already exists under a different {table} source key")
        connection.execute(text("""
            INSERT INTO drivers (source_driver_key,driver_number,full_name,nationality,record_source)
            VALUES (:key,:number,:name,:nationality,'imported')
            ON DUPLICATE KEY UPDATE driver_number=VALUES(driver_number),full_name=VALUES(full_name),nationality=VALUES(nationality),record_source='imported'
        """), {"key": driver_key, "number": number, "name": driver_name, "nationality": driver.get("nationality")})
        connection.execute(text("""
            INSERT INTO constructors (source_constructor_key,name,country,record_source)
            VALUES (:key,:name,:country,'imported')
            ON DUPLICATE KEY UPDATE name=VALUES(name),country=VALUES(country),record_source='imported'
        """), {"key": team_key, "name": constructor["name"], "country": constructor.get("nationality")})
        driver_id = connection.execute(text("SELECT driver_id FROM drivers WHERE source_driver_key=:key"),
                                       {"key": driver_key}).scalar_one()
        constructor_id = connection.execute(text("SELECT constructor_id FROM constructors WHERE source_constructor_key=:key"),
                                            {"key": team_key}).scalar_one()
        season_id = connection.execute(text("SELECT season_id FROM seasons WHERE year=:year"), {"year": season}).scalar_one()
        connection.execute(text("""
            INSERT INTO driver_team_seasons (driver_id,constructor_id,season_id,car_number)
            VALUES (:driver,:team,:season,:number)
            ON DUPLICATE KEY UPDATE car_number=VALUES(car_number)
        """), {"driver": driver_id, "team": constructor_id, "season": season_id, "number": number})
        driver_team_id = connection.execute(text("""
            SELECT driver_team_id FROM driver_team_seasons
            WHERE driver_id=:driver AND season_id=:season AND constructor_id=:constructor
        """), {"driver": driver_id, "season": season_id, "constructor": constructor_id}).scalar_one()
        raw_position = result.get("position")
        position = int(raw_position) if raw_position and str(raw_position).isdigit() else None
        classified_laps = int(result["laps"]) if str(result.get("laps", "")).isdigit() else None
        connection.execute(text("""
            INSERT INTO race_results (race_id,driver_team_id,position,points,status,classified_laps,record_source)
            VALUES (:race,:driver_team,:position,:points,:status,:laps,'imported')
            ON DUPLICATE KEY UPDATE position=VALUES(position),points=VALUES(points),status=VALUES(status),classified_laps=VALUES(classified_laps),record_source='imported'
        """), {"race": race_id, "driver_team": driver_team_id, "position": position,
              "points": Decimal(str(result.get("points", "0"))), "status": str(result.get("status", "Unknown"))[:48],
              "laps": classified_laps})
        result_id = int(connection.execute(text("""
            SELECT result_id FROM race_results WHERE race_id=:race AND driver_team_id=:driver_team
        """), {"race": race_id, "driver_team": driver_team_id}).scalar_one())
        driver_result_ids[driver["driverId"]] = result_id
    return race_id, session_date, driver_result_ids


def import_qualifying_season(
    connection: Connection,
    year: int,
    qualifying_by_round: dict[str, list[dict[str, Any]]],
) -> dict[str, int]:
    """Persist official qualifying positions and times for already-imported races."""
    year_value = _positive_int(year, "season")
    total = {"races": 0, "qualifying_rows": 0}
    for round_number, rows in qualifying_by_round.items():
        if not rows:
            continue
        race_key = f"jolpica:{year_value}:{_positive_int(round_number, 'round')}"
        race_id = connection.execute(
            text("SELECT race_id FROM races WHERE source_race_key=:race_key AND record_source='imported'"),
            {"race_key": race_key},
        ).scalar_one_or_none()
        if race_id is None:
            # Jolpica can list qualifying for a cancelled/postponed event; do not create a race from qualifying alone.
            continue
        session_key = f"{race_key}:Q"
        connection.execute(text("""
            INSERT INTO sessions (race_id,session_type,source_session_key)
            VALUES (:race,'QUALIFYING',:session_key)
            ON DUPLICATE KEY UPDATE source_session_key=VALUES(source_session_key)
        """), {"race": race_id, "session_key": session_key})
        session_id = connection.execute(
            text("SELECT session_id FROM sessions WHERE source_session_key=:session_key"),
            {"session_key": session_key},
        ).scalar_one()
        parameters = []
        for row in rows:
            driver = row.get("Driver") or {}
            constructor = row.get("Constructor") or {}
            if isinstance(constructor, list):
                constructor = constructor[0] if constructor else {}
            source_driver = driver.get("driverId")
            source_constructor = constructor.get("constructorId")
            if not source_driver or not source_constructor:
                continue
            driver_team_id = connection.execute(text("""
                SELECT dt.driver_team_id
                FROM driver_team_seasons dt
                JOIN drivers d ON d.driver_id=dt.driver_id
                JOIN constructors c ON c.constructor_id=dt.constructor_id
                JOIN seasons s ON s.season_id=dt.season_id
                WHERE d.source_driver_key=:driver_key AND c.source_constructor_key=:constructor_key
                  AND s.year=:year
            """), {"driver_key": f"jolpica:{source_driver}",
                  "constructor_key": f"jolpica:{source_constructor}", "year": year_value}).scalar_one_or_none()
            if driver_team_id is None:
                continue
            raw_position = row.get("position")
            position = int(raw_position) if raw_position and str(raw_position).isdigit() else None
            parameters.append({
                "session_id": session_id,
                "driver_team_id": driver_team_id,
                "position": position,
                "q1": _lap_ms(row.get("Q1")),
                "q2": _lap_ms(row.get("Q2")),
                "q3": _lap_ms(row.get("Q3")),
            })
        if parameters:
            connection.execute(text("""
                INSERT INTO qualifying_results
                  (session_id,driver_team_id,position,q1_time_ms,q2_time_ms,q3_time_ms,record_source)
                VALUES
                  (:session_id,:driver_team_id,:position,:q1,:q2,:q3,'imported')
                ON DUPLICATE KEY UPDATE position=VALUES(position),q1_time_ms=VALUES(q1_time_ms),
                  q2_time_ms=VALUES(q2_time_ms),q3_time_ms=VALUES(q3_time_ms),record_source='imported'
            """), parameters)
        total["races"] += 1
        total["qualifying_rows"] += len(parameters)
    return total


def import_season(
    connection: Connection,
    year: int,
    races: list[dict[str, Any]] | None = None,
    progress: Callable[[int, int, str], None] | None = None,
) -> dict[str, int]:
    """Persist a validated Jolpica season atomically; rerunning updates source rows."""
    races = races if races is not None else fetch_season(year)
    _driver_contracts(races)
    total = {"races": 0, "results": 0, "lap_rows": 0, "pit_stop_rows": 0}
    for round_index, event in enumerate(races, start=1):
        race_id, _, result_ids = _upsert_event(connection, year, event)
        total["races"] += 1
        total["results"] += len(result_ids)
        best_lap: dict[str, int] = {}
        lap_records: list[tuple[str, int, int | None]] = []
        for lap in event.get("Laps", []):
            lap_number = _positive_int(lap.get("number"), "lap number")
            for timing in lap.get("Timings", []):
                driver_id = timing.get("driverId")
                if driver_id not in result_ids:
                    continue
                milliseconds = _lap_ms(timing.get("time"))
                lap_records.append((driver_id, lap_number, milliseconds))
                if milliseconds is not None and (driver_id not in best_lap or milliseconds < best_lap[driver_id]):
                    best_lap[driver_id] = milliseconds
        lap_parameters = []
        for driver_id, lap_number, milliseconds in lap_records:
            lap_parameters.append({
                "result": result_ids[driver_id],
                "lap": lap_number,
                "time": milliseconds,
                "best": milliseconds is not None and milliseconds == best_lap.get(driver_id),
            })
        if lap_parameters:
            connection.execute(text("""
                INSERT INTO lap_times (result_id,lap_number,lap_time_ms,is_personal_best)
                VALUES (:result,:lap,:time,:best)
                ON DUPLICATE KEY UPDATE lap_time_ms=VALUES(lap_time_ms),is_personal_best=VALUES(is_personal_best)
            """), lap_parameters)
        total["lap_rows"] += len(lap_records)
        pit_parameters = []
        for stop in event.get("PitStops", []):
            driver_id = stop.get("driverId")
            if driver_id not in result_ids:
                continue
            pit_parameters.append({"result": result_ids[driver_id],
                                   "number": _positive_int(stop.get("stop"), "pit-stop number"),
                                   "lap": _positive_int(stop.get("lap"), "pit-stop lap"),
                                   "duration": _seconds_ms(stop.get("duration"))})
        if pit_parameters:
            connection.execute(text("""
                INSERT INTO pit_stops (result_id,stop_number,lap_number,duration_ms,stop_reason)
                VALUES (:result,:number,:lap,:duration,NULL)
                ON DUPLICATE KEY UPDATE lap_number=VALUES(lap_number),duration_ms=VALUES(duration_ms)
            """), pit_parameters)
        total["pit_stop_rows"] += len(pit_parameters)
        if progress:
            progress(round_index, len(races), str(event.get("raceName", f"Round {round_index}")))
    return total
