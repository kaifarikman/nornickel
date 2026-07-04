from __future__ import annotations

from functools import lru_cache

from openai import OpenAI

from app.config import Settings


def build_llm_client(settings: Settings) -> OpenAI:
    provider = settings.normalized_llm_provider
    if provider == "openai":
        return _cached_client(
            settings.openai_api_key,
            settings.openai_base_url,
            settings.openai_request_timeout_seconds,
            settings.openai_max_retries,
        )
    if provider == "yandex":
        return build_yandex_client(settings)
    raise ValueError("LLM_PROVIDER must be one of: openai, yandex")


def build_embedding_client(settings: Settings, model: str) -> OpenAI:
    if model.startswith(("emb://", "gpt://")):
        return build_yandex_client(settings)
    return _cached_client(
        settings.openai_api_key,
        settings.openai_base_url,
        settings.openai_request_timeout_seconds,
        settings.openai_max_retries,
    )


def build_yandex_client(settings: Settings) -> OpenAI:
    return _cached_client(
        settings.yandex_api_key,
        settings.yandex_base_url,
        settings.yandex_request_timeout_seconds,
        settings.yandex_max_retries,
    )


@lru_cache(maxsize=8)
def _cached_client(
    api_key: str,
    base_url: str,
    timeout_seconds: float,
    max_retries: int,
) -> OpenAI:
    return OpenAI(
        api_key=api_key,
        base_url=base_url,
        timeout=timeout_seconds,
        max_retries=max_retries,
    )
