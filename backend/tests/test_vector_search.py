import chromadb


def test_chroma_persists_vectors_and_respects_metadata_filter(tmp_path):
    client = chromadb.PersistentClient(path=str(tmp_path))
    collection = client.get_or_create_collection(name="test_strategy_reports", metadata={"hnsw:space": "cosine"})
    collection.add(
        ids=["report-1", "report-2"],
        documents=["tyre degradation and pit window", "constructor standings and season points"],
        embeddings=[[1.0, 0.0, 0.0], [0.0, 1.0, 0.0]],
        metadatas=[{"race_id": 10}, {"race_id": 20}],
    )
    result = collection.query(query_embeddings=[[0.9, 0.1, 0.0]], n_results=1, where={"race_id": 10})

    assert result["ids"] == [["report-1"]]
    reopened = chromadb.PersistentClient(path=str(tmp_path)).get_collection("test_strategy_reports")
    assert reopened.count() == 2
