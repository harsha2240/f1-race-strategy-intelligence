from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import bindparam, text
from sqlalchemy.exc import SQLAlchemyError

from app.db import engine
from app.schemas import DashboardSummary, DriverSummary

router = APIRouter(prefix="/api", tags=["analytics"])


@router.get("/dashboard/summary", response_model=DashboardSummary)
def dashboard_summary() -> DashboardSummary:
    statement = text("""
        SELECT
          (SELECT COUNT(*) FROM races WHERE record_source = 'imported') AS races,
          (SELECT COUNT(*) FROM drivers WHERE record_source = 'imported') AS drivers,
          (SELECT COUNT(*) FROM constructors WHERE record_source = 'imported') AS constructors,
          (SELECT COUNT(*) FROM race_results WHERE record_source = 'imported') AS race_results,
          (SELECT AVG(position) FROM race_results WHERE record_source = 'imported' AND position IS NOT NULL) AS average_finish
    """)
    try:
        with engine.connect() as connection:
            row = connection.execute(statement).mappings().one()
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Race database is unavailable") from exc
    return DashboardSummary(**row)


@router.get("/drivers", response_model=list[DriverSummary])
def list_drivers(
    q: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[DriverSummary]:
    statement = text("""
        SELECT d.driver_id, d.full_name, d.nationality,
               COUNT(DISTINCT dt.season_id) AS seasons,
               COUNT(DISTINCT rr.result_id) AS race_starts,
               COALESCE(SUM(rr.points), 0) AS points
        FROM drivers d
        LEFT JOIN driver_team_seasons dt ON dt.driver_id = d.driver_id
        LEFT JOIN race_results rr ON rr.driver_team_id = dt.driver_team_id AND rr.record_source = 'imported'
        WHERE d.record_source = 'imported' AND (:query IS NULL OR d.full_name LIKE :pattern)
        GROUP BY d.driver_id, d.full_name, d.nationality
        ORDER BY d.full_name
        LIMIT :limit OFFSET :offset
    """)
    try:
        with engine.connect() as connection:
            rows = connection.execute(statement, {
                "query": q,
                "pattern": f"%{q}%" if q else None,
                "limit": limit,
                "offset": offset,
            }).mappings().all()
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Race database is unavailable") from exc
    return [DriverSummary(**row) for row in rows]


@router.get("/analytics/season-summary")
def season_summary() -> list[dict[str, int | float | None]]:
    statement = text("""
        SELECT s.year AS season,
          (SELECT COUNT(*) FROM races r WHERE r.season_id=s.season_id AND r.record_source='imported') AS races,
          (SELECT COUNT(*) FROM races r JOIN race_results rr ON rr.race_id=r.race_id
            WHERE r.season_id=s.season_id AND r.record_source='imported' AND rr.record_source='imported') AS results,
          (SELECT COUNT(*) FROM races r JOIN race_results rr ON rr.race_id=r.race_id
            JOIN lap_times lt ON lt.result_id=rr.result_id
            WHERE r.season_id=s.season_id AND r.record_source='imported' AND rr.record_source='imported') AS lap_records,
          (SELECT COUNT(*) FROM races r JOIN race_results rr ON rr.race_id=r.race_id
            JOIN pit_stops ps ON ps.result_id=rr.result_id
            WHERE r.season_id=s.season_id AND r.record_source='imported' AND rr.record_source='imported') AS pit_stops,
          (SELECT AVG(os.overtake_count)
            FROM races r JOIN race_overtake_summaries os ON os.race_id=r.race_id
            WHERE r.season_id=s.season_id AND r.record_source='imported') AS average_overtakes_per_race,
          (SELECT COUNT(*)
            FROM races r JOIN race_overtake_summaries os ON os.race_id=r.race_id
            WHERE r.season_id=s.season_id AND r.record_source='imported') AS overtake_coverage_races,
          (SELECT COALESCE(SUM(os.overtake_count),0)
            FROM races r JOIN race_overtake_summaries os ON os.race_id=r.race_id
            WHERE r.season_id=s.season_id AND r.record_source='imported') AS recorded_overtakes
        FROM seasons s
        WHERE EXISTS (SELECT 1 FROM races r WHERE r.season_id=s.season_id AND r.record_source='imported')
        ORDER BY s.year
    """)
    try:
        with engine.connect() as connection:
            return [dict(row) for row in connection.execute(statement).mappings().all()]
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Race database is unavailable") from exc


@router.get("/analytics/championship")
def championship_standings(season: int = Query(ge=1950, le=2100), category: str = Query(pattern="^(drivers|constructors)$")) -> list[dict]:
    if category == "drivers":
        statement = text("""
            SELECT d.driver_id AS entity_id, d.full_name AS name,
                   COALESCE(SUM(rr.points), 0) AS points,
                   SUM(CASE WHEN rr.position = 1 THEN 1 ELSE 0 END) AS wins,
                   SUM(CASE WHEN rr.position BETWEEN 1 AND 3 THEN 1 ELSE 0 END) AS podiums,
                   COUNT(rr.result_id) AS starts
            FROM race_results rr JOIN races r ON r.race_id=rr.race_id
            JOIN seasons s ON s.season_id=r.season_id
            JOIN driver_team_seasons dt ON dt.driver_team_id=rr.driver_team_id
            JOIN drivers d ON d.driver_id=dt.driver_id
            WHERE s.year=:season AND r.record_source='imported' AND rr.record_source='imported'
            GROUP BY d.driver_id,d.full_name ORDER BY points DESC,wins DESC,podiums DESC,name
        """)
    else:
        statement = text("""
            SELECT c.constructor_id AS entity_id, c.name,
                   COALESCE(SUM(rr.points), 0) AS points,
                   SUM(CASE WHEN rr.position = 1 THEN 1 ELSE 0 END) AS wins,
                   SUM(CASE WHEN rr.position BETWEEN 1 AND 3 THEN 1 ELSE 0 END) AS podiums,
                   COUNT(rr.result_id) AS starts
            FROM race_results rr JOIN races r ON r.race_id=rr.race_id
            JOIN seasons s ON s.season_id=r.season_id
            JOIN driver_team_seasons dt ON dt.driver_team_id=rr.driver_team_id
            JOIN constructors c ON c.constructor_id=dt.constructor_id
            WHERE s.year=:season AND r.record_source='imported' AND rr.record_source='imported'
            GROUP BY c.constructor_id,c.name ORDER BY points DESC,wins DESC,podiums DESC,name
        """)
    try:
        with engine.connect() as connection:
            return [dict(row) for row in connection.execute(statement, {"season": season}).mappings().all()]
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Race database is unavailable") from exc


@router.get("/analytics/season-champions")
def season_champions() -> list[dict]:
    statement = text("""
        WITH driver_totals AS (
          SELECT s.year AS season, d.full_name AS driver_name, SUM(rr.points) AS points,
                 SUM(CASE WHEN rr.position=1 THEN 1 ELSE 0 END) AS wins,
                 SUM(CASE WHEN rr.position BETWEEN 1 AND 3 THEN 1 ELSE 0 END) AS podiums
          FROM race_results rr JOIN races r ON r.race_id=rr.race_id
          JOIN seasons s ON s.season_id=r.season_id
          JOIN driver_team_seasons dt ON dt.driver_team_id=rr.driver_team_id
          JOIN drivers d ON d.driver_id=dt.driver_id
          WHERE r.record_source='imported' AND rr.record_source='imported'
          GROUP BY s.year,d.driver_id,d.full_name
        ), driver_ranked AS (
          SELECT *, ROW_NUMBER() OVER (PARTITION BY season ORDER BY points DESC,wins DESC,podiums DESC,driver_name) AS season_rank
          FROM driver_totals
        ), constructor_totals AS (
          SELECT s.year AS season,c.name AS constructor_name,SUM(rr.points) AS points,
                 SUM(CASE WHEN rr.position=1 THEN 1 ELSE 0 END) AS wins,
                 SUM(CASE WHEN rr.position BETWEEN 1 AND 3 THEN 1 ELSE 0 END) AS podiums
          FROM race_results rr JOIN races r ON r.race_id=rr.race_id
          JOIN seasons s ON s.season_id=r.season_id
          JOIN driver_team_seasons dt ON dt.driver_team_id=rr.driver_team_id
          JOIN constructors c ON c.constructor_id=dt.constructor_id
          WHERE r.record_source='imported' AND rr.record_source='imported'
          GROUP BY s.year,c.constructor_id,c.name
        ), constructor_ranked AS (
          SELECT *,ROW_NUMBER() OVER (PARTITION BY season ORDER BY points DESC,wins DESC,podiums DESC,constructor_name) AS season_rank
          FROM constructor_totals
        )
        SELECT d.season,d.driver_name,d.points AS driver_points,
               c.constructor_name,c.points AS constructor_points
        FROM driver_ranked d JOIN constructor_ranked c ON c.season=d.season
        WHERE d.season_rank=1 AND c.season_rank=1
        ORDER BY d.season
    """)
    try:
        with engine.connect() as connection:
            return [dict(row) for row in connection.execute(statement).mappings().all()]
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Race database is unavailable") from exc


@router.get("/analytics/race-podiums")
def season_race_podiums(season: int = Query(ge=1950, le=2100)) -> list[dict]:
    statement = text("""
        SELECT r.race_id,r.race_name,r.race_date,c.name AS circuit,
               MAX(CASE WHEN rr.position=1 THEN d.full_name END) AS first_driver,
               MAX(CASE WHEN rr.position=1 THEN con.name END) AS first_constructor,
               MAX(CASE WHEN rr.position=2 THEN d.full_name END) AS second_driver,
               MAX(CASE WHEN rr.position=2 THEN con.name END) AS second_constructor,
               MAX(CASE WHEN rr.position=3 THEN d.full_name END) AS third_driver,
               MAX(CASE WHEN rr.position=3 THEN con.name END) AS third_constructor
        FROM races r JOIN seasons s ON s.season_id=r.season_id
        JOIN circuits c ON c.circuit_id=r.circuit_id
        LEFT JOIN race_results rr ON rr.race_id=r.race_id AND rr.record_source='imported'
        LEFT JOIN driver_team_seasons dt ON dt.driver_team_id=rr.driver_team_id
        LEFT JOIN drivers d ON d.driver_id=dt.driver_id
        LEFT JOIN constructors con ON con.constructor_id=dt.constructor_id
        WHERE r.record_source='imported' AND s.year=:season
        GROUP BY r.race_id,r.race_name,r.race_date,c.name
        ORDER BY r.race_date,r.race_id
    """)
    try:
        with engine.connect() as connection:
            return [dict(row) for row in connection.execute(statement, {"season": season}).mappings().all()]
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Race database is unavailable") from exc


@router.get("/races/{race_id}/drivers")
def race_drivers(race_id: int) -> list[dict]:
    statement = text("""
        SELECT DISTINCT d.driver_id,d.full_name
        FROM race_results rr JOIN driver_team_seasons dt ON dt.driver_team_id=rr.driver_team_id
        JOIN drivers d ON d.driver_id=dt.driver_id
        WHERE rr.race_id=:race_id AND rr.record_source='imported'
        ORDER BY d.full_name
    """)
    try:
        with engine.connect() as connection:
            return [dict(row) for row in connection.execute(statement, {"race_id": race_id}).mappings().all()]
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Race database is unavailable") from exc


@router.get("/constructors")
def list_constructors(limit: int = Query(default=100, ge=1, le=200), offset: int = Query(default=0, ge=0)) -> list[dict]:
    statement = text("""
        SELECT c.constructor_id, c.name, c.country, c.base,
               COUNT(DISTINCT dt.driver_id) AS drivers,
               COUNT(DISTINCT rr.result_id) AS race_starts,
               COALESCE(SUM(rr.points), 0) AS points
        FROM constructors c
        LEFT JOIN driver_team_seasons dt ON dt.constructor_id = c.constructor_id
        LEFT JOIN race_results rr ON rr.driver_team_id = dt.driver_team_id AND rr.record_source = 'imported'
        WHERE c.record_source = 'imported'
        GROUP BY c.constructor_id, c.name, c.country, c.base
        ORDER BY c.name LIMIT :limit OFFSET :offset
    """)
    try:
        with engine.connect() as connection:
            return [dict(row) for row in connection.execute(statement, {"limit": limit, "offset": offset}).mappings().all()]
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Race database is unavailable") from exc


@router.get("/circuits")
def list_circuits(season: int | None = Query(default=None, ge=1950, le=2100)) -> list[dict]:
    statement = text("""
        SELECT c.circuit_id,c.source_circuit_key,c.name,c.location,c.country,c.length_km,
               COUNT(DISTINCT r.race_id) AS race_count,
               MIN(s.year) AS first_season,MAX(s.year) AS last_season,
               GROUP_CONCAT(DISTINCT s.year ORDER BY s.year SEPARATOR ',') AS seasons
        FROM circuits c
        JOIN races r ON r.circuit_id=c.circuit_id AND r.record_source='imported'
        JOIN seasons s ON s.season_id=r.season_id
        WHERE c.record_source='imported' AND (:season IS NULL OR s.year=:season)
        GROUP BY c.circuit_id,c.source_circuit_key,c.name,c.location,c.country,c.length_km
        ORDER BY c.name
    """)
    try:
        with engine.connect() as connection:
            return [dict(row) for row in connection.execute(statement, {"season": season}).mappings().all()]
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Race database is unavailable") from exc


@router.get("/races")
def list_races(
    season: int | None = Query(default=None, ge=1950, le=2100),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[dict]:
    statement = text("""
        SELECT r.race_id, r.race_name, r.race_date, s.year AS season,
               c.name AS circuit, c.country, r.record_source,
               COUNT(DISTINCT rr.result_id) AS result_count,
               (SELECT COUNT(*) FROM lap_times lt JOIN race_results lr ON lr.result_id=lt.result_id
                WHERE lr.race_id=r.race_id AND lr.record_source='imported' AND lt.lap_time_ms IS NOT NULL) AS lap_record_count,
               (SELECT COUNT(*) FROM pit_stops ps JOIN race_results pr ON pr.result_id=ps.result_id
                WHERE pr.race_id=r.race_id AND pr.record_source='imported') AS pit_stop_count,
               (SELECT COUNT(*) FROM pit_stops ps JOIN race_results pr ON pr.result_id=ps.result_id
                WHERE pr.race_id=r.race_id AND pr.record_source='imported' AND ps.duration_ms IS NOT NULL) AS timed_pit_stop_count,
               MAX(os.overtake_count) AS overtake_count,
               (SELECT MAX(rr2.classified_laps) FROM race_results rr2 WHERE rr2.race_id = r.race_id AND rr2.record_source = 'imported') AS race_laps
        FROM races r JOIN seasons s ON s.season_id = r.season_id
        JOIN circuits c ON c.circuit_id = r.circuit_id
        LEFT JOIN race_results rr ON rr.race_id = r.race_id AND rr.record_source = 'imported'
        LEFT JOIN race_overtake_summaries os ON os.race_id = r.race_id
        WHERE r.record_source = 'imported' AND (:season IS NULL OR s.year = :season)
        GROUP BY r.race_id, r.race_name, r.race_date, s.year, c.name, c.country, r.record_source
        ORDER BY r.race_date DESC LIMIT :limit OFFSET :offset
    """)
    try:
        with engine.connect() as connection:
            return [dict(row) for row in connection.execute(statement, {"season": season, "limit": limit, "offset": offset}).mappings().all()]
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Race database is unavailable") from exc


@router.get("/races/{race_id}/results")
def race_results(race_id: int) -> list[dict]:
    statement = text("""
        SELECT rr.result_id, d.driver_id, d.full_name, c.name AS constructor,
               rr.position, rr.points, rr.status, rr.classified_laps, rr.record_source
        FROM race_results rr
        JOIN driver_team_seasons dt ON dt.driver_team_id = rr.driver_team_id
        JOIN drivers d ON d.driver_id = dt.driver_id
        JOIN constructors c ON c.constructor_id = dt.constructor_id
        WHERE rr.race_id = :race_id AND rr.record_source = 'imported'
        ORDER BY rr.position IS NULL, rr.position, d.full_name
    """)
    try:
        with engine.connect() as connection:
            return [dict(row) for row in connection.execute(statement, {"race_id": race_id}).mappings().all()]
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Race database is unavailable") from exc


@router.get("/analytics/driver-comparison")
def compare_drivers(driver_ids: list[int] = Query(), season: int | None = Query(default=None, ge=1950, le=2100)) -> list[dict]:
    if not 2 <= len(driver_ids) <= 4 or len(set(driver_ids)) != len(driver_ids) or any(value < 1 for value in driver_ids):
        raise HTTPException(status_code=422, detail="Provide two to four distinct driver IDs")
    statement = text("""
        WITH result_stats AS (
          SELECT dt.driver_id, COUNT(rr.result_id) AS starts,
                 SUM(rr.points) AS points, AVG(rr.position) AS average_finish
          FROM driver_team_seasons dt
          LEFT JOIN race_results rr ON rr.driver_team_id = dt.driver_team_id AND rr.record_source = 'imported'
            AND (:season IS NULL OR rr.race_id IN (SELECT r.race_id FROM races r JOIN seasons s ON s.season_id=r.season_id WHERE s.year=:season))
          GROUP BY dt.driver_id
        ), win_stats AS (
          SELECT dt.driver_id, COUNT(*) AS wins
          FROM race_results rr
          JOIN driver_team_seasons dt ON dt.driver_team_id=rr.driver_team_id
          JOIN races r ON r.race_id=rr.race_id
          JOIN seasons s ON s.season_id=r.season_id
          WHERE rr.record_source='imported' AND rr.position=1
            AND (:season IS NULL OR s.year=:season)
          GROUP BY dt.driver_id
        ), pole_stats AS (
          SELECT dt.driver_id, COUNT(*) AS poles
          FROM qualifying_results qr
          JOIN sessions se ON se.session_id=qr.session_id
          JOIN races r ON r.race_id=se.race_id
          JOIN seasons s ON s.season_id=r.season_id
          JOIN driver_team_seasons dt ON dt.driver_team_id=qr.driver_team_id
          WHERE qr.record_source='imported' AND qr.position=1
            AND se.session_type='QUALIFYING' AND (:season IS NULL OR s.year=:season)
          GROUP BY dt.driver_id
        )
        SELECT d.driver_id, d.full_name, COALESCE(rs.starts, 0) AS starts,
               COALESCE(rs.points, 0) AS points, rs.average_finish,
               COALESCE(ws.wins,0) AS wins,
               CASE WHEN EXISTS (
                 SELECT 1 FROM qualifying_results qrx
                 JOIN sessions sex ON sex.session_id=qrx.session_id
                 JOIN races rx ON rx.race_id=sex.race_id
                 JOIN seasons sx ON sx.season_id=rx.season_id
                 WHERE qrx.record_source='imported' AND sex.session_type='QUALIFYING'
                   AND (:season IS NULL OR sx.year=:season)
               ) THEN COALESCE(ps.poles,0) ELSE NULL END AS poles
        FROM drivers d
        LEFT JOIN result_stats rs ON rs.driver_id = d.driver_id
        LEFT JOIN win_stats ws ON ws.driver_id=d.driver_id
        LEFT JOIN pole_stats ps ON ps.driver_id=d.driver_id
        WHERE d.driver_id IN :driver_ids
        ORDER BY d.full_name
    """).bindparams(bindparam("driver_ids", expanding=True))
    try:
        with engine.connect() as connection:
            return [dict(row) for row in connection.execute(statement, {"driver_ids": driver_ids, "season": season}).mappings().all()]
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Race database is unavailable") from exc


@router.get("/analytics/laps")
def lap_analysis(race_id: int = Query(gt=0), driver_id: int | None = Query(default=None, gt=0)) -> list[dict]:
    statement = text("""
        WITH lap_pace AS (
          SELECT rr.race_id, rr.result_id, d.driver_id, d.full_name,
                 lt.lap_number, lt.lap_time_ms, lt.is_personal_best,
                 RANK() OVER (PARTITION BY rr.race_id, lt.lap_number ORDER BY lt.lap_time_ms) AS lap_rank,
                 AVG(lt.lap_time_ms) OVER (PARTITION BY rr.race_id, lt.lap_number) AS lap_mean_ms
          FROM lap_times lt
          JOIN race_results rr ON rr.result_id = lt.result_id
          JOIN driver_team_seasons dt ON dt.driver_team_id = rr.driver_team_id
          JOIN drivers d ON d.driver_id = dt.driver_id
          WHERE rr.race_id = :race_id AND rr.record_source = 'imported' AND lt.lap_time_ms IS NOT NULL
        )
        SELECT driver_id, full_name, lap_number, lap_time_ms, is_personal_best,
               lap_rank, lap_mean_ms, lap_time_ms - lap_mean_ms AS delta_to_lap_mean_ms
        FROM lap_pace
        WHERE (:driver_id IS NULL OR driver_id = :driver_id)
        ORDER BY full_name, lap_number
    """)
    try:
        with engine.connect() as connection:
            return [dict(row) for row in connection.execute(statement, {"race_id": race_id, "driver_id": driver_id}).mappings().all()]
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Race database is unavailable") from exc


@router.get("/analytics/pit-stops")
def pit_stop_analysis(race_id: int = Query(gt=0)) -> list[dict]:
    statement = text("""
        SELECT d.full_name, ps.stop_number, ps.lap_number, ps.duration_ms, ps.stop_reason
        FROM pit_stops ps JOIN race_results rr ON rr.result_id = ps.result_id
        JOIN driver_team_seasons dt ON dt.driver_team_id = rr.driver_team_id
        JOIN drivers d ON d.driver_id = dt.driver_id
        WHERE rr.race_id = :race_id AND rr.record_source = 'imported'
        ORDER BY ps.lap_number, d.full_name
    """)
    try:
        with engine.connect() as connection:
            return [dict(row) for row in connection.execute(statement, {"race_id": race_id}).mappings().all()]
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Race database is unavailable") from exc


@router.get("/analytics/tyre-stints")
def tyre_stint_analysis(race_id: int = Query(gt=0)) -> list[dict]:
    statement = text("""
        SELECT d.full_name, tc.name AS compound, ts.stint_number, ts.start_lap, ts.end_lap,
               CASE WHEN ts.end_lap IS NULL THEN NULL ELSE ts.end_lap - ts.start_lap + 1 END AS stint_laps
        FROM tyre_stints ts JOIN race_results rr ON rr.result_id = ts.result_id
        JOIN driver_team_seasons dt ON dt.driver_team_id = rr.driver_team_id
        JOIN drivers d ON d.driver_id = dt.driver_id
        JOIN tyre_compounds tc ON tc.compound_id = ts.compound_id
        WHERE rr.race_id = :race_id AND rr.record_source = 'imported'
        ORDER BY d.full_name, ts.stint_number
    """)
    try:
        with engine.connect() as connection:
            return [dict(row) for row in connection.execute(statement, {"race_id": race_id}).mappings().all()]
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Race database is unavailable") from exc


@router.get("/strategy-reports")
def strategy_reports(limit: int = Query(default=50, ge=1, le=100), offset: int = Query(default=0, ge=0)) -> list[dict]:
    statement = text("""
        SELECT sr.report_id, sr.plan_id, sr.title, sr.report_body, sr.created_at,
               r.race_name, d.full_name AS driver_name, sp.strategy_type
        FROM strategy_reports sr JOIN strategy_plans sp ON sp.plan_id = sr.plan_id
        JOIN races r ON r.race_id = sp.race_id JOIN drivers d ON d.driver_id = sp.driver_id
        ORDER BY sr.created_at DESC LIMIT :limit OFFSET :offset
    """)
    try:
        with engine.connect() as connection:
            return [dict(row) for row in connection.execute(statement, {"limit": limit, "offset": offset}).mappings().all()]
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Race database is unavailable") from exc
