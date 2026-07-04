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
from app.infra.db import DbNotConfiguredError
from app.pipeline.rag.retrieval import retrieve_chunks
from app.schemas import RetrieveRequest, RetrieveResponse

router = APIRouter(tags=["retrieve"])


@router.post("/retrieve", response_model=RetrieveResponse)
def retrieve(request: RetrieveRequest, http_request: Request) -> RetrieveResponse | JSONResponse:
    try:
        result = retrieve_chunks(request)
        run_id, artifact_path = write_artifact(
            endpoint="/retrieve",
            request=request,
            response=result,
            evidence={
                "query": request.query,
                "chunks": [chunk.model_dump(mode="json") for chunk in result.chunks],
                "top_score": result.chunks[0].score if result.chunks else None,
            },
            run_id=run_id_from_request(http_request),
        )
        return json_response_with_artifact(result, run_id=run_id, artifact_path=artifact_path)
    except DbNotConfiguredError:
        error = error_response(
            status_code=422,
            code="DB_NOT_CONFIGURED",
            message="Retrieval needs Postgres; set DATABASE_URL (compose.yaml provisions pgvector)",
        )
        run_id, artifact_path = write_artifact(
            endpoint="/retrieve",
            request=request,
            response={"error": error.body.decode("utf-8")},
            status="error",
            evidence={"query": request.query},
            run_id=run_id_from_request(http_request),
        )
        return add_artifact_headers(error, run_id=run_id, artifact_path=artifact_path)
    except Exception as exc:
        error = error_response(
            status_code=502,
            code="RETRIEVE_ERROR",
            message="Retrieval request failed",
            details={"reason": str(exc)},
        )
        run_id, artifact_path = write_artifact(
            endpoint="/retrieve",
            request=request,
            response={"error": error.body.decode("utf-8")},
            status="error",
            evidence={"query": request.query},
            run_id=run_id_from_request(http_request),
        )
        return add_artifact_headers(error, run_id=run_id, artifact_path=artifact_path)
