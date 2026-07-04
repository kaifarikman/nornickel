from __future__ import annotations

import json

from app.schemas import ExtractResponse
from app.infra.paths import FIXTURES_DIR


EXTRACT_FIXTURE = FIXTURES_DIR / "extract_response.json"


def load_mock_extract_response() -> ExtractResponse:
    data = json.loads(EXTRACT_FIXTURE.read_text(encoding="utf-8"))
    return ExtractResponse.model_validate(data)


def load_mock_extract_bytes() -> bytes:
    load_mock_extract_response()
    return EXTRACT_FIXTURE.read_bytes()
