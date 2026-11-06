USE f1_strategy;

-- INNER JOIN / multi-table join: show each recorded result with race, driver, team and season.
SELECT r.race_name, s.year, d.full_name, c.name AS constructor, rr.position, rr.points, rr.status
FROM race_results rr
JOIN races r ON r.race_id = rr.race_id
JOIN seasons s ON s.season_id = r.season_id
JOIN driver_team_seasons dt ON dt.driver_team_id = rr.driver_team_id
JOIN drivers d ON d.driver_id = dt.driver_id
JOIN constructors c ON c.constructor_id = dt.constructor_id
ORDER BY s.year, rr.position;

-- LEFT JOIN: keep every driver even if no result exists for the selected season.
SELECT d.full_name, COUNT(rr.result_id) AS starts, SUM(rr.points) AS points
FROM drivers d
LEFT JOIN driver_team_seasons dt ON dt.driver_id = d.driver_id
LEFT JOIN race_results rr ON rr.driver_team_id = dt.driver_team_id
LEFT JOIN races r ON r.race_id = rr.race_id AND r.season_id = dt.season_id
GROUP BY d.driver_id, d.full_name
ORDER BY points DESC;

-- Nested query: drivers with at least one race win.
SELECT d.driver_id, d.full_name
FROM drivers d
WHERE d.driver_id IN (
  SELECT dt.driver_id
  FROM race_results rr
  JOIN driver_team_seasons dt ON dt.driver_team_id = rr.driver_team_id
  WHERE rr.position = 1
);

-- Nested aggregate query: results better than the mean finishing position.
SELECT d.full_name, AVG(rr.position) AS average_position
FROM drivers d
JOIN driver_team_seasons dt ON dt.driver_id = d.driver_id
JOIN race_results rr ON rr.driver_team_id = dt.driver_team_id
WHERE rr.position IS NOT NULL
GROUP BY d.driver_id, d.full_name
HAVING AVG(rr.position) < (SELECT AVG(position) FROM race_results WHERE position IS NOT NULL);

-- Correlated query: fastest available lap in each race. The inner query refers to outer race_id.
SELECT r.race_name, d.full_name, lt.lap_number, lt.lap_time_ms
FROM races r
JOIN race_results rr ON rr.race_id = r.race_id
JOIN lap_times lt ON lt.result_id = rr.result_id
JOIN driver_team_seasons dt ON dt.driver_team_id = rr.driver_team_id
JOIN drivers d ON d.driver_id = dt.driver_id
WHERE lt.lap_time_ms = (
  SELECT MIN(lt2.lap_time_ms)
  FROM race_results rr2
  JOIN lap_times lt2 ON lt2.result_id = rr2.result_id
  WHERE rr2.race_id = r.race_id AND lt2.lap_time_ms IS NOT NULL
);

-- Correlated query: pit stops longer than the average stop for that same race.
SELECT r.race_name, d.full_name, ps.stop_number, ps.duration_ms
FROM pit_stops ps
JOIN race_results rr ON rr.result_id = ps.result_id
JOIN races r ON r.race_id = rr.race_id
JOIN driver_team_seasons dt ON dt.driver_team_id = rr.driver_team_id
JOIN drivers d ON d.driver_id = dt.driver_id
WHERE ps.duration_ms > (
  SELECT AVG(ps2.duration_ms)
  FROM pit_stops ps2
  JOIN race_results rr2 ON rr2.result_id = ps2.result_id
  WHERE rr2.race_id = rr.race_id AND ps2.duration_ms IS NOT NULL
);

-- CTE: derive per-driver season points and average finish before filtering.
WITH season_driver AS (
  SELECT s.year, d.driver_id, d.full_name, SUM(rr.points) AS total_points,
         AVG(rr.position) AS average_position
  FROM race_results rr
  JOIN races r ON r.race_id = rr.race_id
  JOIN seasons s ON s.season_id = r.season_id
  JOIN driver_team_seasons dt ON dt.driver_team_id = rr.driver_team_id
  JOIN drivers d ON d.driver_id = dt.driver_id
  GROUP BY s.year, d.driver_id, d.full_name
)
SELECT * FROM season_driver ORDER BY year, total_points DESC;

