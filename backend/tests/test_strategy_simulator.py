import pytest
from pydantic import ValidationError

from app.schemas_strategy import StrategyPlanInput
from app.strategy_simulator import balanced_stints, estimate_strategy


def test_strategy_estimate_labels_each_time_component():
    plan = StrategyPlanInput(
        race_id=1,
        driver_id=2,
        strategy_type="two-stop-estimate",
        stints=[
            {"compound": "Medium", "start_lap": 1, "end_lap": 10},
            {"compound": "Hard", "start_lap": 11, "end_lap": 20},
        ],
        pit_loss_ms=22000,
        degradation_ms_per_lap=80,
    )

    result = estimate_strategy(plan, 90000)

    assert result["estimated_lap_count"] == 20
    assert result["base_time_ms"] == 1_800_000
    assert result["degradation_time_ms"] == 7_200
    assert result["pit_time_ms"] == 22_000
    assert result["estimated_total_ms"] == 1_829_200


def test_strategy_plan_rejects_gaps_between_stints():
    with pytest.raises(ValidationError, match="consecutive laps"):
        StrategyPlanInput(
            race_id=1,
            driver_id=2,
            strategy_type="invalid",
            stints=[
                {"compound": "Medium", "start_lap": 1, "end_lap": 10},
                {"compound": "Hard", "start_lap": 12, "end_lap": 20},
            ],
            pit_loss_ms=22000,
            degradation_ms_per_lap=80,
        )


@pytest.mark.parametrize("count,expected_stops", [(2, 1), (3, 2)])
def test_balanced_strategy_scenarios_cover_every_race_lap(count, expected_stops):
    compounds = ["Medium", "Hard"] if count == 2 else ["Soft", "Medium", "Hard"]
    stints = balanced_stints(58, compounds)

    assert len(stints) == count
    assert len(stints) - 1 == expected_stops
    assert stints[0].start_lap == 1
    assert stints[-1].end_lap == 58
    assert all(current.start_lap == previous.end_lap + 1 for previous, current in zip(stints, stints[1:]))
