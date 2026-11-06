from app.schemas_strategy import StrategyPlanInput, StrategyStintInput


def balanced_stints(race_laps: int, compounds: list[str]) -> list[StrategyStintInput]:
    """Split a race into evenly balanced hypothetical tyre stints."""
    if race_laps < len(compounds) or not compounds:
        raise ValueError("Race distance must contain at least one lap per stint")
    base_laps, extra_laps = divmod(race_laps, len(compounds))
    stints: list[StrategyStintInput] = []
    start_lap = 1
    for index, compound in enumerate(compounds):
        stint_laps = base_laps + (1 if index < extra_laps else 0)
        end_lap = start_lap + stint_laps - 1
        stints.append(StrategyStintInput(compound=compound, start_lap=start_lap, end_lap=end_lap))
        start_lap = end_lap + 1
    return stints


def estimate_strategy(plan: StrategyPlanInput, baseline_lap_ms: float) -> dict[str, float | int | str | list[dict[str, int | str]]]:
    """Calculate a transparent, deterministic pace estimate; this is not an outcome prediction."""
    lap_count = sum(stint.end_lap - stint.start_lap + 1 for stint in plan.stints)
    wear_laps = sum((stint.end_lap - stint.start_lap + 1) * (stint.end_lap - stint.start_lap) / 2 for stint in plan.stints)
    pit_time_ms = plan.pit_loss_ms * (len(plan.stints) - 1)
    base_time_ms = baseline_lap_ms * lap_count
    degradation_time_ms = plan.degradation_ms_per_lap * wear_laps
    return {
        "estimated_lap_count": lap_count,
        "baseline_lap_ms": baseline_lap_ms,
        "base_time_ms": base_time_ms,
        "degradation_time_ms": degradation_time_ms,
        "pit_time_ms": pit_time_ms,
        "estimated_total_ms": base_time_ms + degradation_time_ms + pit_time_ms,
        "stints": [
            {"compound": stint.compound, "start_lap": stint.start_lap, "end_lap": stint.end_lap}
            for stint in plan.stints
        ],
    }
