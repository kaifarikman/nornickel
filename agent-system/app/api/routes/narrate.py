from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.api.errors import error_response
from app.config import get_settings
from app.schemas import NarrateRequest, NarrateResponse
from app.infra.artifacts import (
    add_artifact_headers,
    json_response_with_artifact,
    run_id_from_request,
    write_artifact,
)
from app.pipeline.narrate.service import run_narrate


router = APIRouter(tags=["narrate"])


@router.post("/narrate", response_model=NarrateResponse)
def narrate(request: NarrateRequest, http_request: Request) -> NarrateResponse | JSONResponse:
    settings = get_settings()
    try:
        result = run_narrate(request, settings=settings)
        run_id, artifact_path = write_artifact(
            endpoint="/narrate",
            request=request,
            response=result,
            evidence={
                "hypothesis_id": request.hypothesis.get("id"),
                "trace": request.hypothesis.get("trace", []),
                "source_nodes": request.hypothesis.get("source_nodes", []),
                "has_skeptic": request.skeptic is not None,
                "has_novelty": request.novelty is not None,
                "text": result.text,
            },
            run_id=run_id_from_request(http_request),
        )
        return json_response_with_artifact(result, run_id=run_id, artifact_path=artifact_path)
    except Exception as exc:
        error = error_response(
            status_code=502,
            code="NARRATE_ERROR",
            message="Narrate request failed",
            details={"reason": str(exc)},
        )
        run_id, artifact_path = write_artifact(
            endpoint="/narrate",
            request=request,
            response={"error": error.body.decode("utf-8")},
            status="error",
            evidence={"hypothesis_id": request.hypothesis.get("id")},
            run_id=run_id_from_request(http_request),
        )
        return add_artifact_headers(error, run_id=run_id, artifact_path=artifact_path)
