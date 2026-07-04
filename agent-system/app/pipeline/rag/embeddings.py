"""Live embeddings via OpenAI or Yandex OpenAI-compatible APIs."""

from __future__ import annotations

from app.config import Settings, get_settings
from app.infra.db import store_text_embeddings
from app.schemas import EmbedRequest, EmbedResponse
from app.infra.llm import build_embedding_client


def embed_texts(request: EmbedRequest, settings: Settings | None = None) -> EmbedResponse:
    settings = settings or get_settings()
    model_uri = settings.active_embedding_document_model
    _ensure_embedding_configured(settings, model_uri)

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
    _ensure_embedding_configured(settings, model_uri)
    client = build_embedding_client(settings, model_uri)
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


def _ensure_embedding_configured(settings: Settings, model_uri: str) -> None:
    if not model_uri:
        raise ValueError("embedding model is not configured")
    if model_uri.startswith(("emb://", "gpt://")):
        missing = [
            env
            for env, value in (
                ("YANDEX_API_KEY", settings.yandex_api_key),
                ("YANDEX_FOLDER_ID", settings.yandex_folder_id),
            )
            if not value
        ]
    else:
        missing = [
            env
            for env, value in (("OPENAI_API_KEY", settings.openai_api_key),)
            if not value
        ]
    if missing:
        raise ValueError(f"embedding provider is not configured, missing: {', '.join(missing)}")


def _validate_embedding_shape(request: EmbedRequest, response: EmbedResponse) -> None:
    if len(response.vectors) != len(request.texts):
        raise ValueError(
            f"embedding count mismatch: texts={len(request.texts)} vectors={len(response.vectors)}"
        )
    for index, vector in enumerate(response.vectors):
        if not vector:
            raise ValueError(f"embedding vector is empty at index {index}")
