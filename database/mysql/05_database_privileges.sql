-- Run as root after Compose has created f1_app and after the database/schema exist.
-- Keep MYSQL_USER=f1_app in .env while using this grant script.
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'f1_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON f1_strategy.* TO 'f1_app'@'%';
FLUSH PRIVILEGES;

-- Schema initialization/migrations must use an administrative connection.
-- The runtime API account cannot create/alter/drop tables or manage database users.
SHOW GRANTS FOR 'f1_app'@'%';
