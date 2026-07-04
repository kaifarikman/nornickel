from __future__ import annotations

from fastapi import APIRouter, Request, Response

from app.api.errors import error_response
from app.config import get_settings
from app.infra.artifacts import add_artifact_headers, run_id_from_request, write_artifact
from app.pipeline.extract.mock import load_mock_extract_response
from app.schemas import ExtractRequest
from app.pipeline.extract.service import LlmNotConfiguredError, extract_with_llm

router = APIRouter(tags=["extract"])


@router.post("/extract")
def extract(request: ExtractRequest, http_request: Request) -> Response:
    settings = get_settings()
    try:
        mode = f"live_{settings.normalized_llm_provider}" if settings.sidecar_llm_enabled else "mock_fixture"
        if settings.sidecar_llm_enabled:
            result = extract_with_llm(request, settings=settings)
        else:
            result = load_mock_extract_response()
        run_id, artifact_path = write_artifact(
            endpoint="/extract",
            request=request,
            response=result,
            evidence={
                "mode": mode,
                "documents": [document.model_dump(mode="json") for document in result.documents],
                "claims": [
                    {
                        "id": claim.id,
                        "source_ref": claim.source_ref,
                        "source_page": claim.source_page,
                        "confidence": claim.confidence,
                    }
                    for claim in result.claims
                ],
                "edges": [
                    {
                        "id": edge.id,
                        "src": edge.src,
                        "dst": edge.dst,
                        "source_claims": edge.source_claims,
                    }
                    for edge in result.edges
                ],
                "counts": {
                    "documents": len(result.documents),
                    "claims": len(result.claims),
                    "entities": len(result.entities),
                    "edges": len(result.edges),
                },
            },
            run_id=run_id_from_request(http_request),
        )
    except LlmNotConfiguredError as exc:
        error = error_response(
            status_code=422,
            code="LLM_NOT_CONFIGURED",
            message="Live extraction requires LLM credentials; set them in .env or use mock mode (SIDECAR_LLM_ENABLED=false)",
            details={"missing": exc.missing},
        )
        run_id, artifact_path = write_artifact(
            endpoint="/extract",
            request=request,
            response={"error": error.body.decode("utf-8")},
            status="error",
            evidence={"mode": f"live_{settings.normalized_llm_provider}"},
            run_id=run_id_from_request(http_request),
        )
        return add_artifact_headers(error, run_id=run_id, artifact_path=artifact_path)
    except Exception as exc:
        error = error_response(
            status_code=502,
            code="EXTRACT_ERROR",
            message="LLM extraction failed",
            details={"reason": "internal error"},
        )
        run_id, artifact_path = write_artifact(
            endpoint="/extract",
            request=request,
            response={"error": error.body.decode("utf-8")},
            status="error",
            evidence={
                "mode": f"live_{settings.normalized_llm_provider}"
                if settings.sidecar_llm_enabled
                else "mock_fixture",
                "error": str(exc),
            },
            run_id=run_id_from_request(http_request),
        )
        return add_artifact_headers(error, run_id=run_id, artifact_path=artifact_path)
    response = Response(content=result.model_dump_json(), media_type="application/json")
    return add_artifact_headers(response, run_id=run_id, artifact_path=artifact_path)
