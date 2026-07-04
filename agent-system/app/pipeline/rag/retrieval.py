"""Retrieval over stored chunk embeddings (pgvector KNN)."""

from __future__ import annotations

from app.config import Settings, get_settings
from app.schemas import RetrieveRequest, RetrievedChunk, RetrieveResponse
from app.pipeline.rag.embeddings import embed_texts_with_model
from app.infra.db import (
    DbNotConfiguredError,
    load_chunks_without_embeddings,
    search_chunks,
    store_chunk_embeddings,
)


def embed_missing_chunks(settings: Settings | None = None, limit: int = 100) -> int:
    settings = settings or get_settings()
    if not settings.database_url:
        raise DbNotConfiguredError()
    if not settings.embedding_document_model_uri:
        raise ValueError("YANDEX_EMBEDDING_DOCUMENT_MODEL is not configured")
    chunks = load_chunks_without_embeddings(settings, limit=limit)
    if not chunks:
        return 0
    texts = [chunk[3] for chunk in chunks]
    vectors = embed_texts_with_model(
        texts,
        model_uri=settings.embedding_document_model_uri,
        settings=settings,
    )
    store_chunk_embeddings(settings=settings, chunks=chunks, response=vectors)
    return len(chunks)


def retrieve_chunks(
    request: RetrieveRequest,
    settings: Settings | None = None,
) -> RetrieveResponse:
    settings = settings or get_settings()
    if not settings.database_url:
        raise DbNotConfiguredError()
    if not settings.embedding_query_model_uri:
        raise ValueError("YANDEX_EMBEDDING_QUERY_MODEL is not configured")

    embed_missing_chunks(settings=settings)

    query_vector = embed_texts_with_model(
        [request.query],
        model_uri=settings.embedding_query_model_uri,
        settings=settings,
    ).vectors[0]

    scored = search_chunks(settings, query_vector, top_k=request.top_k)
    if not scored:
        raise ValueError("RAG corpus is empty: run /extract and chunk embedding first")

    return RetrieveResponse(
        chunks=[
            RetrievedChunk(
                chunk_id=chunk_id,
                document_id=document_id,
                page=page,
                text=text,
                score=score,
            )
            for chunk_id, document_id, page, text, score in scored
        ]
    )
