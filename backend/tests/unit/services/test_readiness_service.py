from types import TracebackType
from typing import Self

import pytest
from fakeredis import FakeAsyncRedis

from app.core.errors import DependencyUnavailable, ErrorKind
from app.services.readiness_service import ReadinessService


class FakeHealth:
    def __init__(self, healthy: bool) -> None:
        self._healthy = healthy

    async def ping(self) -> None:
        if not self._healthy:
            raise ConnectionError("postgres down")


class FakeUnitOfWork:
    def __init__(self, healthy: bool = True) -> None:
        self.health = FakeHealth(healthy)

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        return None


class BrokenRedis(FakeAsyncRedis):
    async def ping(self, **kwargs: object) -> bool:
        raise ConnectionError("redis down")


async def test_ready_when_postgres_and_redis_answer() -> None:
    service = ReadinessService(lambda: FakeUnitOfWork(), FakeAsyncRedis(), timeout_s=1)

    result = await service.check()

    assert result.status == "ready"


@pytest.mark.parametrize(
    ("postgres_up", "redis_up", "expected"),
    [
        (False, True, "unavailable: postgres"),
        (True, False, "unavailable: redis"),
        (False, False, "unavailable: postgres, redis"),
    ],
)
async def test_names_each_failed_dependency(
    postgres_up: bool, redis_up: bool, expected: str
) -> None:
    redis = FakeAsyncRedis() if redis_up else BrokenRedis()
    service = ReadinessService(lambda: FakeUnitOfWork(postgres_up), redis, timeout_s=1)

    with pytest.raises(DependencyUnavailable) as caught:
        await service.check()

    assert caught.value.kind is ErrorKind.UNAVAILABLE
    assert caught.value.message == expected
