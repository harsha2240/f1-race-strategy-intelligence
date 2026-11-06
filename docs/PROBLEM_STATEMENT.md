# Problem Statement

Formula 1 race data combines highly structured facts (events, entrants, classifications) with repeated measurements (laps, pit stops, weather, telemetry) and analysis documents (strategy assumptions and reports). A student project needs to represent these shapes coherently, query them correctly, preserve data provenance, and show how user permissions protect administrative actions.

This project models structured race data in a normalized relational database, flexible telemetry/report content in a document database, and exposes both through a validated API and dashboard. Synthetic fixtures support offline demonstrations without presenting invented performance as real-world statistics. Optional live FastF1 imports must record source and tolerate missing fields.

The academic objective is to demonstrate schema design, integrity constraints, SQL query forms, transactions and stored programs, document CRUD and aggregation, API/database integration, authentication/RBAC, and an explainable local demonstration.
