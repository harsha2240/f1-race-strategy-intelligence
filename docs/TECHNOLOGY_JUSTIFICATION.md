# Technology Justification

| Technology | Purpose | Reason and trade-off |
|---|---|---|
| MySQL 8 | Structured source of truth | Foreign keys, transactions, constraints, views, CTEs and stored-program demonstrations match the DBMS project. It requires schema discipline for evolving telemetry. |
| MongoDB | Variable-shape/high-frequency telemetry and flexible reports | Suitable for nested time-series-like data; cross-database referential integrity must be handled by application validation and reconciliation. |
| FastAPI, SQLAlchemy, Alembic, Pydantic | API, relational persistence, migration and validation | Python integrates naturally with FastF1/Pandas; migration and validation layers make writes reviewable. |
| Next.js App Router, TypeScript, Tailwind, Recharts | Dashboard and analysis UI | Type-safe component UI and charts; all sensitive data access still passes through the API. |
| FastF1 and Pandas | Data extraction and transformation | Provides supported F1 timing/session access, subject to source availability, caching and licensing/source limitations. Imports remain explicit and repeatable. |
| Argon2id and server-side sessions | Password and login security | Passwords are stored as slow salted hashes; server-side sessions can be revoked and authorized independently of browser state. |
| Docker Compose | Reproducible local databases | Reduces setup differences; requires Docker, while API/frontend can also run directly for development. |
| ChromaDB (conditional) | Semantic retrieval over strategy text | Only justified if the project implements real embeddings and metadata-filtered similarity search. It is derived and adds setup/model complexity. |

No additional queue, cache, or orchestration service is assumed until measured needs justify one. Synthetic seed rows are clearly labeled; dashboard values must come from database queries.
