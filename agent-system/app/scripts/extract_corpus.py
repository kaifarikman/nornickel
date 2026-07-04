"""Offline extractor for building corpus fixtures from document configs."""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from pathlib import Path

from pydantic import ValidationError

from app.config import get_settings
from app.infra.llm import build_llm_client
from app.infra.paths import DOCS_DIR
from app.pipeline.extract.documents import DOCX_MIME, DocumentChunk, parse_documents
from app.pipeline.extract.normalization import normalize_extract_response
from app.pipeline.extract.service import (
    SYSTEM_PROMPT,
    LlmExtractPayload,
    LlmNotConfiguredError,
    _ensure_llm_configured,
    _parse_llm_extract_content,
    _user_prompt,
)
from app.pipeline.extract.validation import validate_extract_response
from app.schemas import DocumentInput, DocumentRef, ExtractRequest, ExtractResponse

DEFAULT_CONFIG = DOCS_DIR / "extract_corpus.json"
DEFAULT_OUTPUT = DOCS_DIR / "fixtures" / "extract_response_v2.json"
MAX_BATCH_CHARS = 8000


@dataclass(frozen=True)
class CorpusDoc:
    path: str
    mime: str
    pages: tuple[range, ...]


@dataclass(frozen=True)
class MergeResult:
    response: ExtractResponse
    dropped_edges: int


def main(argv: Sequence[str] | None = None) -> int:
    args = _parse_args(argv)
    config = _load_config(args.config)
    docs = _corpus_docs(config)
    request = ExtractRequest(
        pack_id=str(config["pack_id"]),
        docs=[DocumentInput(path=document.path, mime=document.mime) for document in docs],
    )

    settings = get_settings().model_copy(update={"database_url": ""})
    try:
        _ensure_llm_configured(settings)
    except LlmNotConfiguredError:
        print("set OPENAI_API_KEY in agent-system/.env", file=sys.stderr)
        return 1

    chunks = _load_chunks(docs)
    batches = batch_chunks(chunks, max_chars=args.max_batch_chars)
    payloads = _extract_batches(batches, settings)
    documents = documents_from_chunks(chunks)
    merged = merge_payloads(payloads, documents, request.pack_id)
    response = normalize_extract_response(merged.response)
    validate_extract_response(response, request=request)
    _write_response(args.output, response)

    print(
        "extract_corpus",
        f"docs={len(documents)}",
        f"chunks={len(chunks)}",
        f"batches={len(batches)}",
        f"claims={len(response.claims)}",
        f"entities={len(response.entities)}",
        f"edges={len(response.edges)}",
        f"dropped_edges={merged.dropped_edges}",
        f"output={args.output}",
    )
    return 0


def batch_chunks(chunks: Sequence[DocumentChunk], max_chars: int = MAX_BATCH_CHARS) -> list[list[DocumentChunk]]:
    batches: list[list[DocumentChunk]] = []
    current: list[DocumentChunk] = []
    current_chars = 0

    for chunk in chunks:
        chunk_size = len(chunk.text)
        if current and current_chars + chunk_size > max_chars:
            batches.append(current)
            current = []
            current_chars = 0
        current.append(chunk)
        current_chars += chunk_size

    if current:
        batches.append(current)
    return batches


def documents_from_chunks(chunks: Iterable[DocumentChunk]) -> list[DocumentRef]:
    by_id: dict[str, DocumentRef] = {}
    for chunk in chunks:
        by_id.setdefault(
            chunk.doc_id,
            DocumentRef(id=chunk.doc_id, title=chunk.title, path=chunk.path, source_url=None),
        )
    return list(by_id.values())


def merge_payloads(
    payloads: Sequence[LlmExtractPayload],
    documents: Sequence[DocumentRef],
    pack_id: str,
) -> MergeResult:
    claims = []
    entities = []
    edges = []
    dropped_edges = 0
    claim_seq = 1
    edge_seq = 1
    all_entity_ids = {entity.id for payload in payloads for entity in payload.entities}

    for payload in payloads:
        claim_id_map: dict[str, str] = {}
        payload_claim_ids = {claim.id for claim in payload.claims}

        for claim in payload.claims:
            new_id = f"claim_{claim_seq:03d}"
            claim_seq += 1
            claim_id_map[claim.id] = new_id
            claims.append(claim.model_copy(update={"id": new_id}, deep=True))

        entities.extend(entity.model_copy(deep=True) for entity in payload.entities)

        for edge in payload.edges:
            if edge.src not in all_entity_ids or edge.dst not in all_entity_ids:
                _warn(f"drop edge {edge.id}: unknown entity ref {edge.src}->{edge.dst}")
                dropped_edges += 1
                continue

            mapped_claims = []
            missing_claim = False
            for claim_id in edge.source_claims:
                if claim_id not in payload_claim_ids:
                    _warn(f"drop edge {edge.id}: unknown source claim {claim_id}")
                    missing_claim = True
                    break
                mapped_claims.append(claim_id_map[claim_id])
            if missing_claim:
                dropped_edges += 1
                continue

            new_edge_id = f"edge_{edge_seq:03d}"
            edge_seq += 1
            edges.append(
                edge.model_copy(
                    update={"id": new_edge_id, "source_claims": mapped_claims},
                    deep=True,
                )
            )

    response = ExtractResponse(
        pack_id=pack_id,
        documents=list(documents),
        claims=claims,
        entities=entities,
        edges=edges,
    )
    return MergeResult(response=response, dropped_edges=dropped_edges)


