-- A substitute driver may use the same constructor car number in the same season.
-- This preserves existing contracts and removes only the invalid uniqueness rule.
USE f1_strategy;
DELIMITER $$

DROP PROCEDURE IF EXISTS sp_allow_constructor_substitutes$$
CREATE PROCEDURE sp_allow_constructor_substitutes()
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'driver_team_seasons'
      AND index_name = 'uq_constructor_season_number'
  ) THEN
    ALTER TABLE driver_team_seasons DROP INDEX uq_constructor_season_number;
  END IF;
END$$

DELIMITER ;
CALL sp_allow_constructor_substitutes();
DROP PROCEDURE sp_allow_constructor_substitutes;
