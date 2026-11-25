from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute

from app.core import container
from app.core.config import Settings, get_settings
from app.core.database import ProcessRole
from app.core.telemetry import configure_logging
from app.http import RequestContextMiddleware, install_error_handlers
from app.routes import health


def _operation_id(route: APIRoute) -> str:
    return route.name


def create_app(settings: Settings) -> FastAPI:
    """Build the API; clients open in the lifespan, never at import."""

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        configure_logging(settings)
        async with container.lifespan(settings, ProcessRole.API) as clients:
            app.state.clients = clients
            yield

    app = FastAPI(
        title="SignalXI API",
        version="0.1.0",
        lifespan=lifespan,
        generate_unique_id_function=_operation_id,
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None,
        openapi_url=None if settings.is_production else "/openapi.json",
    )
    install_error_handlers(app)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allowed_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
        max_age=600,
    )
    app.add_middleware(RequestContextMiddleware)
    app.include_router(health.router)
    return app


app = create_app(get_settings())
