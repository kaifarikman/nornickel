from __future__ import annotations

import json
import os
import re
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from fastapi import Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.infra.paths import AGENT_SYSTEM_DIR

RUN_ID_HEADER = "X-Agent-Run-Id"
ARTIFACT_HEADER = "X-Agent-Artifact-Path"

# run_id becomes a filesystem path component, so a caller-supplied header must
# not smuggle `..` or separators. Anything outside this alphabet is discarded in
# favour of a freshly generated id rather than failing the request.
_RUN_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def write_artifact(
    *,
    endpoint: str,
    request: BaseModel,
    response: BaseModel | dict,
    status: str = "ok",
    evidence: dict | None = None,
    run_id: str | None = None,
) -> tuple[str, str]:
    """Persist a trace artifact for one endpoint call.

    Best-effort: artifact writing is observability, never a reason to fail the
    request. Any IO error is swallowed and an empty path is returned so a full
    disk or read-only mount cannot turn a successful response into a 502.
    """
    run_id = run_id or os.environ.get("AGENT_RUN_ID") or _new_run_id()
    if not _RUN_ID_RE.match(run_id):
        run_id = _new_run_id()
    try:
        run_dir = AGENT_SYSTEM_DIR / "runs" / run_id
        run_dir.mkdir(parents=True, exist_ok=True)

        # uuid suffix keeps concurrent writers under a shared run_id from
        # colliding on the same sequential index and overwriting each other.
        name = f"{_next_index(run_dir):02d}_{endpoint.strip('/')}_{uuid4().hex[:6]}.json"
        path = run_dir / name
        payload = {
            "run_id": run_id,
            "endpoint": endpoint,
            "status": status,
            "created_at": datetime.now(UTC).isoformat(),
            "request": _jsonable(request),
            "response": _jsonable(response),
            "evidence": evidence or {},
        }
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return run_id, str(path)
    except OSError:
        return run_id, ""


def run_id_from_request(request: Request) -> str | None:
    return request.headers.get(RUN_ID_HEADER)


def add_artifact_headers(response, *, run_id: str, artifact_path: str):
    response.headers[RUN_ID_HEADER] = run_id
    response.headers[ARTIFACT_HEADER] = artifact_path
    return response


def json_response_with_artifact(
    payload: BaseModel,
    *,
    run_id: str,
    artifact_path: str,
) -> JSONResponse:
    response = JSONResponse(content=payload.model_dump(mode="json"))
    return add_artifact_headers(response, run_id=run_id, artifact_path=artifact_path)


def _jsonable(value):
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json")
    return value


def _new_run_id() -> str:
    return datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ") + "_" + uuid4().hex[:8]


def _next_index(run_dir: Path) -> int:
    existing = [
        int(path.name.split("_", 1)[0])
        for path in run_dir.glob("*.json")
        if path.name.split("_", 1)[0].isdigit()
    ]
    return max(existing, default=0) + 1
