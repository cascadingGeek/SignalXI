# Backend

## Overview

FastAPI API plus a separate scheduler worker process, managed with `uv`. The worker runs the batch prediction pipeline (football API ingest, pure statistical engine, LangGraph + OpenRouter, save, Redis warm); the API only serves cached results behind a server side paywall. Every rule below comes from spec 0001 and is machine enforced.

## Key files

| File | Owns |
|---|---|
| `app/main.py` | Builds the FastAPI app, includes routers, runs `container.lifespan()` |
| `app/core/scheduler.py` | Separate process (`python -m app.core.scheduler`) that calls workers on schedule |
| `app/core/container.py` | Composition root: `Clients`, `lifespan()`, one factory per service, `build_graph` |
| `app/core/dependency.py` | FastAPI glue only (`Annotated` deps, `rate_limit`) |
| `app/core/config.py` | Settings, the only module that reads env |
| `app/controllers/presenter.py` | The only place public prediction/ledger responses are built (paywall) |
| `app/repositories/unit_of_work.py` | `UnitOfWork`: one transaction per top level service call |
| `app/services/statistical_engine.py` | Pure math, no I/O |
| `tests/architecture/test_layers.py` | Layer map, allowlists, presenter only rule |
| `app/http/` | Request id middleware and the `AppError` kind to status map (one `ErrorResponse` body) |
| `Procfile` | `honcho` process list: `api` (uvicorn, reload) and `worker` (scheduler) |
| `scripts/export_openapi.py` | Writes `openapi.json` for the frontend's generated types; CI fails on drift |
| `Dockerfile` | One image for both Render services; the worker overrides the start command |

## Conventions

- Layer map (top to bottom, imports only point down): `main` | `core.scheduler` → `http` → `routes` | `workers` → `core.dependency` → `core.container` → `controllers` → `services` → `workflow` → `repositories` | `tools` → `models` → `core.database` | `core.redis` | `core.telemetry` | `core.security` → `core.config` | `core.errors` → `knowledge` → `schemas` → `utils`. Siblings (`|`) never import each other. Full table and allowlists: spec 0001.
- Routes: declaration, `Depends`, `response_model`, then one controller call. They import only `fastapi`, `app.controllers`, `app.core.dependency`, `app.schemas`.
- Controllers: one async function per route; call services; build responses via `presenter`; never import repositories, models, tools, workflow, or `core` infrastructure; never catch and convert errors.
- Services hold all business logic, cache, auth, and transactions. No `fastapi`/`starlette` below `core.dependency` (workers included).
- Constructor injection everywhere; no module level clients, graphs, or tracers. Only `core.container` builds real clients, inside `lifespan()`.
- Raise `AppError` subclasses below controllers, never `HTTPException`. `app.http` maps `kind` to status.
- Transactions: exactly one `async with uow_factory()` per top level service call; pass `uow` to nested service calls; repositories never commit; convert ORM rows to schemas inside the block (`lazy="raise"`).
- `workflow/` graph is Validate inputs, LLM, Validate output; it never imports services, repositories, models, or saves anything.
- Models mirror `supabase/migrations` SQL by hand (no Alembic).

## Gotchas

- `statistical_engine.py` bans `os`, `sys`, `time`, `random`, `socket`, `subprocess`, `pathlib`, `io`, `datetime.now`/`utcnow`, `date.today`, and unseeded `numpy.random`. Pass "now" and seeds as parameters.
- `app/core/__init__.py` stays empty; adding a `core` module means placing it in the `import-linter` contract.
- `tests/unit/` runs with `pytest-socket` (`--disable-socket`), no `.env`, no DB, no Redis: use `FakeUnitOfWork` and `fakeredis`. Integration tests opt in with a marker and use `docker-compose.yml`. Keep the unit suite under 5 s.
- Exceptions to the layer rules need a named `ignore_imports` entry in `pyproject.toml` linking an updated spec.
- `tests/unit/` also passes `--allow-unix-socket`: asyncio's event loop needs a local socket pair on macOS and Linux.
- `app.main` builds the app at import, so it needs env: `tests/conftest.py` sets test values, and `scripts.export_openapi` reads `backend/.env` locally or the job env in CI.
- The scheduler holds a Postgres advisory lock (`SCHEDULER_LOCK_KEY`) for its whole run; a second worker waits instead of running jobs. Without Postgres it exits 1, which also stops `honcho start`.

## Agent skills

- [fastapi](../.claude/skills/fastapi/): `fastapi/fastapi`, routes, dependencies, responses
- [pydantic](../.claude/skills/pydantic/): `pydantic/skills`, v2 schemas and validators
- [uv](../.claude/skills/uv/): `astral-sh/agent-plugins`, dependency and project management
- [python-backend](../.claude/skills/python-backend/): `yonatangross/orchestkit`, SQLAlchemy 2.0 async sessions, FastAPI dependencies, pool tuning (spec 0001 layering wins where they differ)
- [redis-core](../.claude/skills/redis-core/): `redis/agent-skills`, key naming and data structures
- [redis-connections](../.claude/skills/redis-connections/): `redis/agent-skills`, pooling, pipelining, timeouts
- [langgraph-fundamentals](../.claude/skills/langgraph-fundamentals/): `langchain-ai/langchain-skills`, graph, state, nodes (retired upstream; consider `langchain-build-agent`)
- [langfuse](../.claude/skills/langfuse/): `langfuse/skills`, LLM tracing and prompt versioning
- [openrouter-models](../.claude/skills/openrouter-models/): `openrouterteam/skills`, model choice, pricing, providers
- [paystack-webhooks](../.claude/skills/paystack-webhooks/): `rexedge/paystack`, webhook signatures and event handling (community, review before relying on it)

## Related specs

- [0001 Backend layering and dependency rules](../docs/specs/backend/0001-backend-layering-dependency-rules/index.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
