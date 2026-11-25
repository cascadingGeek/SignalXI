import asyncio

from redis.asyncio import Redis

from app.core.errors import DependencyUnavailable
from app.repositories.unit_of_work import UowFactory
from app.schemas.health import ReadinessResponse


class ReadinessService:
    """Confirms Postgres and Redis both answer before the API takes traffic."""

    def __init__(self, uow_factory: UowFactory, redis: Redis, timeout_s: float) -> None:
        self._uow_factory = uow_factory
        self._redis = redis
        self._timeout_s = timeout_s

    async def check(self) -> ReadinessResponse:
        postgres_ok, redis_ok = await asyncio.gather(self._postgres_ok(), self._redis_ok())
        failed = [name for name, ok in (("postgres", postgres_ok), ("redis", redis_ok)) if not ok]
        if failed:
            raise DependencyUnavailable(f"unavailable: {', '.join(failed)}")
        return ReadinessResponse()

    async def _postgres_ok(self) -> bool:
        try:
            async with asyncio.timeout(self._timeout_s), self._uow_factory() as uow:
                await uow.health.ping()
        except Exception:  # noqa: BLE001
            return False
        return True

    async def _redis_ok(self) -> bool:
        try:
            async with asyncio.timeout(self._timeout_s):
                return bool(await self._redis.ping())
        except Exception:  # noqa: BLE001
            return False
