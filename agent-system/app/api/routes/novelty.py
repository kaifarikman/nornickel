from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.api.errors import error_response
from app.infra.artifacts import (
    add_artifact_headers,
    json_response_with_artifact,
    run_id_from_request,
    write_artifact,
)
from app.pipeline.rag.novelty import score_novelty
from app.schemas import NoveltyRequest, NoveltyResponse

router = APIRouter(tags=["novelty"])


@router.post("/novelty", response_model=NoveltyResponse)
def novelty(request: NoveltyRequest, http_request: Request) -> NoveltyResponse | JSONResponse:
    try:
        result = score_novelty(request)
        run_id, artifact_path = write_artifact(
            endpoint="/novelty",
            request=request,
            response=result,
            evidence={
                "hypothesis_text": request.hypothesis_text,
                "novelty_score": result.novelty_score,
                "similar": [item.model_dump(mode="json") for item in result.similar],
                "top_similarity": result.similar[0].score if result.similar else None,
            },
            run_id=run_id_from_request(http_request),
        )
        return json_response_with_artifact(result, run_id=run_id, artifact_path=artifact_path)
    except Exception as exc:
        error = error_response(
            status_code=502,
            code="NOVELTY_ERROR",
            message="Novelty request failed",
            details={"reason": str(exc)},
        )
        run_id, artifact_path = write_artifact(
            endpoint="/novelty",
            request=request,
            response={"error": error.body.decode("utf-8")},
            status="error",
            evidence={"hypothesis_text": request.hypothesis_text},
            run_id=run_id_from_request(http_request),
        )
        return add_artifact_headers(error, run_id=run_id, artifact_path=artifact_path)
