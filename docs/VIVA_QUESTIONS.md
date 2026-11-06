# Viva Questions

1. **Why is `driver_team_seasons` separate from `race_results`?** A driver's constructor assignment is scoped to a season. The junction models that relationship once and results refer to the contract.
2. **Why are missing lap times NULL?** Missing means unavailable or unrecorded; zero would be a false measurement and would distort averages/minima.
3. **What does the correlated fastest-lap query correlate on?** Its inner minimum-lap subquery depends on the outer race identifier.
4. **What are the recursive CTE anchor and recursive member?** The anchor selects lap 1; the recursive member increments the lap until the observed maximum.
5. **Why does MongoDB not enforce the race foreign key?** MySQL and MongoDB are separate stores; the API validates the MySQL parent and writes idempotently, with reconciliation for failures.
6. **How is a password protected?** The database stores an Argon2id salted hash; the plaintext is used only during verification and is never returned.
7. **How is authorization enforced?** The API resolves role permissions from relational tables on protected requests. The frontend's hidden menu is not the enforcement point.
8. **How is a session revoked?** The random cookie token is stored only as a digest in `auth_sessions`; logout marks the server-side row revoked.
9. **What does the strategy update trigger do?** It writes an audit event; it does not replace API validation.
10. **Which data in the offline seed is real?** None; every demo identity/event/result is explicitly synthetic. Imported records must carry source provenance.
11. **What is the difference between a view and a stored procedure?** A view names a reusable query; a procedure accepts parameters and executes an operation/query block.
12. **What has actually been tested?** Answer from the latest `docs/TESTING.md`; distinguish syntax checks from database/integration checks.