def _extract_batches(batches: Sequence[Sequence[DocumentChunk]], settings) -> list[LlmExtractPayload]:
    client = build_llm_client(settings)
    payloads: list[LlmExtractPayload] = []
    for idx, chunks in enumerate(batches, start=1):
        payload = _extract_batch(client, settings.active_extract_model, chunks)
        if payload is None:
            _warn(f"skip batch {idx}: invalid JSON after retry")
            continue
        payloads.append(payload)
    return payloads


def _extract_batch(client, model: str, chunks: Sequence[DocumentChunk]) -> LlmExtractPayload | None:
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": _user_prompt(list(chunks))},
    ]
    last_error: Exception | None = None
    for _ in range(2):
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0,
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content
        if not content:
            last_error = ValueError("LLM extraction returned empty content")
            continue
        try:
            return _parse_llm_extract_content(content)
        except (json.JSONDecodeError, ValidationError, ValueError) as exc:
            last_error = exc
    if last_error is not None:
        _warn(str(last_error))
    return None


def _load_chunks(docs: Sequence[CorpusDoc]) -> list[DocumentChunk]:
    chunks: list[DocumentChunk] = []
    for document in docs:
        doc_chunks = parse_documents([(document.path, document.mime)])
        if document.pages:
            doc_chunks = [
                chunk
                for chunk in doc_chunks
                if chunk.page is not None and _page_selected(chunk.page, document.pages)
            ]
        chunks.extend(doc_chunks)
    return chunks


def _page_selected(page: int, ranges: Sequence[range]) -> bool:
    return any(page in page_range for page_range in ranges)


def _corpus_docs(config: dict) -> list[CorpusDoc]:
    docs = config.get("docs")
    if not isinstance(docs, list) or not docs:
        raise SystemExit("extract corpus config must contain non-empty docs list")

    corpus_docs = []
    for raw_doc in docs:
        if not isinstance(raw_doc, dict):
            raise SystemExit("each docs item must be an object")
        path = str(raw_doc.get("path") or "").strip()
        if not path:
            raise SystemExit("each docs item must contain path")
        mime = str(raw_doc.get("mime") or _infer_mime(path))
        corpus_docs.append(CorpusDoc(path=path, mime=mime, pages=_parse_pages(raw_doc.get("pages"))))
    return corpus_docs


def _parse_pages(raw_pages: object) -> tuple[range, ...]:
    if raw_pages is None:
        return ()
    if isinstance(raw_pages, int):
        return (range(raw_pages, raw_pages + 1),)
    if isinstance(raw_pages, str):
        parts = [part.strip() for part in raw_pages.split(",") if part.strip()]
    elif isinstance(raw_pages, list):
        parts = [str(part).strip() for part in raw_pages if str(part).strip()]
    else:
        raise SystemExit(f"invalid pages selector: {raw_pages!r}")

    ranges = []
    for part in parts:
        if "-" in part:
            start_raw, end_raw = part.split("-", 1)
            start, end = int(start_raw), int(end_raw)
            if start > end:
                raise SystemExit(f"invalid pages range: {part}")
            ranges.append(range(start, end + 1))
        else:
            page = int(part)
            ranges.append(range(page, page + 1))
    return tuple(ranges)


def _infer_mime(path: str) -> str:
    suffix = Path(path).suffix.lower()
    if suffix == ".txt":
        return "text/plain"
    if suffix == ".pdf":
        return "application/pdf"
    if suffix == ".docx":
        return DOCX_MIME
    raise SystemExit(f"cannot infer mime for {path}")


def _load_config(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or "pack_id" not in data:
        raise SystemExit("extract corpus config must contain pack_id")
    return data


def _write_response(path: Path, response: ExtractResponse) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = response.model_dump(mode="json")
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("config", nargs="?", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--max-batch-chars", type=int, default=MAX_BATCH_CHARS)
    return parser.parse_args(argv)


def _warn(message: str) -> None:
    print(f"warning: {message}", file=sys.stderr)


if __name__ == "__main__":
    raise SystemExit(main())
