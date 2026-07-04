from __future__ import annotations

from functools import lru_cache

from openai import OpenAI

from app.config import Settings


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
