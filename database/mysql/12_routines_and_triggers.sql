USE f1_strategy;

-- Keep this demo repeatable: replace only the routines and triggers defined here.
DROP TRIGGER IF EXISTS trg_strategy_plan_audit_update;
DROP TRIGGER IF EXISTS trg_strategy_plan_contract_update;
DROP TRIGGER IF EXISTS trg_strategy_plan_contract_insert;
DROP TRIGGER IF EXISTS trg_qualifying_contract_update;
DROP TRIGGER IF EXISTS trg_qualifying_contract_insert;
DROP TRIGGER IF EXISTS trg_race_result_season_update;
DROP TRIGGER IF EXISTS trg_race_result_season_insert;
DROP PROCEDURE IF EXISTS sp_driver_season_summary;
DROP FUNCTION IF EXISTS fn_average_lap_ms;

DELIMITER $$

CREATE FUNCTION fn_average_lap_ms(p_result_id BIGINT UNSIGNED)
RETURNS DECIMAL(12,2)
READS SQL DATA
BEGIN
  DECLARE v_average DECIMAL(12,2);
  SELECT AVG(lap_time_ms) INTO v_average
  FROM lap_times WHERE result_id = p_result_id AND lap_time_ms IS NOT NULL;
  RETURN v_average;
END$$

CREATE PROCEDURE sp_driver_season_summary(
  IN p_driver_id BIGINT UNSIGNED,
  IN p_season_year SMALLINT UNSIGNED
)
READS SQL DATA
BEGIN
  SELECT d.driver_id, d.full_name, s.year AS season_year,
         COUNT(rr.result_id) AS starts, SUM(rr.points) AS points,
         AVG(rr.position) AS average_finish
  FROM drivers d
  JOIN driver_team_seasons dt ON dt.driver_id = d.driver_id
  JOIN seasons s ON s.season_id = dt.season_id
  LEFT JOIN race_results rr ON rr.driver_team_id = dt.driver_team_id
  LEFT JOIN races r ON r.race_id = rr.race_id AND r.season_id = s.season_id
  WHERE d.driver_id = p_driver_id AND s.year = p_season_year
  GROUP BY d.driver_id, d.full_name, s.year;
END$$

CREATE TRIGGER trg_race_result_season_insert
BEFORE INSERT ON race_results
FOR EACH ROW
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM races r
    JOIN driver_team_seasons dt ON dt.season_id = r.season_id
    WHERE r.race_id = NEW.race_id AND dt.driver_team_id = NEW.driver_team_id
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Race result driver contract must belong to the race season';
  END IF;
END$$

CREATE TRIGGER trg_race_result_season_update
BEFORE UPDATE ON race_results
FOR EACH ROW
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM races r
    JOIN driver_team_seasons dt ON dt.season_id = r.season_id
    WHERE r.race_id = NEW.race_id AND dt.driver_team_id = NEW.driver_team_id
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Race result driver contract must belong to the race season';
  END IF;
END$$

CREATE TRIGGER trg_qualifying_contract_insert
BEFORE INSERT ON qualifying_results
FOR EACH ROW
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM sessions se
    JOIN races r ON r.race_id = se.race_id
    JOIN driver_team_seasons dt ON dt.season_id = r.season_id
    WHERE se.session_id = NEW.session_id AND dt.driver_team_id = NEW.driver_team_id
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Qualifying entrant contract must belong to the session season';
  END IF;
END$$

CREATE TRIGGER trg_qualifying_contract_update
BEFORE UPDATE ON qualifying_results
FOR EACH ROW
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM sessions se
    JOIN races r ON r.race_id = se.race_id
    JOIN driver_team_seasons dt ON dt.season_id = r.season_id
    WHERE se.session_id = NEW.session_id AND dt.driver_team_id = NEW.driver_team_id
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Qualifying entrant contract must belong to the session season';
  END IF;
END$$

CREATE TRIGGER trg_strategy_plan_contract_insert
BEFORE INSERT ON strategy_plans
FOR EACH ROW
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM races r
    JOIN driver_team_seasons dt ON dt.season_id = r.season_id
    WHERE r.race_id = NEW.race_id AND dt.driver_id = NEW.driver_id
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Strategy driver must have a contract for the race season';
  END IF;
END$$

CREATE TRIGGER trg_strategy_plan_contract_update
BEFORE UPDATE ON strategy_plans
FOR EACH ROW
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM races r
    JOIN driver_team_seasons dt ON dt.season_id = r.season_id
    WHERE r.race_id = NEW.race_id AND dt.driver_id = NEW.driver_id
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Strategy driver must have a contract for the race season';
  END IF;
END$$

CREATE TRIGGER trg_strategy_plan_audit_update
AFTER UPDATE ON strategy_plans
FOR EACH ROW
BEGIN
  INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_key, details)
  VALUES (NEW.created_by_user_id, 'strategy_plan.updated', 'strategy_plan', CAST(NEW.plan_id AS CHAR),
          JSON_OBJECT('old_status', OLD.plan_status, 'new_status', NEW.plan_status,
                      'old_strategy_type', OLD.strategy_type, 'new_strategy_type', NEW.strategy_type));
END$$

DELIMITER ;

-- Example calls (replace identifiers with rows in the selected local database):
-- CALL sp_driver_season_summary(1, 2024);
-- SELECT fn_average_lap_ms(1);
