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
from app.pipeline.rag.embeddings import embed_texts
from app.schemas import EmbedRequest, EmbedResponse

router = APIRouter(tags=["embed"])


@router.post("/embed", response_model=EmbedResponse)
def embed(request: EmbedRequest, http_request: Request) -> EmbedResponse | JSONResponse:
    try:
        result = embed_texts(request)
        run_id, artifact_path = write_artifact(
            endpoint="/embed",
            request=request,
            response=result,
            evidence={
                "texts": len(request.texts),
                "vectors": len(result.vectors),
                "dimensions": [len(vector) for vector in result.vectors],
            },
            run_id=run_id_from_request(http_request),
        )
        return json_response_with_artifact(result, run_id=run_id, artifact_path=artifact_path)
    except Exception as exc:
        error = error_response(
            status_code=502,
            code="EMBED_ERROR",
            message="Embedding request failed",
            details={"reason": "internal error"},
        )
        run_id, artifact_path = write_artifact(
            endpoint="/embed",
            request=request,
            response={"error": error.body.decode("utf-8")},
            status="error",
            evidence={"texts": len(request.texts), "error": str(exc)},
            run_id=run_id_from_request(http_request),
        )
        return add_artifact_headers(error, run_id=run_id, artifact_path=artifact_path)
