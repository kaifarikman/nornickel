from __future__ import annotations

import json
import time

from pydantic import ValidationError

from app.config import Settings, get_settings
from app.infra.db import store_live_extraction
from app.infra.llm import build_llm_client
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
- Ответ должен быть чистым JSON без markdown-блоков.
- Top-level keys: "claims", "entities", "edges". Не используй "nodes".
"""


class LlmNotConfiguredError(RuntimeError):
    """Live-извлечение запрошено, но LLM-креды не заполнены (.env пуст/отсутствует)."""

    def __init__(self, missing: list[str]) -> None:
        self.missing = missing
        super().__init__(f"LLM is not configured, missing: {', '.join(missing)}")


class LlmExtractPayload(StrictModel):
    claims: list[Claim]
    entities: list[GraphNode]
    edges: list[GraphEdge]


def extract_with_llm(request: ExtractRequest, settings: Settings | None = None) -> ExtractResponse:
    settings = settings or get_settings()
    _ensure_llm_configured(settings)
    chunks = _load_document_chunks(request)
    documents = _documents_from_chunks(chunks)
    payload = _call_llm(chunks, settings)

    try:
        response = ExtractResponse(
            pack_id=request.pack_id,
            documents=documents,
            claims=payload.claims,
            entities=payload.entities,
            edges=payload.edges,
        )
    except ValidationError as exc:
        raise ValueError(f"LLM extraction output does not match ExtractResponse: {exc}") from exc
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
    provider = settings.normalized_llm_provider
    if provider == "openai":
        required = (
            ("OPENAI_API_KEY", settings.openai_api_key),
            ("OPENAI_MODEL_EXTRACT", settings.openai_model_extract),
        )
    elif provider == "yandex":
        required = (
            ("YANDEX_API_KEY", settings.yandex_api_key),
            ("YANDEX_FOLDER_ID", settings.yandex_folder_id),
            ("YANDEX_MODEL_EXTRACT", settings.yandex_model_extract),
        )
    else:
        raise LlmNotConfiguredError(["LLM_PROVIDER=openai|yandex"])

    missing = [env for env, value in required if not value]
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


def _call_llm(chunks: list[DocumentChunk], settings: Settings) -> LlmExtractPayload:
    client = build_llm_client(settings)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": _user_prompt(chunks)},
    ]
    started = time.monotonic()
    _log_extract("llm_request_start", model=settings.active_extract_model, chunks=len(chunks))
    response = client.chat.completions.create(
        model=settings.active_extract_model,
        messages=messages,
        temperature=0,
        response_format={"type": "json_object"},
    )
    content = response.choices[0].message.content
    if not content:
        raise ValueError("LLM extraction returned empty content")
    _log_extract(
        "llm_response_received",
        elapsed_ms=int((time.monotonic() - started) * 1000),
        chars=len(content),
    )
    try:
        payload = _parse_llm_extract_content(content)
        _log_payload("llm_parse_ok", payload)
        return payload
    except (json.JSONDecodeError, ValidationError, ValueError) as exc:
        _log_extract("llm_parse_failed", error=str(exc)[:400])
        repaired = _repair_llm_extract_content(client, settings, content)
        payload = _parse_llm_extract_content(repaired)
        _log_payload("llm_repair_ok", payload)
        return payload


def _repair_llm_extract_content(client, settings: Settings, content: str) -> str:
    _log_extract("llm_repair_start", chars=len(content))
    repair_prompt = (
        "Исправь JSON ниже. Верни только валидный JSON-объект без markdown. "
        "Сохрани смысл и top-level keys claims, entities, edges. "
        "Не добавляй пояснения.\n\n"
        f"{content}"
    )
    response = client.chat.completions.create(
        model=settings.active_extract_model,
        messages=[
            {"role": "system", "content": "Ты ремонтируешь JSON. Ответ должен быть только JSON."},
            {"role": "user", "content": repair_prompt},
        ],
        temperature=0,
        response_format={"type": "json_object"},
    )
    repaired = response.choices[0].message.content
    if not repaired:
        raise ValueError("LLM JSON repair returned empty content")
    _log_extract("llm_repair_response_received", chars=len(repaired))
    return repaired


def _parse_llm_extract_content(content: str) -> LlmExtractPayload:
    text = _extract_json_object_text(content)
    data = json.loads(text)
    if isinstance(data, dict) and "entities" not in data and "nodes" in data:
        data["entities"] = data.pop("nodes")
    if isinstance(data, dict):
        data = _normalize_llm_payload_aliases(data)
    return LlmExtractPayload.model_validate(data)


def _extract_json_object_text(content: str) -> str:
    text = content.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    start = text.find("{")
    end = text.rfind("}")
    if start > 0 or (end != -1 and end < len(text) - 1):
        if start == -1 or end == -1 or end <= start:
            raise ValueError("LLM extraction output does not contain a JSON object")
        text = text[start : end + 1]
    return text


def _log_payload(event: str, payload: LlmExtractPayload) -> None:
    _log_extract(event, claims=len(payload.claims), entities=len(payload.entities), edges=len(payload.edges))


def _log_extract(event: str, **fields: object) -> None:
    suffix = " ".join(f"{key}={value}" for key, value in fields.items())
    print(f"[extract] {event}{(' ' + suffix) if suffix else ''}", flush=True)


def _normalize_llm_payload_aliases(data: dict) -> dict:
    normalized = dict(data)
    normalized["claims"] = _dedupe_objects(
        [
            _normalize_claim_aliases(claim)
            for claim in normalized.get("claims", [])
            if isinstance(claim, dict)
        ],
        prefix="claim",
    )
    normalized["entities"] = _dedupe_objects(
        [
            _normalize_entity_aliases(entity)
            for entity in normalized.get("entities", [])
            if isinstance(entity, dict)
        ],
        prefix="node",
    )
    entity_aliases = _entity_aliases(normalized["entities"])
    claim_ids = {claim["id"] for claim in normalized["claims"]}
    first_claim_id = normalized["claims"][0]["id"] if normalized["claims"] else ""
    normalized["edges"] = _dedupe_objects(
        [
            edge
            for edge in (
                _resolve_edge_aliases(_normalize_edge_aliases(edge, normalized["claims"]), entity_aliases, claim_ids, first_claim_id)
                for edge in normalized.get("edges", [])
                if isinstance(edge, dict)
            )
            if edge is not None
        ],
        prefix="edge",
    )
    return normalized


def _normalize_claim_aliases(claim: dict) -> dict:
    return {
        "id": str(claim.get("id", "")),
        "text": str(claim.get("text") or claim.get("source_claim") or ""),
        "source_ref": str(claim.get("source_ref", "")),
        "source_page": claim.get("source_page"),
        "confidence": float(claim.get("confidence", 0.5)),
        "evidence_type": _evidence_type(claim.get("evidence_type")),
    }


def _normalize_entity_aliases(entity: dict) -> dict:
    entity_type = str(entity.get("type") or entity.get("kind") or "")
    properties = {
        key: value
        for key, value in entity.items()
        if key not in {"id", "kind", "label", "name", "tags"}
    }
    if entity_type and "type" not in properties:
        properties["type"] = entity_type
    return {
        "id": str(entity.get("id", "")),
        "kind": _node_kind(entity.get("kind") or entity_type, entity.get("tags")),
        "label": str(entity.get("label") or entity.get("name") or entity.get("id") or ""),
        "tags": _string_list(entity.get("tags")),
        "properties": properties,
    }


def _normalize_edge_aliases(edge: dict, claims: list[dict]) -> dict:
    first_claim_id = claims[0]["id"] if claims else ""
    source_claims = edge.get("source_claims") or edge.get("source_claim_ids")
    if source_claims is None:
        source_claims = edge.get("source_claim") or edge.get("claim_id") or first_claim_id
    return {
        "id": str(edge.get("id", "")),
        "src": str(
            edge.get("src")
            or edge.get("source")
            or edge.get("source_id")
            or edge.get("from")
            or edge.get("from_id")
            or "",
        ),
        "dst": str(
            edge.get("dst")
            or edge.get("target")
            or edge.get("target_id")
            or edge.get("to")
            or edge.get("to_id")
            or "",
        ),
        "edge_type": _edge_type(edge.get("edge_type") or edge.get("type") or edge.get("relation")),
        "mechanism": str(edge.get("mechanism") or edge.get("relation") or edge.get("label") or ""),
        "source_claims": _string_list(source_claims),
        "polarity": _polarity(edge.get("polarity")),
    }


def _string_list(value: object) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item) for item in value]
    return [str(value)]


def _dedupe_objects(items: list[dict], *, prefix: str) -> list[dict]:
    seen: set[str] = set()
    out: list[dict] = []
    for index, item in enumerate(items, start=1):
        raw_id = str(item.get("id") or "").strip()
        item_id = raw_id if raw_id and raw_id not in seen else f"{prefix}_{index:03}"
        while item_id in seen:
            index += 1
            item_id = f"{prefix}_{index:03}"
        item["id"] = item_id
        seen.add(item_id)
        out.append(item)
    return out


def _entity_aliases(entities: list[dict]) -> dict[str, str]:
    aliases: dict[str, str] = {}
    for entity in entities:
        entity_id = str(entity.get("id") or "")
        label = str(entity.get("label") or "")
        if entity_id:
            aliases[_alias_key(entity_id)] = entity_id
        if label:
            aliases[_alias_key(label)] = entity_id
    return aliases


def _resolve_edge_aliases(
    edge: dict,
    entity_aliases: dict[str, str],
    claim_ids: set[str],
    first_claim_id: str,
) -> dict | None:
    src = entity_aliases.get(_alias_key(edge.get("src")))
    dst = entity_aliases.get(_alias_key(edge.get("dst")))
    if src is None or dst is None:
        return None
    source_claims = [claim_id for claim_id in edge["source_claims"] if claim_id in claim_ids]
    if not source_claims and first_claim_id:
        source_claims = [first_claim_id]
    edge["src"] = src
    edge["dst"] = dst
    edge["source_claims"] = source_claims
    return edge


def _alias_key(value: object) -> str:
    return str(value or "").lower().replace("ё", "е").replace(" ", "").replace("_", "").replace("-", "")


def _evidence_type(value: object) -> str:
    if value in {"literature", "experiment", "expert_note", "data_gap", "inferred"}:
        return str(value)
    return "literature"


def _node_kind(value: object, tags: object = None) -> str:
    if value in {"factor", "mechanism", "property", "kpi"}:
        return str(value)
    tag_values = set(_string_list(tags))
    text = str(value).lower()
    if "controllable" in tag_values or text in {"parameter", "reagent", "setting"}:
        return "factor"
    if text in {"process", "mechanism"}:
        return "mechanism"
    if text in {"kpi", "metric", "target"}:
        return "kpi"
    return "property"


def _edge_type(value: object) -> str:
    if value in {"mechanism", "proxy", "tradeoff", "substitution"}:
        return str(value)
    text = str(value).lower()
    if "trade" in text:
        return "tradeoff"
    if "substitut" in text or "замещ" in text:
        return "substitution"
    if "proxy" in text:
        return "proxy"
    return "mechanism"


def _polarity(value: object) -> str:
    if value in {"positive", "negative", "nonlinear"}:
        return str(value)
    text = str(value).lower()
    if text in {"-", "decrease", "negative", "снижает", "ухудшает"}:
        return "negative"
    if text in {"nonlinear", "optimal", "optimum", "нелинейный", "оптимум"}:
        return "nonlinear"
    return "positive"


extract_with_yandex = extract_with_llm


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
