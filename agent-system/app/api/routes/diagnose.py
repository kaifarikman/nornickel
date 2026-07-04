from __future__ import annotations

import json
import zipfile

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from openpyxl.utils.exceptions import InvalidFileException

from app.api.errors import error_response
from app.infra.paths import PathEscapesRepoError
from app.schemas import DiagnoseRequest, DiagnosticsReport
from app.infra.artifacts import (
    add_artifact_headers,
    json_response_with_artifact,
    run_id_from_request,
    write_artifact,
)
from app.pipeline.diagnose.service import ChecksumMismatchError, diagnose_xlsx


router = APIRouter(tags=["diagnose"])


@router.post("/diagnose", response_model=DiagnosticsReport)
def diagnose(request: DiagnoseRequest, http_request: Request) -> DiagnosticsReport | JSONResponse:
    # XLSX_PARSE_ERROR — только «файл не найден / не читается как xlsx».
    # ChecksumMismatchError — файл прочитан, но противоречит сам себе (>5%).
    # Прочие исключения НЕ заворачиваем: честный 500, чтобы баг не маскировался
    # под «плохой файл».
    try:
        result = diagnose_xlsx(request)
    except (FileNotFoundError, PathEscapesRepoError):
        return _diagnose_error(
            request,
            http_request,
            code="XLSX_PARSE_ERROR",
            message="XLSX source file not found",
            details={"file_path": request.file_path},
        )
    except (InvalidFileException, zipfile.BadZipFile) as exc:
        return _diagnose_error(
            request,
            http_request,
            code="XLSX_PARSE_ERROR",
            message="XLSX source cannot be parsed",
            details={"file_path": request.file_path, "reason": str(exc)},
        )
    except ChecksumMismatchError as exc:
        return _diagnose_error(
            request,
            http_request,
            code="CHECKSUM_MISMATCH",
            message="XLSX totals diverge from control rows beyond tolerance",
            details={"file_path": request.file_path, "issues": exc.issues},
        )

    run_id, artifact_path = write_artifact(
        endpoint="/diagnose",
        request=request,
        response=result,
        evidence={
            "source_file": result.source_file,
            "loss_cells": len(result.loss_cells),
            "diagnosis_summary": [item.model_dump(mode="json") for item in result.diagnosis_summary],
            "data_quality": [item.model_dump(mode="json") for item in result.data_quality],
            "cell_refs": [cell.cell_ref for cell in result.loss_cells],
        },
        run_id=run_id_from_request(http_request),
    )
    return json_response_with_artifact(result, run_id=run_id, artifact_path=artifact_path)


def _diagnose_error(
    request: DiagnoseRequest,
    http_request: Request,
    *,
    code: str,
    message: str,
    details: object,
) -> JSONResponse:
    error = error_response(status_code=422, code=code, message=message, details=details)
    run_id, artifact_path = write_artifact(
        endpoint="/diagnose",
        request=request,
        response={"error": json.loads(error.body)},
        status="error",
        evidence={"source_file": request.file_path},
        run_id=run_id_from_request(http_request),
    )
    return add_artifact_headers(error, run_id=run_id, artifact_path=artifact_path)
