"""FastAPI entrypoint for the Python agent sidecar."""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api.errors import error_response
from app.api.routes.diagnose import router as diagnose_router
from app.api.routes.constraints import router as constraints_router
from app.api.routes.embed import router as embed_router
from app.api.routes.extract import router as extract_router
from app.api.routes.health import router as health_router
from app.api.routes.narrate import router as narrate_router
from app.api.routes.novelty import router as novelty_router
from app.api.routes.retrieve import router as retrieve_router
from app.api.routes.skeptic import router as skeptic_router


def create_app() -> FastAPI:
    app = FastAPI(title="Nornikel Python Agent Sidecar", version="0.1.0")
    app.include_router(health_router)
    app.include_router(diagnose_router)
    app.include_router(constraints_router)
    app.include_router(extract_router)
    app.include_router(embed_router)
    app.include_router(retrieve_router)
    app.include_router(novelty_router)
    app.include_router(skeptic_router)
    app.include_router(narrate_router)

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        _request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        # 400: запрос не прошёл структурную валидацию (битый JSON / не та схема).
        # 422 зарезервирован за бизнес-валидацией валидного JSON (CONTRACTS.md).
        return error_response(
            status_code=400,
            code="VALIDATION_ERROR",
            message="Request does not match sidecar contract",
            details=exc.errors(),
        )

    return app


app = create_app()
