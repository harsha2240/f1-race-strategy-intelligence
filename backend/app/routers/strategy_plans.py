import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import bindparam, text
from sqlalchemy.exc import SQLAlchemyError

from app.auth import require_permission
from app.db import engine
from app.schemas_strategy import StrategyComparisonInput, StrategyPlanInput
from app.strategy_simulator import balanced_stints, estimate_strategy

router = APIRouter(prefix="/api/strategy-plans", tags=["strategy plans"])


@router.post("/compare")
def compare_strategies(payload: StrategyComparisonInput, user: dict = Depends(require_permission("strategy:write", require_csrf=True))) -> dict:
    """Save and compare a balanced one-stop and two-stop hypothetical plan."""
    try:
        with engine.begin() as connection:
            race = connection.execute(text("""
                SELECT r.race_id,s.year,r.race_name,
                       (SELECT MAX(rr.classified_laps) FROM race_results rr
                        WHERE rr.race_id=r.race_id AND rr.record_source='imported') AS race_laps,
                       (SELECT AVG(lt.lap_time_ms) FROM lap_times lt
                        JOIN race_results rr ON rr.result_id=lt.result_id
                        JOIN driver_team_seasons dt ON dt.driver_team_id=rr.driver_team_id
                        WHERE rr.race_id=r.race_id AND rr.record_source='imported'
                          AND dt.driver_id=:driver_id AND lt.lap_time_ms IS NOT NULL) AS driver_mean_lap_ms
                FROM races r JOIN seasons s ON s.season_id=r.season_id
                WHERE r.race_id=:race_id AND r.record_source='imported'
            """), {"race_id": payload.race_id, "driver_id": payload.driver_id}).mappings().first()
            if race is None:
                raise HTTPException(status_code=404, detail="Race event not found")
            participant = connection.execute(text("""
                SELECT 1 FROM race_results rr JOIN driver_team_seasons dt ON dt.driver_team_id=rr.driver_team_id
                WHERE rr.race_id=:race_id AND dt.driver_id=:driver_id AND rr.record_source='imported' LIMIT 1
            """), {"race_id": payload.race_id, "driver_id": payload.driver_id}).first()
            if participant is None:
                raise HTTPException(status_code=422, detail="Choose a driver who participated in this race")
            if race["race_laps"] is None or race["race_laps"] < 3:
                raise HTTPException(status_code=422, detail="This race has no usable recorded race distance")

            baseline = float(payload.baseline_lap_ms or race["driver_mean_lap_ms"] or 90000)
            baseline_source = ("your entered baseline" if payload.baseline_lap_ms else
                              "this driver's recorded mean lap time for this race" if race["driver_mean_lap_ms"] else
                              "generic 90-second lap fallback; no detailed lap timing is imported for this event")
            compound_rows = connection.execute(text("SELECT compound_id,name FROM tyre_compounds WHERE name IN ('Soft','Medium','Hard')")).mappings().all()
            compound_ids = {row["name"]: row["compound_id"] for row in compound_rows}
            if len(compound_ids) != 3:
                raise HTTPException(status_code=503, detail="Strategy reference compounds are not configured")

            scenarios = []
            definitions = [("one_stop", ["Medium", "Hard"]), ("two_stop", ["Soft", "Medium", "Hard"])]
            for scenario_key, compounds in definitions:
                stints = balanced_stints(int(race["race_laps"]), compounds)
                plan = StrategyPlanInput(race_id=payload.race_id, driver_id=payload.driver_id,
                    strategy_type=f"scenario-{scenario_key}", stints=stints,
                    pit_loss_ms=payload.pit_loss_ms, degradation_ms_per_lap=payload.degradation_ms_per_lap,
                    baseline_lap_ms=int(baseline))
                estimate = estimate_strategy(plan, baseline)
                assumptions = {"model":"same average lap pace + linear stint-age wear + fixed pit loss",
                    "baseline_source":baseline_source,"pit_loss_ms":payload.pit_loss_ms,
                    "degradation_ms_per_lap":payload.degradation_ms_per_lap,
                    "compound_effects_modeled":False,"is_hypothetical":True,"not_actual_result":True}
                inserted = connection.execute(text("""
                    INSERT INTO strategy_plans(race_id,driver_id,created_by_user_id,strategy_type,assumptions)
                    VALUES(:race_id,:driver_id,:user_id,:strategy_type,:assumptions)
                """), {"race_id":payload.race_id,"driver_id":payload.driver_id,"user_id":user["user_id"],
                      "strategy_type":plan.strategy_type,"assumptions":json.dumps(assumptions)})
                plan_id = inserted.lastrowid
                for index,stint in enumerate(stints,start=1):
                    connection.execute(text("""
                        INSERT INTO strategy_stints(plan_id,compound_id,stint_number,start_lap,end_lap)
                        VALUES(:plan_id,:compound_id,:number,:start,:end)
                    """), {"plan_id":plan_id,"compound_id":compound_ids[stint.compound],"number":index,
                          "start":stint.start_lap,"end":stint.end_lap})
                connection.execute(text("""
                    INSERT INTO strategy_reports(plan_id,title,report_body,report_metadata)
                    VALUES(:plan_id,:title,:body,:metadata)
                """), {"plan_id":plan_id,"title":f"Hypothetical {scenario_key.replace('_','-')} comparison: {race['race_name']}",
                      "body":"Simplified hypothetical comparison. It is not an actual race outcome.",
                      "metadata":json.dumps(estimate)})
                scenarios.append({"name":scenario_key,"pit_stops":len(stints)-1,"plan_id":plan_id,"estimate":estimate})
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Strategy database is unavailable") from exc

    delta_ms = float(scenarios[1]["estimate"]["estimated_total_ms"]) - float(scenarios[0]["estimate"]["estimated_total_ms"])
    return {"race":race["race_name"],"season":race["year"],"race_laps":race["race_laps"],
            "baseline_lap_ms":baseline,"baseline_source":baseline_source,"scenarios":scenarios,
            "two_stop_minus_one_stop_ms":delta_ms,
            "faster_estimate":"two_stop" if delta_ms < 0 else "one_stop" if delta_ms > 0 else "tie",
            "assumption_note":"Illustrative model only: same lap pace, linear tyre-age penalty, fixed pit loss; no traffic, weather, safety cars, actual compounds or telemetry."}


