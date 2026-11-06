"""Persist a validated FastF1 race session to the relational core."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

import pandas as pd
from sqlalchemy import text
from sqlalchemy.engine import Connection

from app.ingestion.fastf1_preview import transform_laps, validate_records


def _value(value: Any) -> Any:
    if value is None or pd.isna(value):
        return None
    return value


def _int(value: Any) -> int | None:
    value = _value(value)
    try:
        return int(value) if value is not None and int(value) > 0 else None
    except (TypeError, ValueError, OverflowError):
        return None


def _float(value: Any) -> float | None:
    value = _value(value)
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError, OverflowError):
        return None


def _duration_ms(value: Any) -> int | None:
    value = _value(value)
    try:
        result = int(round(value.total_seconds() * 1000))
        return result if result > 0 else None
    except (AttributeError, TypeError, ValueError, OverflowError):
        return None


def _event_value(event: Any, key: str) -> Any:
    try:
        return _value(event.get(key))
    except AttributeError:
        return None


def persist_race_session(connection: Connection, session: Any, season: int, event_name: str) -> dict[str, int]:
    """Load a race result and lap/stint data; rejects ambiguous or incomplete source rows."""
    event = session.event
    round_number = _int(_event_value(event, "RoundNumber"))
    if round_number is None:
        raise ValueError("FastF1 event has no valid round number; refusing to create a race key")
    official_name = str(_event_value(event, "EventName") or event_name).strip()
    country = str(_event_value(event, "Country") or "Unknown").strip()
    location = str(_event_value(event, "Location") or country).strip()
    event_date = _event_value(event, "EventDate")
    if event_date is None:
        raise ValueError("FastF1 event date is missing")
    race_date: date = pd.Timestamp(event_date).date()
    race_key = f"fastf1:{season}:{round_number}"
    circuit_key = f"fastf1:{season}:{round_number}"
    session_key = f"{race_key}:R"
    result_frame = session.results
    if result_frame is None or result_frame.empty:
        raise ValueError("FastF1 returned no race classification rows")
    lap_rows = transform_laps(session.laps)
    validation_errors = validate_records(lap_rows)
    if validation_errors:
        raise ValueError("FastF1 lap validation failed: " + "; ".join(validation_errors[:5]))

    connection.execute(text("INSERT INTO seasons (year) VALUES (:year) ON DUPLICATE KEY UPDATE year = VALUES(year)"), {"year": season})
    connection.execute(text("""
        INSERT INTO circuits (source_circuit_key, name, location, country, record_source)
        VALUES (:source_key, :name, :location, :country, 'imported')
        ON DUPLICATE KEY UPDATE name = VALUES(name), location = VALUES(location), country = VALUES(country), record_source = 'imported'
    """), {"source_key": circuit_key, "name": location, "location": location, "country": country})
    season_id = connection.execute(text("SELECT season_id FROM seasons WHERE year = :year"), {"year": season}).scalar_one()
    name_collision = connection.execute(text("""
        SELECT source_race_key, record_source FROM races
        WHERE season_id = :season_id AND race_name = :name
    """), {"season_id": season_id, "name": official_name}).mappings().first()
    if name_collision and name_collision["source_race_key"] != race_key:
        raise ValueError("A different race source already uses this season and event name; refusing to replace it")
    connection.execute(text("""
        INSERT INTO races (season_id, circuit_id, source_race_key, race_name, race_date, record_source)
        SELECT s.season_id, c.circuit_id, :race_key, :name, :race_date, 'imported'
        FROM seasons s JOIN circuits c ON c.source_circuit_key = :circuit_key WHERE s.year = :year
        ON DUPLICATE KEY UPDATE race_name = VALUES(race_name), race_date = VALUES(race_date), record_source = 'imported'
    """), {"race_key": race_key, "name": official_name, "race_date": race_date,
          "circuit_key": circuit_key, "year": season})
    race = connection.execute(text("""
        SELECT r.race_id, r.record_source FROM races r WHERE r.source_race_key = :key
    """), {"key": race_key}).mappings().one()
    race_id = int(race["race_id"])
    connection.execute(text("""
        INSERT INTO sessions (race_id, session_type, source_session_key)
        VALUES (:race_id, 'RACE', :source_key)
        ON DUPLICATE KEY UPDATE source_session_key = VALUES(source_session_key)
    """), {"race_id": race_id, "source_key": session_key})
    session_id = connection.execute(text("SELECT session_id FROM sessions WHERE source_session_key = :key"), {"key": session_key}).scalar_one()

    result_ids: dict[str, int] = {}
    best_laps: dict[str, int] = {}
    for row in lap_rows:
        duration = row["lap_time_ms"]
        if duration is not None:
            current = best_laps.get(row["driver_code"])
            if current is None or duration < current:
                best_laps[row["driver_code"]] = duration
    for _, row in result_frame.iterrows():
        code = _value(row.get("Abbreviation"))
        number = _int(row.get("DriverNumber"))
        team = _value(row.get("TeamName"))
        full_name = _value(row.get("FullName"))
        if code is None or number is None or team is None or full_name is None:
            raise ValueError("FastF1 classification row is missing driver, car number, team, or name")
        driver_key = f"fastf1:{str(code).strip().upper()}"
        team_key = f"fastf1:{str(team).strip()}"
        team_name_collision = connection.execute(text("""
            SELECT source_constructor_key FROM constructors WHERE name = :name
        """), {"name": str(team).strip()}).first()
        if team_name_collision and team_name_collision[0] != team_key:
            raise ValueError(f"Constructor name {team} already belongs to a different source key")
        connection.execute(text("""
            INSERT INTO drivers (source_driver_key, driver_number, full_name, record_source)
            VALUES (:source_key, :number, :name, 'imported')
            ON DUPLICATE KEY UPDATE driver_number = VALUES(driver_number), full_name = VALUES(full_name), record_source = 'imported'
        """), {"source_key": driver_key, "number": number, "name": str(full_name).strip()})
        connection.execute(text("""
            INSERT INTO constructors (source_constructor_key, name, record_source)
            VALUES (:source_key, :name, 'imported')
            ON DUPLICATE KEY UPDATE name = VALUES(name), record_source = 'imported'
        """), {"source_key": team_key, "name": str(team).strip()})
        driver_id = connection.execute(text("SELECT driver_id FROM drivers WHERE source_driver_key = :key"), {"key": driver_key}).scalar_one()
        team_id = connection.execute(text("SELECT constructor_id FROM constructors WHERE source_constructor_key = :key"), {"key": team_key}).scalar_one()
        season_id = connection.execute(text("SELECT season_id FROM seasons WHERE year = :year"), {"year": season}).scalar_one()
        connection.execute(text("""
            INSERT INTO driver_team_seasons (driver_id, constructor_id, season_id, car_number)
            VALUES (:driver_id, :team_id, :season_id, :number)
            ON DUPLICATE KEY UPDATE car_number = VALUES(car_number)
        """), {"driver_id": driver_id, "team_id": team_id, "season_id": season_id, "number": number})
        driver_team_id = connection.execute(text("""
            SELECT driver_team_id FROM driver_team_seasons
            WHERE driver_id = :driver_id AND season_id = :season_id AND constructor_id = :team_id
        """), {"driver_id": driver_id, "season_id": season_id, "team_id": team_id}).scalar_one()
        position = _int(row.get("Position"))
        points = _value(row.get("Points"))
        status = str(_value(row.get("Status")) or "Unknown")[:48]
        classified_laps = max((item["lap_number"] for item in lap_rows if item["driver_code"] == str(code)), default=None)
        connection.execute(text("""
            INSERT INTO race_results (race_id, driver_team_id, position, points, status, classified_laps, record_source)
            VALUES (:race_id, :driver_team_id, :position, :points, :status, :laps, 'imported')
            ON DUPLICATE KEY UPDATE position = VALUES(position), points = VALUES(points), status = VALUES(status),
                                    classified_laps = VALUES(classified_laps), record_source = 'imported'
        """), {"race_id": race_id, "driver_team_id": driver_team_id, "position": position,
              "points": float(points) if _value(points) is not None else 0,
              "status": status, "laps": classified_laps})
        result_id = connection.execute(text("""
            SELECT result_id FROM race_results WHERE race_id = :race_id AND driver_team_id = :driver_team_id
        """), {"race_id": race_id, "driver_team_id": driver_team_id}).scalar_one()
        result_ids[str(code)] = int(result_id)
        if code in best_laps:
            connection.execute(text("UPDATE lap_times SET is_personal_best = FALSE WHERE result_id = :id"), {"id": result_id})

    written_laps = 0
    stints: dict[tuple[str, int], dict[str, Any]] = {}
    pit_stops: dict[str, list[int]] = {}
    for _, lap_row in session.laps.iterrows():
        driver = _value(lap_row.get("Driver"))
        lap_number = _int(lap_row.get("LapNumber"))
        if driver is not None and lap_number is not None and _value(lap_row.get("PitInTime")) is not None:
            pit_stops.setdefault(str(driver), []).append(lap_number)
    for lap in lap_rows:
        result_id = result_ids.get(lap["driver_code"])
        if result_id is None:
            continue
        is_best = lap["lap_time_ms"] is not None and lap["lap_time_ms"] == best_laps.get(lap["driver_code"])
        connection.execute(text("""
            INSERT INTO lap_times (result_id, lap_number, lap_time_ms, is_personal_best)
            VALUES (:result_id, :lap_number, :lap_time_ms, :is_best)
            ON DUPLICATE KEY UPDATE lap_time_ms = VALUES(lap_time_ms), is_personal_best = VALUES(is_personal_best)
        """), {"result_id": result_id, "lap_number": lap["lap_number"], "lap_time_ms": lap["lap_time_ms"], "is_best": is_best})
        written_laps += 1
        stint_number = lap["stint_number"]
        compound = lap["compound"]
        if stint_number and compound:
            key = (lap["driver_code"], stint_number)
            group = stints.setdefault(key, {"result_id": result_id, "compound": compound, "start": lap["lap_number"], "end": lap["lap_number"]})
            if group["compound"] != compound:
                raise ValueError(f"Conflicting compounds reported for {lap['driver_code']} stint {stint_number}")
            group["start"] = min(group["start"], lap["lap_number"])
            group["end"] = max(group["end"], lap["lap_number"])
    for (code, stint_number), stint in stints.items():
        connection.execute(text("INSERT INTO tyre_compounds (name) VALUES (:name) ON DUPLICATE KEY UPDATE name = VALUES(name)"), {"name": stint["compound"]})
        compound_id = connection.execute(text("SELECT compound_id FROM tyre_compounds WHERE name = :name"), {"name": stint["compound"]}).scalar_one()
        connection.execute(text("""
            INSERT INTO tyre_stints (result_id, compound_id, stint_number, start_lap, end_lap)
            VALUES (:result_id, :compound_id, :number, :start_lap, :end_lap)
            ON DUPLICATE KEY UPDATE compound_id = VALUES(compound_id), start_lap = VALUES(start_lap), end_lap = VALUES(end_lap)
        """), {"result_id": stint["result_id"], "compound_id": compound_id, "number": stint_number,
              "start_lap": stint["start"], "end_lap": stint["end"]})
    pit_rows = 0
    for code, pit_laps in pit_stops.items():
        result_id = result_ids.get(code)
        if result_id is None:
            continue
        for stop_number, lap_number in enumerate(sorted(set(pit_laps)), start=1):
            connection.execute(text("""
                INSERT INTO pit_stops (result_id, stop_number, lap_number, duration_ms, stop_reason)
                VALUES (:result_id, :stop_number, :lap_number, NULL, NULL)
                ON DUPLICATE KEY UPDATE lap_number = VALUES(lap_number), duration_ms = NULL
            """), {"result_id": result_id, "stop_number": stop_number, "lap_number": lap_number})
            pit_rows += 1

    weather_frame = getattr(session, "weather_data", None)
    weather_rows = 0
    if weather_frame is not None and not weather_frame.empty:
        session_start = pd.Timestamp(getattr(session, "date", event_date))
        for _, weather in weather_frame.iterrows():
            offset = _value(weather.get("Time"))
            if offset is None:
                continue
            try:
                observed_at = (session_start + pd.to_timedelta(offset)).to_pydatetime().replace(tzinfo=None)
            except (TypeError, ValueError, OverflowError):
                continue
            rainfall = _value(weather.get("Rainfall"))
            connection.execute(text("""
                INSERT INTO weather_observations
                  (session_id, observed_at, air_temp_c, track_temp_c, humidity_pct, rainfall, wind_speed_kph, source)
                VALUES (:session_id, :observed_at, :air_temp, :track_temp, :humidity, :rainfall, :wind, 'FastF1')
                ON DUPLICATE KEY UPDATE air_temp_c = VALUES(air_temp_c), track_temp_c = VALUES(track_temp_c),
                  humidity_pct = VALUES(humidity_pct), rainfall = VALUES(rainfall), wind_speed_kph = VALUES(wind_speed_kph)
            """), {"session_id": session_id, "observed_at": observed_at,
                  "air_temp": _float(weather.get("AirTemp")), "track_temp": _float(weather.get("TrackTemp")),
                  "humidity": _float(weather.get("Humidity")),
                  "rainfall": None if rainfall is None else bool(rainfall),
                  "wind": _float(weather.get("WindSpeed"))})
            weather_rows += 1
    return {"race_id": race_id, "drivers": len(result_ids), "lap_rows": written_laps,
            "stint_rows": len(stints), "pit_stop_rows": pit_rows, "weather_rows": weather_rows}
