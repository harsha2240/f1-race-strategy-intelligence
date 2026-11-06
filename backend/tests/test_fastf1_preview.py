import pandas as pd

from app.ingestion.fastf1_preview import transform_laps, validate_records


def test_transform_preserves_missing_lap_time() -> None:
    frame = pd.DataFrame([
        {"Driver": "EXM", "LapNumber": 1, "LapTime": pd.NaT, "Compound": None, "Stint": 1, "TyreLife": 1},
    ])
    rows = transform_laps(frame)
    assert rows[0]["lap_time_ms"] is None
    assert rows[0]["record_source"] == "imported"
    assert validate_records(rows) == []


def test_transform_skips_invalid_lap_number() -> None:
    frame = pd.DataFrame([
        {"Driver": "EXM", "LapNumber": 0, "LapTime": pd.NaT, "Compound": None, "Stint": None, "TyreLife": None},
    ])
    assert transform_laps(frame) == []