@router.post("/simulate")
def simulate_strategy(payload: StrategyPlanInput, user: dict = Depends(require_permission("strategy:write", require_csrf=True))) -> dict:
    try:
        with engine.begin() as connection:
            race = connection.execute(text("""
                SELECT r.race_id, s.year, r.race_name,
                       (SELECT MAX(rr.classified_laps) FROM race_results rr WHERE rr.race_id = r.race_id AND rr.record_source = 'imported') AS race_laps,
                       (SELECT AVG(lt.lap_time_ms) FROM lap_times lt
                        JOIN race_results rr ON rr.result_id = lt.result_id
                        JOIN driver_team_seasons dt ON dt.driver_team_id = rr.driver_team_id
                        WHERE rr.race_id = r.race_id AND rr.record_source = 'imported' AND dt.driver_id = :driver_id
                          AND lt.lap_time_ms IS NOT NULL) AS driver_mean_lap_ms
                FROM races r JOIN seasons s ON s.season_id = r.season_id
                WHERE r.race_id = :race_id AND r.record_source = 'imported'
            """), {"race_id": payload.race_id, "driver_id": payload.driver_id}).mappings().first()
            if race is None:
                raise HTTPException(status_code=404, detail="Race event not found")
            contract = connection.execute(text("""
                SELECT 1 FROM race_results rr
                JOIN driver_team_seasons dt ON dt.driver_team_id=rr.driver_team_id
                WHERE rr.race_id=:race_id AND dt.driver_id=:driver_id
                  AND rr.record_source='imported' LIMIT 1
            """), {"race_id": payload.race_id, "driver_id": payload.driver_id}).first()
            if contract is None:
                raise HTTPException(status_code=422, detail="Driver did not participate in this race")
            total_laps = payload.stints[-1].end_lap
            if race["race_laps"] and total_laps != race["race_laps"]:
                raise HTTPException(status_code=422, detail=f"Stints must cover the stored race distance of {race['race_laps']} laps")
            compound_names = {stint.compound for stint in payload.stints}
            compounds = connection.execute(text("SELECT compound_id, name FROM tyre_compounds WHERE name IN :names").bindparams(bindparam("names", expanding=True)), {"names": list(compound_names)}).mappings().all()
            compound_ids = {row["name"].casefold(): row["compound_id"] for row in compounds}
            if set(name.casefold() for name in compound_names) - set(compound_ids):
                raise HTTPException(status_code=422, detail="One or more tyre compounds are not in the database")
            empirical = float(race["driver_mean_lap_ms"]) if race["driver_mean_lap_ms"] is not None else None
            baseline = float(payload.baseline_lap_ms or empirical or 90000)
            source = "user-provided baseline lap time" if payload.baseline_lap_ms else "driver's recorded race mean" if empirical else "generic 90,000 ms fallback; no driver lap data exists"
            estimate = estimate_strategy(payload, baseline)
            assumptions = {
                "model": "constant baseline lap time plus linear per-lap stint degradation and fixed pit loss",
                "baseline_source": source,
                "degradation_ms_per_lap": payload.degradation_ms_per_lap,
                "pit_loss_ms": payload.pit_loss_ms,
                "estimated": True,
                "not_actual_result": True,
            }
            result = connection.execute(text("""
                INSERT INTO strategy_plans (race_id, driver_id, created_by_user_id, strategy_type, assumptions)
                VALUES (:race_id, :driver_id, :user_id, :strategy_type, :assumptions)
            """), {"race_id": payload.race_id, "driver_id": payload.driver_id,
                  "user_id": user["user_id"], "strategy_type": payload.strategy_type,
                  "assumptions": json.dumps(assumptions)})
            plan_id = result.lastrowid
            for index, stint in enumerate(payload.stints, start=1):
                connection.execute(text("""
                    INSERT INTO strategy_stints (plan_id, compound_id, stint_number, start_lap, end_lap)
                    VALUES (:plan_id, :compound_id, :stint_number, :start_lap, :end_lap)
                """), {"plan_id": plan_id, "compound_id": compound_ids[stint.compound.casefold()],
                      "stint_number": index, "start_lap": stint.start_lap, "end_lap": stint.end_lap})
            connection.execute(text("""
                INSERT INTO strategy_reports (plan_id, title, report_body, report_metadata)
                VALUES (:plan_id, :title, :body, :metadata)
            """), {"plan_id": plan_id, "title": f"Hypothetical strategy estimate: {race['race_name']}",
                  "body": "Estimated strategy time is a simplified model, not an actual race outcome.",
                  "metadata": json.dumps(estimate)})
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Strategy database is unavailable") from exc
    return {"plan_id": plan_id, "race": race["race_name"], "season": race["year"],
            "driver_id": payload.driver_id, "strategy_type": payload.strategy_type,
            "estimate": estimate, "assumptions": assumptions}
