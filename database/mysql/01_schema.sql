-- F1 Race Strategy and Performance Intelligence System
-- MySQL 8.x / InnoDB. Run after 00_create_database.sql.
USE f1_strategy;

CREATE TABLE IF NOT EXISTS drivers (
  driver_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  source_driver_key VARCHAR(64) NULL,
  driver_number SMALLINT UNSIGNED NULL,
  full_name VARCHAR(160) NOT NULL,
  nationality VARCHAR(80) NULL,
  date_of_birth DATE NULL,
  record_source ENUM('imported','synthetic','manual') NOT NULL DEFAULT 'manual',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (driver_id),
  UNIQUE KEY uq_driver_source_key (source_driver_key),
  KEY idx_driver_name (full_name),
  CONSTRAINT chk_driver_number CHECK (driver_number IS NULL OR driver_number BETWEEN 1 AND 99)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS constructors (
  constructor_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  source_constructor_key VARCHAR(64) NULL,
  name VARCHAR(120) NOT NULL,
  country VARCHAR(80) NULL,
  base VARCHAR(120) NULL,
  record_source ENUM('imported','synthetic','manual') NOT NULL DEFAULT 'manual',
  PRIMARY KEY (constructor_id),
  UNIQUE KEY uq_constructor_source_key (source_constructor_key),
  UNIQUE KEY uq_constructor_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS seasons (
  season_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  year SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (season_id),
  UNIQUE KEY uq_season_year (year),
  CONSTRAINT chk_season_year CHECK (year BETWEEN 1950 AND 2100)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS circuits (
  circuit_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  source_circuit_key VARCHAR(64) NULL,
  name VARCHAR(160) NOT NULL,
  location VARCHAR(120) NULL,
  country VARCHAR(80) NULL,
  length_km DECIMAL(7,3) NULL,
  record_source ENUM('imported','synthetic','manual') NOT NULL DEFAULT 'manual',
  PRIMARY KEY (circuit_id),
  UNIQUE KEY uq_circuit_source_key (source_circuit_key),
  CONSTRAINT chk_circuit_length CHECK (length_km IS NULL OR length_km > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS driver_team_seasons (
  driver_team_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  driver_id BIGINT UNSIGNED NOT NULL,
  constructor_id BIGINT UNSIGNED NOT NULL,
  season_id BIGINT UNSIGNED NOT NULL,
  car_number SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (driver_team_id),
  UNIQUE KEY uq_driver_constructor_season (driver_id, constructor_id, season_id),
  KEY idx_dts_driver_season (driver_id, season_id),
  UNIQUE KEY uq_constructor_season_number (constructor_id, season_id, car_number),
  KEY idx_dts_constructor_season (constructor_id, season_id),
  CONSTRAINT fk_dts_driver FOREIGN KEY (driver_id) REFERENCES drivers(driver_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_dts_constructor FOREIGN KEY (constructor_id) REFERENCES constructors(constructor_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_dts_season FOREIGN KEY (season_id) REFERENCES seasons(season_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_dts_car_number CHECK (car_number BETWEEN 1 AND 99)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS races (
  race_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  season_id BIGINT UNSIGNED NOT NULL,
  circuit_id BIGINT UNSIGNED NOT NULL,
  source_race_key VARCHAR(96) NULL,
  race_name VARCHAR(160) NOT NULL,
  race_date DATE NOT NULL,
  record_source ENUM('imported','synthetic','manual') NOT NULL DEFAULT 'manual',
  PRIMARY KEY (race_id),
  UNIQUE KEY uq_race_source_key (source_race_key),
  UNIQUE KEY uq_race_season_name (season_id, race_name),
  KEY idx_race_date (race_date),
  CONSTRAINT fk_race_season FOREIGN KEY (season_id) REFERENCES seasons(season_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_race_circuit FOREIGN KEY (circuit_id) REFERENCES circuits(circuit_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sessions (
  session_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  race_id BIGINT UNSIGNED NOT NULL,
  session_type ENUM('FP1','FP2','FP3','SPRINT_QUALIFYING','SPRINT','QUALIFYING','RACE') NOT NULL,
  session_date DATETIME NULL,
  source_session_key VARCHAR(96) NULL,
  PRIMARY KEY (session_id),
  UNIQUE KEY uq_session_race_type (race_id, session_type),
  UNIQUE KEY uq_session_source_key (source_session_key),
  CONSTRAINT fk_session_race FOREIGN KEY (race_id) REFERENCES races(race_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS race_results (
  result_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  race_id BIGINT UNSIGNED NOT NULL,
  driver_team_id BIGINT UNSIGNED NOT NULL,
  position SMALLINT UNSIGNED NULL,
  points DECIMAL(5,2) NOT NULL DEFAULT 0,
  status VARCHAR(48) NOT NULL DEFAULT 'Unknown',
  classified_laps SMALLINT UNSIGNED NULL,
  record_source ENUM('imported','synthetic','manual') NOT NULL DEFAULT 'manual',
  PRIMARY KEY (result_id),
  UNIQUE KEY uq_result_race_driver (race_id, driver_team_id),
  KEY idx_result_race_position (race_id, position),
  CONSTRAINT fk_result_race FOREIGN KEY (race_id) REFERENCES races(race_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_result_driver_team FOREIGN KEY (driver_team_id) REFERENCES driver_team_seasons(driver_team_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_result_position CHECK (position IS NULL OR position > 0),
  CONSTRAINT chk_result_points CHECK (points >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS qualifying_results (
  session_id BIGINT UNSIGNED NOT NULL,
  driver_team_id BIGINT UNSIGNED NOT NULL,
  position SMALLINT UNSIGNED NULL,
  q1_time_ms INT UNSIGNED NULL,
  q2_time_ms INT UNSIGNED NULL,
  q3_time_ms INT UNSIGNED NULL,
  record_source ENUM('imported','synthetic','manual') NOT NULL DEFAULT 'manual',
  PRIMARY KEY (session_id, driver_team_id),
  KEY idx_qualifying_position (session_id, position),
  CONSTRAINT fk_qualifying_session FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_qualifying_driver_team FOREIGN KEY (driver_team_id) REFERENCES driver_team_seasons(driver_team_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_qualifying_position CHECK (position IS NULL OR position > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS lap_times (
  lap_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  result_id BIGINT UNSIGNED NOT NULL,
  lap_number SMALLINT UNSIGNED NOT NULL,
  lap_time_ms INT UNSIGNED NULL,
  is_personal_best BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (lap_id),
  UNIQUE KEY uq_lap_result_number (result_id, lap_number),
  CONSTRAINT fk_lap_result FOREIGN KEY (result_id) REFERENCES race_results(result_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT chk_lap_number CHECK (lap_number > 0),
  CONSTRAINT chk_lap_time CHECK (lap_time_ms IS NULL OR lap_time_ms > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pit_stops (
  pit_stop_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  result_id BIGINT UNSIGNED NOT NULL,
  stop_number TINYINT UNSIGNED NOT NULL,
  lap_number SMALLINT UNSIGNED NULL,
  duration_ms INT UNSIGNED NULL,
  stop_reason VARCHAR(80) NULL,
  PRIMARY KEY (pit_stop_id),
  UNIQUE KEY uq_pit_result_number (result_id, stop_number),
  KEY idx_pit_duration (duration_ms),
  CONSTRAINT fk_pit_result FOREIGN KEY (result_id) REFERENCES race_results(result_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT chk_pit_stop_number CHECK (stop_number > 0),
  CONSTRAINT chk_pit_lap CHECK (lap_number IS NULL OR lap_number > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tyre_compounds (
  compound_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(32) NOT NULL,
  PRIMARY KEY (compound_id),
  UNIQUE KEY uq_tyre_compound_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tyre_stints (
  stint_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  result_id BIGINT UNSIGNED NOT NULL,
  compound_id BIGINT UNSIGNED NOT NULL,
  stint_number TINYINT UNSIGNED NOT NULL,
  start_lap SMALLINT UNSIGNED NOT NULL,
  end_lap SMALLINT UNSIGNED NULL,
  PRIMARY KEY (stint_id),
  UNIQUE KEY uq_stint_result_number (result_id, stint_number),
  CONSTRAINT fk_stint_result FOREIGN KEY (result_id) REFERENCES race_results(result_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_stint_compound FOREIGN KEY (compound_id) REFERENCES tyre_compounds(compound_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_stint_range CHECK (start_lap > 0 AND (end_lap IS NULL OR end_lap >= start_lap))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS weather_observations (
  observation_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id BIGINT UNSIGNED NOT NULL,
  observed_at DATETIME NOT NULL,
  air_temp_c DECIMAL(5,2) NULL,
  track_temp_c DECIMAL(5,2) NULL,
  humidity_pct DECIMAL(5,2) NULL,
  rainfall BOOLEAN NULL,
  wind_speed_kph DECIMAL(6,2) NULL,
  source VARCHAR(48) NOT NULL DEFAULT 'unknown',
  PRIMARY KEY (observation_id),
  UNIQUE KEY uq_weather_session_time (session_id, observed_at),
  CONSTRAINT fk_weather_session FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT chk_weather_humidity CHECK (humidity_pct IS NULL OR humidity_pct BETWEEN 0 AND 100),
  CONSTRAINT chk_weather_wind CHECK (wind_speed_kph IS NULL OR wind_speed_kph >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
  user_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_user_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS strategy_plans (
  plan_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  race_id BIGINT UNSIGNED NOT NULL,
  driver_id BIGINT UNSIGNED NOT NULL,
  created_by_user_id BIGINT UNSIGNED NULL,
  strategy_type VARCHAR(48) NOT NULL,
  assumptions JSON NOT NULL,
  plan_status ENUM('draft','reviewed','archived') NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (plan_id),
  KEY idx_strategy_race_driver (race_id, driver_id),
  CONSTRAINT fk_strategy_race FOREIGN KEY (race_id) REFERENCES races(race_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_strategy_driver FOREIGN KEY (driver_id) REFERENCES drivers(driver_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_strategy_creator FOREIGN KEY (created_by_user_id) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS strategy_stints (
  strategy_stint_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  plan_id BIGINT UNSIGNED NOT NULL,
  compound_id BIGINT UNSIGNED NOT NULL,
  stint_number TINYINT UNSIGNED NOT NULL,
  start_lap SMALLINT UNSIGNED NOT NULL,
  end_lap SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (strategy_stint_id),
  UNIQUE KEY uq_strategy_stint_number (plan_id, stint_number),
  CONSTRAINT fk_strategy_stint_plan FOREIGN KEY (plan_id) REFERENCES strategy_plans(plan_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_strategy_stint_compound FOREIGN KEY (compound_id) REFERENCES tyre_compounds(compound_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_strategy_stint_range CHECK (start_lap > 0 AND end_lap >= start_lap)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS strategy_reports (
  report_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  plan_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(200) NOT NULL,
  report_body TEXT NOT NULL,
  report_metadata JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (report_id),
  KEY idx_strategy_report_created (created_at),
  CONSTRAINT fk_report_plan FOREIGN KEY (plan_id) REFERENCES strategy_plans(plan_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS roles (
  role_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(40) NOT NULL,
  PRIMARY KEY (role_id),
  UNIQUE KEY uq_role_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS permissions (
  permission_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  permission_key VARCHAR(80) NOT NULL,
  description VARCHAR(200) NOT NULL,
  PRIMARY KEY (permission_id),
  UNIQUE KEY uq_permission_key (permission_key)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_roles (
  user_id BIGINT UNSIGNED NOT NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role_id),
  CONSTRAINT fk_user_role_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_user_role_role FOREIGN KEY (role_id) REFERENCES roles(role_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS auth_sessions (
  auth_session_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  csrf_hash CHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  PRIMARY KEY (auth_session_id),
  UNIQUE KEY uq_auth_session_token (token_hash),
  KEY idx_auth_session_user_expiry (user_id, expires_at),
  CONSTRAINT fk_auth_session_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id BIGINT UNSIGNED NOT NULL,
  permission_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_role_permission_role FOREIGN KEY (role_id) REFERENCES roles(role_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_role_permission_permission FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
  audit_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_user_id BIGINT UNSIGNED NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_key VARCHAR(100) NULL,
  occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  details JSON NOT NULL,
  request_id CHAR(36) NULL,
  PRIMARY KEY (audit_id),
  KEY idx_audit_actor_time (actor_user_id, occurred_at),
  KEY idx_audit_entity (entity_type, entity_key, occurred_at),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS import_runs (
  import_run_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  source VARCHAR(40) NOT NULL,
  season_year SMALLINT UNSIGNED NOT NULL,
  event_name VARCHAR(160) NOT NULL,
  session_type VARCHAR(32) NOT NULL,
  status ENUM('previewed','running','succeeded','failed') NOT NULL,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  rows_written INT UNSIGNED NOT NULL DEFAULT 0,
  error_summary VARCHAR(1000) NULL,
  PRIMARY KEY (import_run_id),
  KEY idx_import_event_status (season_year, event_name, status)
) ENGINE=InnoDB;
