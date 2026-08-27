"""FastAPI application factory and entrypoint.

Run from the repo root:
    uv run uvicorn backend.app.main:app --reload
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from tortoise import Tortoise

from backend.app.api.routes import (
    evaluation,
    products,
    purchases,
    recommendations,
    rules,
    sales,
    stores,
)
from backend.app.config import Settings, get_settings
from backend.app.domain.errors import DomainError
from backend.app.telemetry import setup_telemetry

logger = logging.getLogger(__name__)


def _lifespan(settings: Settings):
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        db_path = Path(settings.db_url.split("://", 1)[1])
        # _enable_global_fallback: lifespan and requests run in different
        # asyncio tasks, so Tortoise needs a cross-task context.
        await Tortoise.init(
            db_url=settings.db_url,
            modules={"models": ["backend.app.infrastructure.db.tortoise_models"]},
            _enable_global_fallback=True,
        )
        if not db_path.exists():
            logger.info("Database not found, generating schemas: %s", db_path)
            await Tortoise.generate_schemas(safe=True)
        yield
        await Tortoise.close_connections()

    return lifespan


def create_app(settings: Settings | None = None, skip_db_init: bool = False) -> FastAPI:
    settings = settings or get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "Cadena ferretera: inventario compartido, flujo de compras por tienda "
            "y sistema de recomendación híbrido explicable."
        ),
    )
    if not skip_db_init:
        app.router.lifespan_context = _lifespan(settings)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(DomainError)
    async def domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"detail": str(exc)})

    @app.get("/api/health")
    async def health_check():
        return {"status": "ok", "service": settings.app_name}

    app.include_router(stores.router, prefix="/api")
    app.include_router(products.router, prefix="/api")
    app.include_router(sales.router, prefix="/api")
    app.include_router(purchases.router, prefix="/api")
    app.include_router(recommendations.router, prefix="/api")
    app.include_router(rules.router, prefix="/api")
    app.include_router(evaluation.router, prefix="/api")

    setup_telemetry(app, settings)
    return app


app = create_app()
