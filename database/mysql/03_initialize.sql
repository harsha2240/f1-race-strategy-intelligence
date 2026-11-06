-- From the repository root, execute with a privileged local MySQL account:
-- mysql -u root -p < database/mysql/00_create_database.sql
-- mysql -u root -p < database/mysql/01_schema.sql
-- mysql -u root -p < database/mysql/02_reference_and_synthetic_seed.sql
SOURCE database/mysql/00_create_database.sql;
SOURCE database/mysql/01_schema.sql;
SOURCE database/mysql/02_reference_and_synthetic_seed.sql;
