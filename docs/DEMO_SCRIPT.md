# Demonstration Script

The full walkthrough should be run after database and API integration checks are recorded in `TESTING.md`.

1. Show the ER diagram and explain the driver/team/season contract relationship.
2. Initialize MySQL from a clean database and point out that the offline rows are synthetic.
3. Run the join, nested, correlated, recursive CTE, view, procedure, function, trigger, transaction, and constraint-check scripts; explain one example of each.
4. Run MongoDB validators and indexes, then demonstrate filtered read, update, aggregation, and delete using the dedicated synthetic fixture.
5. Start FastAPI and show OpenAPI docs, dashboard summary, and driver endpoints.
6. Log in as ADMIN and ANALYST; demonstrate a protected admin operation returning 403 for the analyst.
7. Show the dashboard metrics and their database-backed loading/error states.
8. Run a FastF1 preview only if the source/network is available; inspect missing values and provenance without claiming a full-season import.

Record actual outputs before marking any step passed. Do not claim an unexecuted live import, vector search, database privilege demo, or browser workflow.
