from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.infra.db import DbNotConfiguredError
from app.schemas import RetrieveRequest
from app.pipeline.rag.retrieval import retrieve_chunks


def test_retrieve_chunks_requires_database_url() -> None:
    settings = SimpleNamespace(
        embedding_query_model_uri="emb://folder/query-model",
        database_url="",
    )

    with pytest.raises(DbNotConfiguredError):
        retrieve_chunks(RetrieveRequest(query="classification", top_k=3), settings=settings)
