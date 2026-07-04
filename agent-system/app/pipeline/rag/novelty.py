"""Novelty scoring over retrieved corpus chunks."""

from __future__ import annotations

from app.config import Settings, get_settings
from app.pipeline.rag.retrieval import retrieve_chunks
from app.schemas import (
    NoveltyRequest,
    NoveltyResponse,
    NoveltySimilar,
    RetrieveRequest,
)


def score_novelty(
    request: NoveltyRequest,
    settings: Settings | None = None,
) -> NoveltyResponse:
    settings = settings or get_settings()
    retrieved = retrieve_chunks(
        RetrieveRequest(query=request.hypothesis_text, top_k=request.top_k),
        settings=settings,
    )
    max_score = max((chunk.score for chunk in retrieved.chunks), default=0.0)
    novelty_score = _clamp01(1.0 - max_score)
    return NoveltyResponse(
        novelty_score=novelty_score,
        similar=[
            NoveltySimilar(
                doc=chunk.document_id,
                page=chunk.page,
                score=chunk.score,
                text=chunk.text,
            )
            for chunk in retrieved.chunks
        ],
    )


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))
