import asyncio
import contextlib
import signal

import structlog

from app.core import container
from app.core.config import Settings, get_settings
from app.core.database import ProcessRole, advisory_lock
from app.core.telemetry import configure_logging

SCHEDULER_LOCK_KEY = 0x5358495F53434844

_log = structlog.get_logger("app.core.scheduler")


async def _hold_lock_and_run(clients: container.Clients) -> None:
    _log.info("scheduler_waiting_for_run_lock")
    async with advisory_lock(
        clients.engine, SCHEDULER_LOCK_KEY, poll_s=clients.settings.scheduler_lock_poll_s
    ):
        _log.info("scheduler_started")
        await asyncio.Event().wait()


async def run(settings: Settings, stop: asyncio.Event) -> None:
    """Run jobs under the process wide run lock until `stop` is set."""
    async with container.lifespan(settings, ProcessRole.WORKER) as clients:
        worker = asyncio.create_task(_hold_lock_and_run(clients))
        stopped = asyncio.create_task(stop.wait())
        await asyncio.wait({worker, stopped}, return_when=asyncio.FIRST_COMPLETED)
        for task in (worker, stopped):
            task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await worker
        _log.info("scheduler_stopped")


def main() -> None:
    settings = get_settings()
    configure_logging(settings)

    async def _main() -> None:
        stop = asyncio.Event()
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(sig, stop.set)
        await run(settings, stop)

    asyncio.run(_main())


if __name__ == "__main__":
    main()
