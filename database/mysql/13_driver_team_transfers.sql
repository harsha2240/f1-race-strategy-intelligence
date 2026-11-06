-- Allow substitute drivers who represent more than one constructor in a season.
-- Repeatable and non-destructive: existing contract rows are preserved.
USE f1_strategy;
DELIMITER $$

DROP PROCEDURE IF EXISTS sp_migrate_driver_team_transfers$$
CREATE PROCEDURE sp_migrate_driver_team_transfers()
BEGIN
  -- Add replacement indexes first: InnoDB currently uses uq_driver_season
  -- to support the driver foreign key, so it cannot be dropped before this.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'driver_team_seasons'
      AND index_name = 'uq_driver_constructor_season'
  ) THEN
    ALTER TABLE driver_team_seasons
      ADD UNIQUE KEY uq_driver_constructor_season (driver_id, constructor_id, season_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'driver_team_seasons'
      AND index_name = 'idx_dts_driver_season'
  ) THEN
    ALTER TABLE driver_team_seasons
      ADD KEY idx_dts_driver_season (driver_id, season_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'driver_team_seasons'
      AND index_name = 'uq_driver_season'
  ) THEN
    ALTER TABLE driver_team_seasons DROP INDEX uq_driver_season;
  END IF;
END$$

DELIMITER ;
CALL sp_migrate_driver_team_transfers();
DROP PROCEDURE sp_migrate_driver_team_transfers;
