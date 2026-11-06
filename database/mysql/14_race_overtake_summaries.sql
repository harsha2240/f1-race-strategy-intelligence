-- Store race-level overtake event counts from OpenF1. NULL/missing summary means
-- this source has no coverage for the race; a stored zero means zero events.
USE f1_strategy;

CREATE TABLE IF NOT EXISTS race_overtake_summaries (
  race_id BIGINT UNSIGNED NOT NULL,
  source_session_key BIGINT UNSIGNED NOT NULL,
  overtake_count INT UNSIGNED NOT NULL,
  source VARCHAR(32) NOT NULL DEFAULT 'OpenF1',
  fetched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (race_id),
  UNIQUE KEY uq_overtake_session_key (source_session_key),
  CONSTRAINT fk_overtake_summary_race FOREIGN KEY (race_id)
    REFERENCES races(race_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;
