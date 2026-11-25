from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from app.core.config import Settings
from app.core.database import ProcessRole, make_engine, make_sessionmaker
from app.core.redis import make_redis
from app.repositories.unit_of_work import make_uow_factory
from app.services.readiness_service import ReadinessService


@dataclass(frozen=True, slots=True)
class Clients:
    settings: Settings
    engine: AsyncEngine
    sessionmaker: async_sessionmaker[AsyncSession]
    redis: Redis


@asynccontextmanager
async def lifespan(settings: Settings, role: ProcessRole) -> AsyncIterator[Clients]:
    """Open every long lived client once per process and close them on exit."""
    engine = make_engine(settings, role)
    redis = make_redis(settings)
    try:
        yield Clients(settings, engine, make_sessionmaker(engine), redis)
    finally:
        await redis.aclose()
        await engine.dispose()


def readiness_service(clients: Clients) -> ReadinessService:
    return ReadinessService(
        make_uow_factory(clients.sessionmaker),
        clients.redis,
        clients.settings.readiness_timeout_s,
    )
