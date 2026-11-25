import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from enum import StrEnum
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import Settings


class ProcessRole(StrEnum):
    API = "api"
    WORKER = "worker"


def make_engine(settings: Settings, role: ProcessRole) -> AsyncEngine:
    connect_args: dict[str, Any] = {
        "server_settings": {"statement_timeout": str(settings.db_statement_timeout_ms)},
    }
    if settings.is_production:
        connect_args["ssl"] = "require"
    if role is ProcessRole.API:
        pool_size, max_overflow = settings.db_api_pool_size, settings.db_api_max_overflow
    else:
        pool_size, max_overflow = settings.db_worker_pool_size, 0
    return create_async_engine(
        settings.database_url.unicode_string(),
        pool_size=pool_size,
        max_overflow=max_overflow,
        pool_pre_ping=True,
        connect_args=connect_args,
    )


def make_sessionmaker(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False)


@asynccontextmanager
async def advisory_lock(engine: AsyncEngine, key: int, *, poll_s: float) -> AsyncIterator[None]:
    """Hold a Postgres advisory lock on one autocommit connection for the whole block."""
    async with engine.connect() as conn:
        conn = await conn.execution_options(isolation_level="AUTOCOMMIT")
        while not (  # noqa: ASYNC110  polls Postgres, so an Event cannot replace the sleep
            await conn.execute(text("select pg_try_advisory_lock(:key)"), {"key": key})
        ).scalar_one():
            await asyncio.sleep(poll_s)
        try:
            yield
        finally:
            await conn.execute(text("select pg_advisory_unlock(:key)"), {"key": key})
