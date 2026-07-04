from __future__ import annotations

from fastapi.responses import JSONResponse

from app.schemas import ApiError, ErrorEnvelope


def error_response(status_code: int, code: str, message: str, details: object = None) -> JSONResponse:
    payload = ErrorEnvelope(error=ApiError(code=code, message=message, details=details))
    return JSONResponse(status_code=status_code, content=payload.model_dump())
