# Local Vector Search

The project stores structured facts in MySQL and flexible telemetry/strategy documents in MongoDB. ChromaDB adds a local persistent vector index over relational strategy report text; it is intended for semantic discovery, not structured truth or result prediction.

## Implementation

- `backend/app/vector_search.py` uses ChromaDB `PersistentClient` at `CHROMA_PATH` (default `../.data/chroma` when the API starts from `backend/`).
- The collection is `strategy_reports` and uses cosine distance.
- Chroma's default embedding function is the local `all-MiniLM-L6-v2` model. Chroma downloads its approximately 79 MB ONNX model on first embedding if absent; no paid API key is used.
- `POST /api/vector/index` upserts all SQL strategy reports with stable `report-{report_id}` IDs and metadata filters.
- `GET /api/vector/search?q=...&race_id=...` returns ranked report text, metadata and cosine distance. The returned distance is not a confidence score.
- `DELETE /api/vector/index/{report_id}` removes a report embedding. If source reports change, run index again to upsert the current text.
- Index and delete require `strategy:write` plus CSRF; search requires a valid session with `race:read`.

## Limits and verification

The index contains reports only after an analyst/admin rebuilds it. SQL remains the source of report metadata and facts. Vector updates are not currently in the same transaction as MySQL writes, so a failed index refresh can leave stale text until the next refresh. Do not treat semantic matches as verified race outcomes.

Chroma API/model behavior has not yet been smoke-tested in this environment. See `TESTING.md` for current observed verification. Official references: [Chroma persistent client](https://docs.trychroma.com/reference/python) and [default embedding function](https://docs.trychroma.com/docs/embeddings/embedding-functions).
