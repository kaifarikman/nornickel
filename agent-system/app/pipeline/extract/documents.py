"""Small document parsers used before LLM extraction."""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from pathlib import Path

from app.infra.paths import resolve_repo_path


@dataclass(frozen=True)
class DocumentChunk:
    doc_id: str
    title: str
    path: str
    page: int | None
    text: str


def parse_text_file(path: str | Path) -> list[DocumentChunk]:
    source_path = resolve_repo_path(str(path))
    text = source_path.read_text(encoding="utf-8")
    paragraphs = _split_paragraphs(text)
    title = paragraphs[0] if paragraphs else source_path.stem
    doc_id = _doc_id(source_path)

    chunks = []
    for paragraph in paragraphs[1:] or paragraphs:
        chunks.append(
            DocumentChunk(
                doc_id=doc_id,
                title=title,
                path=str(path),
                page=None,
                text=paragraph,
            )
        )
    return chunks


def parse_text_corpus(paths: list[str | Path]) -> list[DocumentChunk]:
    chunks: list[DocumentChunk] = []
    for path in paths:
        chunks.extend(parse_text_file(path))
    return chunks


def parse_pdf_file(path: str | Path) -> list[DocumentChunk]:
    import fitz

    source_path = resolve_repo_path(str(path))
    doc_id = _doc_id(source_path)
    title = source_path.stem
    chunks: list[DocumentChunk] = []

    with fitz.open(source_path) as pdf:
        metadata_title = (pdf.metadata or {}).get("title")
        if metadata_title:
            title = metadata_title.strip() or title

        for page_index, page in enumerate(pdf, start=1):
            text = page.get_text("text").strip()
            if not text:
                continue
            for paragraph in _split_paragraphs(text):
                chunks.append(
                    DocumentChunk(
                        doc_id=doc_id,
                        title=title,
                        path=str(path),
                        page=page_index,
                        text=paragraph,
                    )
                )
    return chunks


DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def parse_docx_file(path: str | Path) -> list[DocumentChunk]:
    """DOCX has no native page concept (like PDF rendering does), so chunks
    carry page=None — same as plain text (see validation.py source_page rule).
    Case documents such as `norn-hack/Как читать отчет...docx` and most of
    `norn-dop-data/` arrive in this format."""
    import docx

    source_path = resolve_repo_path(str(path))
    doc_id = _doc_id(source_path)
    paragraphs = [p.text.strip() for p in docx.Document(source_path).paragraphs if p.text.strip()]
    title = paragraphs[0] if paragraphs else source_path.stem

    chunks = []
    for paragraph in paragraphs[1:] or paragraphs:
        chunks.append(
            DocumentChunk(doc_id=doc_id, title=title, path=str(path), page=None, text=paragraph)
        )
    return chunks


def parse_documents(paths_by_mime: list[tuple[str | Path, str]]) -> list[DocumentChunk]:
    chunks: list[DocumentChunk] = []
    for path, mime in paths_by_mime:
        if mime == "text/plain":
            chunks.extend(parse_text_file(path))
        elif mime == "application/pdf":
            chunks.extend(parse_pdf_file(path))
        elif mime == DOCX_MIME:
            chunks.extend(parse_docx_file(path))
        else:
            raise ValueError(f"unsupported document mime: {mime}")
    return chunks


def _doc_id(path: Path) -> str:
    # \w is Unicode-aware in Python 3 (matches Cyrillic letters too) — the
    # corpus is almost entirely Cyrillic-named (norn-hack, norn-dop-data), so
    # an ASCII-only pattern here silently collapsed every such filename to an
    # empty, colliding slug ("doc_").
    slug = re.sub(r"[^\w]+", "_", path.stem).strip("_").lower()
    if not slug:
        slug = hashlib.sha256(path.stem.encode("utf-8")).hexdigest()[:12]
    return f"doc_{slug}"


def _split_paragraphs(text: str) -> list[str]:
    return [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
