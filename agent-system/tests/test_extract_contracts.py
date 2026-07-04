from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

from app.api.routes import extract as extract_route
from app.pipeline.extract.mock import load_mock_extract_response
from app.pipeline.extract.service import _parse_llm_extract_content
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
        raise AssertionError("live LLM extraction must not be called when sidecar LLM is disabled")

    monkeypatch.setattr(
        extract_route,
        "get_settings",
        lambda: SimpleNamespace(sidecar_llm_enabled=False),
    )
    monkeypatch.setattr(
        extract_route, "load_mock_extract_response", lambda *_a, **_k: fixture_response
    )
    monkeypatch.setattr(extract_route, "extract_with_llm", fail_if_live_extract_is_called)

    response = extract_route.extract(_fixture_request(), SimpleNamespace(headers={}))

    assert response.media_type == "application/json"
    assert json.loads(response.body) == fixture_response.model_dump(mode="json")


def test_mock_extract_selects_fixture_by_pack_id() -> None:
    # В mock-режиме (режим жюри без LLM) не-флотационный pack обязан отдать свой
    # граф; иначе металлургический промт вернул бы флотационные claims.
    flotation = load_mock_extract_response("flotation-v1")
    metallurgy = load_mock_extract_response("metallurgy-v1")

    assert flotation.pack_id == "flotation-v1"
    assert metallurgy.pack_id == "metallurgy-v1"
    assert {c.id for c in metallurgy.claims} != {c.id for c in flotation.claims}
    # неизвестный pack -> дефолтная фикстура, а не падение
    assert load_mock_extract_response("does-not-exist").pack_id == "flotation-v1"


def test_parse_llm_extract_content_accepts_fenced_json_and_nodes_alias() -> None:
    content = """```json
{
  "claims": [
    {
      "id": "claim_1",
      "source_claim": "Fine particles reduce flotation recovery.",
      "source_ref": "doc_1",
      "source_page": null,
      "confidence": 0.7,
      "type": "property"
    }
  ],
  "nodes": [
    {
      "id": "factor_fines",
      "name": "Fine particles",
      "type": "parameter",
      "tags": ["controllable"]
    },
    {
      "id": "kpi_recovery",
      "name": "Recovery",
      "type": "kpi"
    }
  ],
  "edges": [
    {
      "id": "edge_1",
      "source": "factor_fines",
      "target": "kpi_recovery",
      "relation": "Reduced collision probability.",
      "claim_id": "claim_1",
      "polarity": "negative"
    }
  ]
}
```"""

    parsed = _parse_llm_extract_content(content)

    assert parsed.entities[0].id == "factor_fines"
    assert parsed.entities[0].kind == "factor"
    assert parsed.claims[0].evidence_type == "literature"
    assert parsed.edges[0].source_claims == ["claim_1"]
