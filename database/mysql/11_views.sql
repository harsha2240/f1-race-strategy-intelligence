USE f1_strategy;

CREATE OR REPLACE VIEW vw_driver_season_standings AS
SELECT d.driver_id, d.full_name, s.year AS season_year,
       c.constructor_id, c.name AS constructor_name,
       SUM(rr.points) AS total_points,
       COUNT(rr.result_id) AS race_starts,
       AVG(rr.position) AS average_finish
FROM race_results rr
JOIN races r ON r.race_id = rr.race_id
JOIN seasons s ON s.season_id = r.season_id
JOIN driver_team_seasons dt ON dt.driver_team_id = rr.driver_team_id
JOIN drivers d ON d.driver_id = dt.driver_id
JOIN constructors c ON c.constructor_id = dt.constructor_id
GROUP BY d.driver_id, d.full_name, s.year, c.constructor_id, c.name;

CREATE OR REPLACE VIEW vw_race_pit_stop_summary AS
SELECT r.race_id, r.race_name, COUNT(ps.pit_stop_id) AS pit_stop_count,
       AVG(ps.duration_ms) AS average_duration_ms,
       MIN(ps.duration_ms) AS fastest_duration_ms
FROM races r
LEFT JOIN race_results rr ON rr.race_id = r.race_id
LEFT JOIN pit_stops ps ON ps.result_id = rr.result_id
GROUP BY r.race_id, r.race_name;
