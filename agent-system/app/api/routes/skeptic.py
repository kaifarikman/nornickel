from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.api.errors import error_response
from app.config import get_settings
from app.schemas import SkepticRequest, SkepticResponse
from app.infra.artifacts import (
    add_artifact_headers,
    json_response_with_artifact,
    run_id_from_request,
    write_artifact,
)
from app.pipeline.skeptic.service import run_skeptic


router = APIRouter(tags=["skeptic"])


@router.post("/skeptic", response_model=SkepticResponse)
def skeptic(request: SkepticRequest, http_request: Request) -> SkepticResponse | JSONResponse:
    settings = get_settings()
    try:
        result = run_skeptic(request, settings=settings)
        run_id, artifact_path = write_artifact(
            endpoint="/skeptic",
            request=request,
            response=result,
            evidence={
                "hypothesis_id": request.hypothesis.get("id"),
                "trace": request.hypothesis.get("trace", []),
                "source_nodes": request.hypothesis.get("source_nodes", []),
                "objection": result.objection,
                "missing_evidence": result.missing_evidence,
                "risks": result.risks,
                "suggested_checks": result.suggested_checks,
            },
            run_id=run_id_from_request(http_request),
        )
        return json_response_with_artifact(result, run_id=run_id, artifact_path=artifact_path)
    except Exception as exc:
        error = error_response(
            status_code=502,
            code="SKEPTIC_ERROR",
            message="Skeptic request failed",
            details={"reason": str(exc)},
        )
        run_id, artifact_path = write_artifact(
            endpoint="/skeptic",
            request=request,
            response={"error": error.body.decode("utf-8")},
            status="error",
            evidence={"hypothesis_id": request.hypothesis.get("id")},
            run_id=run_id_from_request(http_request),
        )
        return add_artifact_headers(error, run_id=run_id, artifact_path=artifact_path)
