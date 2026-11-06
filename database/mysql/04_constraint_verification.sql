USE f1_strategy;
DELIMITER $$

DROP PROCEDURE IF EXISTS sp_verify_constraints$$
CREATE PROCEDURE sp_verify_constraints()
BEGIN
  DECLARE rejected_bad_length BOOLEAN DEFAULT FALSE;
  DECLARE rejected_missing_reference BOOLEAN DEFAULT FALSE;

  BEGIN
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET rejected_bad_length = TRUE;
    INSERT INTO circuits (name, length_km, record_source)
    VALUES ('Constraint verification invalid fixture', -1.000, 'synthetic');
  END;

  BEGIN
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET rejected_missing_reference = TRUE;
    INSERT INTO races (season_id, circuit_id, race_name, race_date, record_source)
    VALUES (999999999, 999999999, 'Constraint verification invalid race', '2024-01-01', 'synthetic');
  END;

  IF NOT rejected_bad_length THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'CHECK constraint failed to reject a negative circuit length';
  END IF;
  IF NOT rejected_missing_reference THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Foreign key failed to reject an unknown season/circuit';
  END IF;
END$$

DELIMITER ;

CALL sp_verify_constraints();
DROP PROCEDURE sp_verify_constraints;
SELECT 'CHECK and foreign key rejection checks passed' AS verification_result;
