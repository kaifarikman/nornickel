"""Smoke check for pre-LLM extraction building blocks."""

from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory

from app.infra.paths import DOCS_DIR
from app.pipeline.extract.documents import parse_pdf_file, parse_text_corpus
from app.pipeline.extract.entities import EntityResolver
from app.pipeline.extract.mock import load_mock_extract_response
from app.pipeline.extract.normalization import normalize_extract_response
from app.pipeline.extract.validation import validate_extract_response
from app.schemas import Claim, DocumentRef, ExtractResponse, GraphEdge, GraphNode


def main() -> None:
    paths = [
        str(DOCS_DIR / "sample_docs" / "flotation" / "classification_notes.txt"),
        str(DOCS_DIR / "sample_docs" / "flotation" / "flotation_kinetics_notes.txt"),
    ]
    chunks = parse_text_corpus(paths)
    resolver = EntityResolver.from_pack()
    matches = [resolver.resolve_text(chunk.text) for chunk in chunks]
    pdf_chunks = _make_and_parse_test_pdf()
    mock = load_mock_extract_response()

    total_matches = sum(len(items) for items in matches)
    if len(chunks) < 2:
        raise SystemExit("expected at least two text chunks")
    if pdf_chunks is not None and (not pdf_chunks or pdf_chunks[0].page != 1):
        raise SystemExit("expected pdf parser to return page-numbered chunks")
    if total_matches == 0:
        raise SystemExit("expected at least one entity match")
    if not mock.claims or not mock.entities or not mock.edges:
        raise SystemExit("extract fixture is empty")
    validate_extract_response(mock)
    _check_invalid_extract_response_fails()
    _check_extract_normalization()

    print(
        "ok",
        f"chunks={len(chunks)}",
        f"pdf_chunks={len(pdf_chunks) if pdf_chunks is not None else 'skipped_no_fitz'}",
        f"entity_matches={total_matches}",
        f"mock_claims={len(mock.claims)}",
        f"mock_entities={len(mock.entities)}",
        f"mock_edges={len(mock.edges)}",
    )


def _check_invalid_extract_response_fails() -> None:
    response = load_mock_extract_response().model_copy(deep=True)
    response.edges[0].source_claims = ["claim_missing"]
    try:
        validate_extract_response(response)
    except ValueError:
        return
    raise SystemExit("expected invalid edge source_claim to fail validation")


def _check_extract_normalization() -> None:
    response = ExtractResponse(
        pack_id="flotation-v1",
        documents=[
            DocumentRef(
                id="doc_test",
                title="test",
                path=str(DOCS_DIR / "sample_docs" / "flotation" / "classification_notes.txt"),
            ),
        ],
        claims=[
            Claim(
                id="claim_001",
                text="Гидроциклон влияет на недораскрытие.",
                source_ref="doc_test",
                source_page=None,
                confidence=0.9,
                evidence_type="literature",
            ),
        ],
        entities=[
            GraphNode(
                id="llm_hydrocyclone_factor",
                kind="factor",
                label="диаметр песковой насадки гидроциклона",
                tags=[],
                properties={},
            ),
            GraphNode(
                id="llm_liberation_loss",
                kind="property",
                label="недораскрытие сростков",
                tags=[],
                properties={},
            ),
        ],
        edges=[
            GraphEdge(
                id="edge_001",
                src="llm_hydrocyclone_factor",
                dst="llm_liberation_loss",
                edge_type="mechanism",
                mechanism="classification_cut_size",
                source_claims=["claim_001"],
                polarity="negative",
            ),
        ],
    )
    normalized = normalize_extract_response(response)
    ids = {entity.id for entity in normalized.entities}
    if "node_hydrocyclone" not in ids or "node_diag_liberation_deficit" not in ids:
        raise SystemExit(f"expected canonical pack ids after normalization, got {sorted(ids)}")
    edge = normalized.edges[0]
    if edge.src != "node_hydrocyclone" or edge.dst != "node_diag_liberation_deficit":
        raise SystemExit("expected normalization to remap edge endpoints")
    validate_extract_response(normalized)


def _make_and_parse_test_pdf():
    try:
        import fitz
    except ImportError:
        return None

    with TemporaryDirectory() as tmp:
        path = Path(tmp) / "smoke.pdf"
        doc = fitz.open()
        page = doc.new_page()
        page.insert_text((72, 72), "Гидроциклон влияет на классификацию.")
        doc.save(path)
        doc.close()
        return parse_pdf_file(path)


if __name__ == "__main__":
    main()
