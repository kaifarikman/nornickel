from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Типизированные настройки, из файла agent-system/.env"""

    model_config = SettingsConfigDict(
        env_file=PROJECT_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # LLM-поля опциональны: mock-путь (/diagnose, mock-/extract) обязан
    # работать на чистой машине без .env. Live-эндпоинты сами проверяют
    # заполненность и отвечают 422 LLM_NOT_CONFIGURED.
    llm_provider: str = Field(default="yandex", alias="LLM_PROVIDER")

    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    openai_base_url: str = Field(default="https://api.openai.com/v1", alias="OPENAI_BASE_URL")
    openai_model_extract: str = Field(default="gpt-5.5", alias="OPENAI_MODEL_EXTRACT")
    openai_model_fast: str = Field(default="gpt-5.5", alias="OPENAI_MODEL_FAST")
    openai_embedding_model: str = Field(
        default="text-embedding-3-small",
        alias="OPENAI_EMBEDDING_MODEL",
    )
    openai_request_timeout_seconds: float = Field(
        default=60.0,
        alias="OPENAI_REQUEST_TIMEOUT_SECONDS",
    )
    openai_max_retries: int = Field(default=2, alias="OPENAI_MAX_RETRIES")

    yandex_api_key: str = Field(default="", alias="YANDEX_API_KEY")
    yandex_folder_id: str = Field(default="", alias="YANDEX_FOLDER_ID")
    yandex_base_url: str = Field(
        default="https://ai.api.cloud.yandex.net/v1",
        alias="YANDEX_BASE_URL",
    )

    yandex_model_extract: str = Field(default="", alias="YANDEX_MODEL_EXTRACT")
    yandex_model_fast: str = Field(default="", alias="YANDEX_MODEL_FAST")
    yandex_embedding_model: str = Field(default="", alias="YANDEX_EMBEDDING_MODEL")
    yandex_embedding_document_model: str = Field(
        default="",
        alias="YANDEX_EMBEDDING_DOCUMENT_MODEL",
    )
    yandex_embedding_query_model: str = Field(
        default="",
        alias="YANDEX_EMBEDDING_QUERY_MODEL",
    )

    sidecar_llm_enabled: bool = Field(default=False, alias="SIDECAR_LLM_ENABLED")
    sidecar_port: int = Field(default=8765, alias="SIDECAR_PORT")
    database_url: str = Field(default="", alias="DATABASE_URL")
    yandex_request_timeout_seconds: float = Field(
        default=30.0,
        alias="YANDEX_REQUEST_TIMEOUT_SECONDS",
    )
    yandex_max_retries: int = Field(default=2, alias="YANDEX_MAX_RETRIES")

    @property
    def normalized_llm_provider(self) -> str:
        return self.llm_provider.strip().lower()

    @property
    def active_extract_model(self) -> str:
        if self.normalized_llm_provider == "openai":
            return self.openai_model_extract
        return self.extract_model_uri

    @property
    def active_fast_model(self) -> str:
        if self.normalized_llm_provider == "openai":
            return self.openai_model_fast
        return self.fast_model_uri

    @property
    def active_embedding_document_model(self) -> str:
        if self._use_yandex_embeddings:
            return self.embedding_document_model_uri
        return self.openai_embedding_model

    @property
    def active_embedding_query_model(self) -> str:
        if self._use_yandex_embeddings:
            return self.embedding_query_model_uri
        return self.openai_embedding_model

    @property
    def _use_yandex_embeddings(self) -> bool:
        return (
            self.normalized_llm_provider == "yandex"
            and bool(self.yandex_api_key)
            and bool(self.yandex_folder_id)
            and bool(self.embedding_document_model_uri)
            and bool(self.embedding_query_model_uri)
        )

    def model_uri(self, model_name: str) -> str:
        """Возвращает URI модели Yandex для OpenAI-совместимых эндпоинтов"""
        if model_name.startswith("gpt://"):
            return model_name
        return f"gpt://{self.yandex_folder_id}/{model_name}"

    @property
    def extract_model_uri(self) -> str:
        return self.model_uri(self.yandex_model_extract)

    @property
    def fast_model_uri(self) -> str:
        return self.model_uri(self.yandex_model_fast)

    @property
    def embedding_model_uri(self) -> str:
        return self.embedding_document_model_uri

    @property
    def embedding_document_model_uri(self) -> str:
        model = self.yandex_embedding_document_model or self.yandex_embedding_model
        if not model:
            return ""
        return self._embedding_uri(model)

    @property
    def embedding_query_model_uri(self) -> str:
        model = self.yandex_embedding_query_model or self.yandex_embedding_model
        if not model:
            return ""
        return self._embedding_uri(model)

    def _embedding_uri(self, model_name: str) -> str:
        if model_name.startswith(("emb://", "gpt://")):
            return model_name
        return f"emb://{self.yandex_folder_id}/{model_name}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
