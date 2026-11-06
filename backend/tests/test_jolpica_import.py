from app.ingestion import jolpica_import
from app.ingestion.jolpica_import import (
    _driver_contracts,
    _lap_ms,
    _seconds_ms,
    fetch_qualifying_season,
)


def test_parses_jolpica_lap_and_pit_stop_durations():
    assert _lap_ms("1:37.284") == 97_284
    assert _lap_ms(None) is None
    assert _lap_ms("unknown") is None
    assert _seconds_ms("22.345") == 22_345
    assert _seconds_ms("0") is None


def test_season_contract_validation_allows_stable_constructor():
    _driver_contracts([{
        "Results": [{"Driver": {"driverId": "driver"}, "Constructor": {"constructorId": "team"}}]
    }])


def test_season_contract_validation_accepts_substitute_team_change():
    races = [
        {"Results": [{"Driver": {"driverId": "driver"}, "Constructor": {"constructorId": "team-a"}}]},
        {"Results": [{"Driver": {"driverId": "driver"}, "Constructor": {"constructorId": "team-b"}}]},
    ]
    _driver_contracts(races)


def test_season_wide_records_are_grouped_by_race_round(monkeypatch):
    payload = {
        "total": "3",
        "RaceTable": {"Races": [
            {"round": "1", "Results": [{"number": "1"}, {"number": "2"}]},
            {"round": "2", "Results": [{"number": "3"}]},
        ]},
    }
    monkeypatch.setattr(jolpica_import, "_get_json", lambda client, path, offset, cache_dir: payload)
    assert jolpica_import._season_records(object(), "2024/results.json", "Results") == {
        "1": [{"number": "1"}, {"number": "2"}],
        "2": [{"number": "3"}],
    }


def test_qualifying_season_records_are_grouped_by_round(monkeypatch):
    payload = {
        "total": "2",
        "RaceTable": {"Races": [
            {"round": "1", "QualifyingResults": [{"position": "1", "Q3": "1:23.456"}]},
            {"round": "2", "QualifyingResults": [{"position": "1", "Q3": "1:22.100"}]},
        ]},
    }
    monkeypatch.setattr(jolpica_import, "_get_json", lambda client, path, offset, cache_dir: payload)
    assert fetch_qualifying_season(2024, client=object(), cache_dir=None) == {
        "1": [{"position": "1", "Q3": "1:23.456"}],
        "2": [{"position": "1", "Q3": "1:22.100"}],
    }
