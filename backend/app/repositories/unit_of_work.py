from collections.abc import Callable
from types import TracebackType
from typing import Protocol, Self

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.repositories.health_repository import HealthRepository


class HealthQueries(Protocol):
    async def ping(self) -> None: ...


class UnitOfWork(Protocol):
    @property
    def health(self) -> HealthQueries: ...

    async def __aenter__(self) -> Self: ...

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None: ...


type UowFactory = Callable[[], UnitOfWork]


class SqlUnitOfWork:
    """One transaction per top level service call: commit on success, roll back on error."""

    def __init__(self, sessionmaker: async_sessionmaker[AsyncSession]) -> None:
        self._sessionmaker = sessionmaker
        self._session: AsyncSession | None = None
        self._health: HealthRepository | None = None

    @property
    def health(self) -> HealthRepository:
        if self._health is None:
            raise RuntimeError("UnitOfWork used outside `async with`")
        return self._health

    async def __aenter__(self) -> Self:
        self._session = self._sessionmaker()
        self._health = HealthRepository(self._session)
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        session = self._session
        if session is None:
            return
        try:
            if exc_type is None:
                await session.commit()
            else:
                await session.rollback()
        finally:
            await session.close()
            self._session = None
            self._health = None


def make_uow_factory(sessionmaker: async_sessionmaker[AsyncSession]) -> UowFactory:
    return lambda: SqlUnitOfWork(sessionmaker)
