from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

from app.api.routes import extract as extract_route
from app.pipeline.extract.mock import load_mock_extract_response
from app.pipeline.extract.validation import validate_extract_response
from app.schemas import ExtractRequest


def _fixture_request() -> ExtractRequest:
    response = load_mock_extract_response()
    return ExtractRequest(
        pack_id=response.pack_id,
        docs=[
            {
                "path": document.path,
                "mime": "application/pdf" if document.path.endswith(".pdf") else "text/plain",
            }
            for document in response.documents
        ],
    )


def test_validate_extract_response_accepts_fixture() -> None:
    response = load_mock_extract_response()

    validate_extract_response(response, _fixture_request())


def test_validate_extract_response_rejects_edge_with_missing_claim() -> None:
    response = load_mock_extract_response().model_copy(deep=True)
    response.edges[0].source_claims = ["missing_claim"]

    with pytest.raises(ValueError, match="unknown source claim missing_claim"):
        validate_extract_response(response, _fixture_request())


def test_validate_extract_response_rejects_pdf_claim_without_source_page() -> None:
    response = load_mock_extract_response().model_copy(deep=True)
    response.claims[0].source_page = None

    with pytest.raises(ValueError, match="must have source_page"):
        validate_extract_response(response, _fixture_request())


def test_validate_extract_response_rejects_text_claim_with_source_page() -> None:
    response = load_mock_extract_response().model_copy(deep=True)
    text_claim = next(claim for claim in response.claims if claim.source_ref == "doc_tails_manual")
    text_claim.source_page = 1

    with pytest.raises(ValueError, match="must not have source_page"):
        validate_extract_response(response, _fixture_request())


def test_extract_route_uses_mock_fixture_when_sidecar_llm_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    fixture_response = load_mock_extract_response()

    def fail_if_live_extract_is_called(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("live Yandex extraction must not be called when sidecar LLM is disabled")

    monkeypatch.setattr(
        extract_route,
        "get_settings",
        lambda: SimpleNamespace(sidecar_llm_enabled=False),
    )
    monkeypatch.setattr(extract_route, "load_mock_extract_response", lambda: fixture_response)
    monkeypatch.setattr(extract_route, "extract_with_yandex", fail_if_live_extract_is_called)

    response = extract_route.extract(_fixture_request(), SimpleNamespace(headers={}))

    assert response.media_type == "application/json"
    assert json.loads(response.body) == fixture_response.model_dump(mode="json")
