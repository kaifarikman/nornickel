from __future__ import annotations

from pydantic import ValidationError

from app.config import Settings, get_settings
from app.infra.db import store_live_extraction
from app.infra.llm import build_yandex_client
from app.pipeline.extract.documents import DOCX_MIME, DocumentChunk, parse_documents
from app.pipeline.extract.normalization import normalize_extract_response
from app.pipeline.extract.validation import validate_extract_response
from app.schemas import (
    Claim,
    DocumentRef,
    ExtractRequest,
    ExtractResponse,
    GraphEdge,
    GraphNode,
    StrictModel,
)

SYSTEM_PROMPT = """\
Ты извлекаешь структурированные причинно-следственные claims для графа знаний.
Верни JSON строго по Pydantic-схеме response_format.
LLM не ранжирует гипотезы, не ставит status/rank/score и не считает экономику.

Правила:
- source_ref обязан быть одним из doc_id во входе.
- source_page для txt всегда null, для PDF обязан быть номером страницы из входного chunk.
- confidence в диапазоне 0..1.
- factor = управляемый рычаг, mechanism = физический механизм.
- property = свойство/диагноз, kpi = целевой показатель.
- Для управляемых факторов добавляй tag "controllable".
- Для каждого edge добавляй хотя бы один source_claim.
- Не добавляй домыслы сверх текста.
"""


class LlmNotConfiguredError(RuntimeError):
    """Live-извлечение запрошено, но Yandex-креды не заполнены (.env пуст/отсутствует)."""

    def __init__(self, missing: list[str]) -> None:
        self.missing = missing
        super().__init__(f"Yandex LLM is not configured, missing: {', '.join(missing)}")


class LlmExtractPayload(StrictModel):
    claims: list[Claim]
    entities: list[GraphNode]
    edges: list[GraphEdge]


def extract_with_yandex(request: ExtractRequest, settings: Settings | None = None) -> ExtractResponse:
    settings = settings or get_settings()
    _ensure_llm_configured(settings)
    chunks = _load_document_chunks(request)
    documents = _documents_from_chunks(chunks)
    payload = _call_yandex(chunks, settings)

    try:
        response = ExtractResponse(
            pack_id=request.pack_id,
            documents=documents,
            claims=payload.claims,
            entities=payload.entities,
            edges=payload.edges,
        )
    except ValidationError as exc:
        raise ValueError(f"Yandex extraction output does not match ExtractResponse: {exc}") from exc
    response = normalize_extract_response(response)
    validate_extract_response(response, request=request)
    store_live_extraction(
        settings=settings,
        request=request,
        documents=documents,
        chunks=chunks,
        response=response,
    )
    return response


def _ensure_llm_configured(settings: Settings) -> None:
    missing = [
        env
        for env, value in (
            ("YANDEX_API_KEY", settings.yandex_api_key),
            ("YANDEX_FOLDER_ID", settings.yandex_folder_id),
            ("YANDEX_MODEL_EXTRACT", settings.yandex_model_extract),
        )
        if not value
    ]
    if missing:
        raise LlmNotConfiguredError(missing)


_SUPPORTED_LIVE_MIMES = {"text/plain", "application/pdf", DOCX_MIME}


def _load_document_chunks(request: ExtractRequest) -> list[DocumentChunk]:
    docs = [(doc.path, doc.mime) for doc in request.docs if doc.mime in _SUPPORTED_LIVE_MIMES]
    if not docs:
        raise ValueError("real extraction currently requires text/plain, application/pdf or docx documents")
    return parse_documents(docs)


def _documents_from_chunks(chunks: list[DocumentChunk]) -> list[DocumentRef]:
    by_id: dict[str, DocumentRef] = {}
    for chunk in chunks:
        by_id.setdefault(
            chunk.doc_id,
            DocumentRef(id=chunk.doc_id, title=chunk.title, path=chunk.path, source_url=None),
        )
    return list(by_id.values())


def _call_yandex(chunks: list[DocumentChunk], settings: Settings) -> LlmExtractPayload:
    client = build_yandex_client(settings)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": _user_prompt(chunks)},
    ]
    response = client.beta.chat.completions.parse(
        model=settings.extract_model_uri,
        messages=messages,
        temperature=0,
        response_format=LlmExtractPayload,
    )
    parsed = response.choices[0].message.parsed
    if parsed is None:
        raise ValueError("Yandex extraction parse returned empty parsed payload")
    return parsed


def _user_prompt(chunks: list[DocumentChunk]) -> str:
    parts = ["Документы и chunks:"]
    for idx, chunk in enumerate(chunks, start=1):
        parts.append(
            f"\n[chunk {idx}]\n"
            f"doc_id: {chunk.doc_id}\n"
            f"title: {chunk.title}\n"
            f"path: {chunk.path}\n"
            f"page: {chunk.page if chunk.page is not None else 'null'}\n"
            f"text: {chunk.text}"
        )
    return "\n".join(parts)
