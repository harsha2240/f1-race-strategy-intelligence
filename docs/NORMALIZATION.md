# Normalization

## Target

The relational schema is designed for Third Normal Form (3NF). Each entity has a stable key, attributes depend on the key, the whole key, and no non-key attribute should depend transitively on another non-key attribute.

## Examples

- Driver facts (name, nationality) live once in `drivers`; a race result references a driver-season constructor contract rather than copying names and team data into every result.
- `driver_team_seasons` resolves the ternary driver/team/season relationship from the supplied PDF. A driver may have more than one constructor contract in a season for substitute or team-change cases; race results reference the specific contract, preserving historical attribution.
- Race, circuit, season, and session facts are separate. A session belongs to one race; circuit and season are not repeated on every timing row.
- Lap times, pit stops, and stints are separate child relations because each race result can have multiple instances of each.
- Tyre compound names are normalized into a reference relation rather than repeated free text on every stint.
- User-to-role and role-to-permission many-to-many relationships use junction relations.

## Intentional derived or flexible data

Dashboard aggregates should be computed from source rows. If later cached, they must be treated as rebuildable derived data. High-frequency sector telemetry and evolving strategy report content belong in MongoDB for flexible shape and write volume; relational identifiers are retained for lookup. The vector index, if implemented, is derived from report content and is rebuildable.

## Limitations

Third Normal Form is a design target, not a substitute for verifying actual DDL and functional dependencies. Data ingestion must preserve source provenance and use `NULL` for unavailable observations rather than inventing values.
