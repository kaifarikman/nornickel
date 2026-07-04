"""Live embeddings via Yandex AI Studio OpenAI-compatible API."""

from __future__ import annotations

from app.config import Settings, get_settings
from app.schemas import EmbedRequest, EmbedResponse
from app.infra.db import store_text_embeddings
from app.infra.llm import build_yandex_client


def embed_texts(request: EmbedRequest, settings: Settings | None = None) -> EmbedResponse:
    settings = settings or get_settings()
    model_uri = settings.embedding_document_model_uri
    if not model_uri:
        raise ValueError("YANDEX_EMBEDDING_DOCUMENT_MODEL is not configured")

    result = embed_texts_with_model(request.texts, model_uri=model_uri, settings=settings)
    _validate_embedding_shape(request, result)
    store_text_embeddings(settings=settings, texts=request.texts, response=result)
    return result


def embed_texts_with_model(
    texts: list[str],
    *,
    model_uri: str,
    settings: Settings | None = None,
) -> EmbedResponse:
    settings = settings or get_settings()
    client = build_yandex_client(settings)
    vectors = []
    for text in texts:
        response = client.embeddings.create(
            model=model_uri,
            input=text,
            encoding_format="float",
        )
        vectors.append(list(response.data[0].embedding))
    result = EmbedResponse(vectors=vectors)
    _validate_embedding_shape(EmbedRequest(texts=texts), result)
    return result


def _validate_embedding_shape(request: EmbedRequest, response: EmbedResponse) -> None:
    if len(response.vectors) != len(request.texts):
        raise ValueError(
            f"embedding count mismatch: texts={len(request.texts)} vectors={len(response.vectors)}"
        )
    for index, vector in enumerate(response.vectors):
        if not vector:
            raise ValueError(f"embedding vector is empty at index {index}")