-- Window functions: compare each lap to the field for that race/lap without collapsing driver rows.
WITH lap_pace AS (
  SELECT r.race_name, d.full_name, lt.lap_number, lt.lap_time_ms,
         RANK() OVER (PARTITION BY rr.race_id, lt.lap_number ORDER BY lt.lap_time_ms) AS lap_rank,
         AVG(lt.lap_time_ms) OVER (PARTITION BY rr.race_id, lt.lap_number) AS field_mean_ms,
         LAG(lt.lap_time_ms) OVER (PARTITION BY rr.result_id ORDER BY lt.lap_number) AS previous_lap_ms
  FROM lap_times lt
  JOIN race_results rr ON rr.result_id = lt.result_id
  JOIN races r ON r.race_id = rr.race_id
  JOIN driver_team_seasons dt ON dt.driver_team_id = rr.driver_team_id
  JOIN drivers d ON d.driver_id = dt.driver_id
  WHERE lt.lap_time_ms IS NOT NULL
)
SELECT race_name, full_name, lap_number, lap_time_ms, lap_rank,
       lap_time_ms - field_mean_ms AS delta_to_field_mean_ms,
       lap_time_ms - previous_lap_ms AS delta_to_previous_lap_ms
FROM lap_pace
WHERE race_name = 'Synthetic Example Grand Prix'
ORDER BY lap_number, lap_rank, full_name;

-- Recursive CTE: generate race lap numbers to support a lap-by-lap comparison grid.
-- Anchor member starts at lap 1; recursive member increments; the observed maximum ends recursion.
WITH RECURSIVE race_max AS (
  SELECT COALESCE(MAX(lt.lap_number), 1) AS max_lap
  FROM lap_times lt
  JOIN race_results rr ON rr.result_id = lt.result_id
  WHERE rr.race_id = (SELECT race_id FROM races WHERE source_race_key = 'demo-race-2024-01')
), lap_numbers (lap_number, max_lap) AS (
  SELECT 1, max_lap FROM race_max
  UNION ALL
  SELECT ln.lap_number + 1, ln.max_lap
  FROM lap_numbers ln
  WHERE ln.lap_number < ln.max_lap
)
SELECT ln.lap_number, d.full_name, lt.lap_time_ms
FROM lap_numbers ln
CROSS JOIN races r
JOIN race_results rr ON rr.race_id = r.race_id
JOIN driver_team_seasons dt ON dt.driver_team_id = rr.driver_team_id
JOIN drivers d ON d.driver_id = dt.driver_id
LEFT JOIN lap_times lt ON lt.result_id = rr.result_id AND lt.lap_number = ln.lap_number
WHERE r.source_race_key = 'demo-race-2024-01'
ORDER BY ln.lap_number, d.full_name;

-- Transaction demonstration uses only the synthetic fixture and rolls the change back.
START TRANSACTION;
UPDATE race_results rr
JOIN races r ON r.race_id = rr.race_id
SET rr.points = rr.points + 1
WHERE r.source_race_key = 'demo-race-2024-01' AND rr.record_source = 'synthetic';
SELECT race_id, position, points FROM race_results
WHERE race_id = (SELECT race_id FROM races WHERE source_race_key = 'demo-race-2024-01');
ROLLBACK;

-- Destructive DML example: dedicated transaction-owned row, always rolled back.
START TRANSACTION;
INSERT INTO drivers (source_driver_key, driver_number, full_name, record_source)
VALUES ('dml-demo-temporary', 99, 'Temporary DML Demonstration', 'synthetic');
SELECT driver_id, full_name FROM drivers WHERE source_driver_key = 'dml-demo-temporary';
UPDATE drivers SET full_name = 'Updated DML Demonstration'
WHERE source_driver_key = 'dml-demo-temporary';
DELETE FROM drivers WHERE source_driver_key = 'dml-demo-temporary';
ROLLBACK;
