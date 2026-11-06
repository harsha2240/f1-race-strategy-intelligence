-- Reference data plus explicitly synthetic offline demo rows; safe to rerun.
USE f1_strategy;

INSERT INTO seasons (year) VALUES (2024)
  ON DUPLICATE KEY UPDATE year = VALUES(year);

INSERT INTO drivers (source_driver_key, driver_number, full_name, nationality, record_source)
VALUES
  ('demo-driver-01', 11, 'Alex Example', 'Exampleland', 'synthetic'),
  ('demo-driver-02', 22, 'Sam Sample', 'Sample Republic', 'synthetic')
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), record_source = VALUES(record_source);

INSERT INTO constructors (source_constructor_key, name, country, base, record_source)
VALUES
  ('demo-team-01', 'Synthetic Racing One', 'Exampleland', 'Demo City', 'synthetic'),
  ('demo-team-02', 'Synthetic Racing Two', 'Sample Republic', 'Sample Town', 'synthetic')
ON DUPLICATE KEY UPDATE name = VALUES(name), record_source = VALUES(record_source);

INSERT INTO circuits (source_circuit_key, name, location, country, length_km, record_source)
VALUES ('demo-circuit-01', 'Example Park Circuit', 'Demo City', 'Exampleland', 5.250, 'synthetic')
ON DUPLICATE KEY UPDATE name = VALUES(name), record_source = VALUES(record_source);

INSERT INTO driver_team_seasons (driver_id, constructor_id, season_id, car_number)
SELECT d.driver_id, c.constructor_id, s.season_id, x.car_number
FROM (
  SELECT 'demo-driver-01' AS driver_key, 'demo-team-01' AS team_key, 11 AS car_number
  UNION ALL SELECT 'demo-driver-02', 'demo-team-02', 22
) AS x
JOIN drivers d ON d.source_driver_key = x.driver_key
JOIN constructors c ON c.source_constructor_key = x.team_key
JOIN seasons s ON s.year = 2024
ON DUPLICATE KEY UPDATE car_number = VALUES(car_number);

INSERT INTO races (season_id, circuit_id, source_race_key, race_name, race_date, record_source)
SELECT s.season_id, c.circuit_id, 'demo-race-2024-01', 'Synthetic Example Grand Prix', '2024-04-14', 'synthetic'
FROM seasons s CROSS JOIN circuits c
WHERE s.year = 2024 AND c.source_circuit_key = 'demo-circuit-01'
ON DUPLICATE KEY UPDATE race_date = VALUES(race_date), record_source = VALUES(record_source);

INSERT INTO sessions (race_id, session_type, session_date, source_session_key)
SELECT race_id, 'RACE', '2024-04-14 14:00:00', 'demo-session-2024-01-race'
FROM races WHERE source_race_key = 'demo-race-2024-01'
ON DUPLICATE KEY UPDATE session_date = VALUES(session_date);

INSERT INTO race_results (race_id, driver_team_id, position, points, status, classified_laps, record_source)
SELECT r.race_id, dt.driver_team_id, x.position, x.points, 'Finished', 20, 'synthetic'
FROM (
  SELECT 'demo-driver-01' AS driver_key, 1 AS position, CAST(25.00 AS DECIMAL(5,2)) AS points
  UNION ALL SELECT 'demo-driver-02', 2, CAST(18.00 AS DECIMAL(5,2))
) AS x
JOIN drivers d ON d.source_driver_key = x.driver_key
JOIN seasons s ON s.year = 2024
JOIN driver_team_seasons dt ON dt.driver_id = d.driver_id AND dt.season_id = s.season_id
JOIN races r ON r.source_race_key = 'demo-race-2024-01'
ON DUPLICATE KEY UPDATE position = VALUES(position), points = VALUES(points), record_source = VALUES(record_source);

INSERT INTO tyre_compounds (name) VALUES ('Soft'), ('Medium'), ('Hard')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO roles (name) VALUES ('ADMIN'), ('ANALYST')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO permissions (permission_key, description) VALUES
  ('race:read', 'View race data and analytics'),
  ('strategy:write', 'Create and update strategy analyses'),
  ('data:import', 'Import supported race data'),
  ('users:manage', 'Manage users and role assignments'),
  ('audit:read', 'Read administrative audit history')
ON DUPLICATE KEY UPDATE description = VALUES(description);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'ADMIN'
ON DUPLICATE KEY UPDATE role_id = VALUES(role_id);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id FROM roles r JOIN permissions p
  ON p.permission_key IN ('race:read', 'strategy:write')
WHERE r.name = 'ANALYST'
ON DUPLICATE KEY UPDATE role_id = VALUES(role_id);
