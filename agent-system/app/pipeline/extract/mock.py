from __future__ import annotations

import json

from app.infra.paths import FIXTURES_DIR
from app.schemas import ExtractResponse

EXTRACT_FIXTURE = FIXTURES_DIR / "extract_response.json"


def _fixture_for_pack(pack_id: str | None):
    """Фикстура по pack_id (симметрично backend FileExtractSource): для не-дефолтного
    пака (напр. metallurgy-v1) mock обязан отдать его claims, а не флотационные —
    иначе в mock-режиме (режим жюри без LLM) металлургический промт вернёт
    флотационный граф."""
    if pack_id:
        pack_fixture = FIXTURES_DIR / f"extract_response_{pack_id}.json"
        if pack_fixture.exists():
            return pack_fixture
    return EXTRACT_FIXTURE


def load_mock_extract_response(pack_id: str | None = None) -> ExtractResponse:
    data = json.loads(_fixture_for_pack(pack_id).read_text(encoding="utf-8"))
    return ExtractResponse.model_validate(data)


def load_mock_extract_bytes(pack_id: str | None = None) -> bytes:
    return _fixture_for_pack(pack_id).read_bytes()
