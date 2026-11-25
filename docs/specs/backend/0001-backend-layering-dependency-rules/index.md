# 0001. Enforce strict downward layering in the backend

**Date**: 2026-11-24
**Status**: Accepted

## Summary

This spec sets the one shape every file in `backend/app` must follow: which folder may import which, so requests and jobs only ever flow downward (routes, then controllers, then services, then the data and AI layers). Routes hold route declarations only, controllers hold one function per route, and only services and the layers below them touch Supabase, Redis, or OpenRouter. `services/statistical_engine.py` stays pure math with no I/O (input and output, meaning network, disk, env, or clock), so its tests run in milliseconds. The rules are checked by machines on every commit (`import-linter` plus a small architecture test), not just by review.

## Decision

**Chosen option**: Option 2: Refined layer map, enforced by `import-linter`, an allowlist architecture test, and `pytest-socket`.

Every module in `backend/app` belongs to exactly one layer from the map below; imports only point down; the extra direct import rules below hold for routes, controllers, workers, workflow, and the statistical engine; CI fails on any violation.

**Implementation skills**: `fastapi` (`fastapi/fastapi`, `.claude/skills/fastapi/`) · `pydantic` (`pydantic/skills`, `.claude/skills/pydantic/`) · `uv` (`astral-sh/agent-plugins`, `.claude/skills/uv/`) · `supabase` (`supabase/agent-skills`, `.claude/skills/supabase/`) · `supabase-postgres-best-practices` (`supabase/agent-skills`, `.claude/skills/supabase-postgres-best-practices/`) · `redis-connections` (`redis/agent-skills`, `.claude/skills/redis-connections/`) · `redis-core` (`redis/agent-skills`, `.claude/skills/redis-core/`) · `langgraph-fundamentals` (`langchain-ai/langchain-skills`, `.claude/skills/langgraph-fundamentals/`) · `langfuse` (`langfuse/skills`, `.claude/skills/langfuse/`) · `openrouter-models` (`openrouterteam/skills`, `.claude/skills/openrouter-models/`)

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Standard definition

### Layer map (top to bottom; a layer may import any layer below it, never above)

`|` marks independent siblings (they may not import each other). Every module under `app/` maps to exactly one row; the architecture test fails on any unmapped module.

| # | Layer (modules) | Owns | Never does |
|---|---|---|---|
| 1 | `app.main` \| `app.core.scheduler` | Entrypoints. `main.py` builds the FastAPI app, includes routers, installs `app.http`, and runs `container.lifespan()` in its lifespan. `core/scheduler.py` is a separate process (`python -m app.core.scheduler`) that opens `container.lifespan()` once and calls worker functions on their schedules. | Business logic. The API process never starts jobs. |
| 2 | `app.http` | Middleware (request id, logging) and the exception handler that maps `AppError.kind` to an HTTP status and a stable JSON error body. | Business logic. |
| 3 | `app.routes` \| `app.workers` | Routes: path, method, `Depends`, `response_model`, reading request primitives (body bytes, headers), then one call to the matching controller function. Workers: one async function per job, `async def run_x(clients: Clients)`, that builds its services from `core.container` and calls them. | Any logic, query, or client. Workers never import `core.dependency`, controllers, or routes. |
| 4 | `app.core.dependency` | FastAPI glue only: `get_clients(request)`, `Annotated` aliases (`PredictionServiceDep`, `ViewerDep`, `SlateFiltersDep`, `rate_limit("predictions")`) that call `core.container` factories and delegate auth, tier, session cap, and rate limit checks to services. | Building clients or holding rules. |
| 5 | `app.core.container` | Composition root, free of any framework: `Clients` (frozen dataclass of settings, sessionmaker, Redis, LLM tool, tracer), `lifespan(settings)` (an async context manager that opens and closes the database engine, Redis pool, and LangFuse), and one factory per service (`prediction_service(clients)`), including `build_graph(llm, tracer)` for the workflow. | Importing `fastapi` or `starlette`. Business rules. |
| 6 | `app.controllers` | One async function per route in `*_controller.py`. Calls services and builds every public response through `controllers/presenter.py` (`present(data, viewer)`), the single place that applies the server side paywall. | Importing repositories, models, tools, workflow, `core.database`, `core.redis`, `core.security`, `core.telemetry`. One `*_controller` importing another. |
| 7 | `app.services` | All business logic, transactions (unit of work), Redis cache, auth (including fetching and caching the Supabase JWKS, the public keys tokens are signed with), rate limit and device session logic, pipeline orchestration. `statistical_engine.py` lives here but is pure (rules below). | Importing `fastapi` or `starlette`. Import cycles between services. |
| 8 | `app.workflow` | LangGraph graph, state, nodes. `build_graph(llm, tracer)` returns a compiled graph; nodes get their collaborators from that call (closure or the graph's runtime config), never from globals. Graph is Validate inputs, LLM, Validate output; it receives computed stats in its initial state and returns a typed `FixtureReport` schema. | Importing services, repositories, models, `core.database`, `core.redis`. Saving anything. |
| 9 | `app.repositories` \| `app.tools` | Repositories: all SQL via SQLAlchemy 2.0 async on an `AsyncSession` they are given, plus `unit_of_work.py`. Tools: external API adapters (`football_api.py`, `openrouter.py`), constructed with their HTTP client and settings. | Repositories never commit. Tools never import each other or repositories. |
| 10 | `app.models` | SQLAlchemy declarative models mirroring `supabase/migrations` SQL. `models/base.py` holds `Base`; every relationship uses `lazy="raise"`. | Importing anything in `app` except `app.schemas.enums`. |
| 11 | `app.core.database` \| `app.core.redis` \| `app.core.telemetry` \| `app.core.security` | Engine and session factory; Redis pool factory; LangFuse setup; HMAC verification and JWT verification against keys passed in (no fetching). | Network fetches of their own, except opening the connections they own. |
| 12 | `app.core.config` \| `app.core.errors` | Settings (the only module that reads env); domain exceptions `AppError(kind, message)` where `kind` is a plain enum, not an HTTP code. | Importing anything above the leaf tier. |
| 13 | `app.knowledge` | Versioned prompt templates and market descriptions. | Any I/O. |
| 14 | `app.schemas` | Pydantic v2 schemas (requests, responses, LLM output, internal DTOs). `schemas/enums.py` holds every strict enum plus the section to allowed markets mapping used by validators. | Importing `fastapi`. Any I/O. |
| 15 | `app.utils` | Pure helpers (WAT time conversion, probability math, log formatting). | Any I/O. Importing anything in `app`. |

`app/core/__init__.py` stays empty, so each `core` module is placed on its own.

### Request and job flow

```
HTTP:  main ─▶ http ─▶ routes ─▶ core.dependency ─▶ core.container (built clients)
                         └──▶ controllers ─▶ presenter (paywall)
                                   └──▶ services ─▶ workflow ─▶ tools
                                           ├──▶ repositories (unit of work) ─▶ models
                                           └──▶ injected Redis client

Jobs:  core.scheduler ─▶ container.lifespan() ─▶ workers(clients) ─▶ container factories ─▶ services

Pipeline service: tools.football_api (ingest) ─▶ statistical_engine (pure)
                  ─▶ graph from build_graph (LLM) ─▶ repositories (save, one transaction) ─▶ Redis warm
```

### Direct import rules (on top of the layer direction)

Allowlists govern imports of `app.*` modules and third party packages. The standard library is exempt except where a ban is listed. Imports under `TYPE_CHECKING` count.

| Module(s) | May import directly (allowlist) |
|---|---|
| `app.routes.*` | `fastapi`, `app.controllers`, `app.core.dependency`, `app.schemas` |
| `app.controllers.*` | `app.services` (types and calls), `app.schemas`, `app.knowledge`, `app.utils`, `app.core.errors`, `app.core.config`; `*_controller` modules may also import `app.controllers.presenter` |
| `app.workers.*` | `app.core.container`, `app.services`, `app.schemas`, `app.utils`, `app.core.config`, `app.core.errors`, `app.core.telemetry` |
| `app.services.statistical_engine` | `numpy`, `scipy`, `app.schemas`, `app.utils`, `app.knowledge`, `app.core.errors`. Banned even from the standard library: `os`, `sys`, `time`, `random`, `socket`, `subprocess`, `pathlib`, `io`; calls to `datetime.now`, `datetime.utcnow`, `date.today`; `numpy.random` unless it is given a seed argument. |

Banned in layers 3 (workers only), 5, and 7 to 15: `fastapi`, `starlette`. Pydantic is allowed everywhere.

### Wiring, errors, transactions

- **Constructor injection.** Services, repositories, and tools take collaborators in `__init__`. Nothing imports a global client. Only `core.container` calls constructors for real clients, and only inside `lifespan()`.
- **One lifecycle for both processes.** `main.py` stores the `Clients` yielded by `container.lifespan()` on `app.state.clients`; the scheduler holds the same object for its whole run. Shutdown closes everything in both.
- **Errors.** Services, repositories, and tools raise `AppError` subclasses (`NotFoundError`, `PaymentSignatureInvalid`, `SessionLimitExceeded`, `RateLimited`, `LlmOutputInvalid`, ...). `app.http` maps `kind` to status. Controllers do not catch and convert.
- **Transactions.** `repositories/unit_of_work.py` exposes `UnitOfWork` (async context manager) with repositories as attributes (`uow.fixtures`, `uow.reports`, `uow.picks`, `uow.subscriptions`). Exactly one unit of work per top level service call: it commits on clean exit and rolls back on any exception. A service that calls another service inside a transaction passes `uow` as an argument; nested `async with uow_factory()` is forbidden. Repositories never commit. Services convert ORM rows to schemas inside the `async with` block; `lazy="raise"` turns any later lazy load into an immediate error. Controllers only ever see schemas.
- **Redis.** Services receive a `redis.asyncio.Redis` client in `__init__`. There is no Redis repository.
- **Pipeline persistence.** `pipeline_service` runs the engine, invokes the graph, saves `fixture_reports` and `prediction_picks` in one unit of work, then warms Redis after commit.
- **Paywall.** Public prediction and ledger response schemas are only ever built in `controllers/presenter.py`, which returns a locked or unlocked variant per item based on the `Viewer`. The architecture test fails if those response types are built anywhere else.

### Statistical engine purity contract

- No network, disk, env, subprocess, or wall clock: "now" and any seed are parameters. Enforced by the allowlist and bans above plus `pytest-socket`.
- Functions take and return frozen dataclasses or frozen Pydantic models from `app.schemas` (for example `TeamFormInput`, `FixtureProbabilities`).
- Imports no other service (it is the leaf of the services layer).

### Testing contract

- `tests/unit/` mirrors `app/`, runs with `pytest-socket` (`--disable-socket`), needs no `.env`, no database, no Redis. Services are tested with `FakeUnitOfWork` (in memory repositories) and `fakeredis`; the graph with a fake LLM tool passed to `build_graph`.
- `tests/integration/` opts in to sockets with a marker and uses real Supabase (local) and Redis from `docker-compose.yml`. It includes a guest sweep: call every public route as a guest and assert that no locked pick, `avoid_tooltip`, or `market_sections` content appears.
- `tests/architecture/test_layers.py` (uses `grimp`, which `import-linter` installs): every `app.*` module maps to one layer, the allowlists and bans above (AST walk for the engine's call bans), no cycles among `app.services.*`, and response types built only in the presenter.
- Target: the whole unit suite under 5 seconds locally. Watched in review, not a CI gate.

**Canonical pattern**:

```python
# app/routes/predictions.py  (route code only)
from fastapi import APIRouter
from app.controllers import prediction_controller
from app.core.dependency import PredictionServiceDep, SlateFiltersDep, ViewerDep, rate_limit
from app.schemas.predictions import DailySlateResponse

router = APIRouter(prefix="/predictions", tags=["predictions"])

@router.get("/daily", response_model=DailySlateResponse,
            dependencies=[rate_limit("predictions")])
async def get_daily_slate(filters: SlateFiltersDep, viewer: ViewerDep,
                          service: PredictionServiceDep) -> DailySlateResponse:
    return await prediction_controller.get_daily_slate(viewer, filters, service)


# app/controllers/prediction_controller.py  (one function per route)
from app.controllers.presenter import present_slate
from app.services.prediction_service import PredictionService
from app.schemas.predictions import DailySlateResponse, SlateFilters, Viewer

async def get_daily_slate(viewer: Viewer, filters: SlateFilters,
                          service: PredictionService) -> DailySlateResponse:
    slate = await service.get_daily_slate(filters)
    return present_slate(slate, viewer)  # the only path to a public response


# app/services/prediction_service.py  (logic, cache, transaction)
class PredictionService:
    def __init__(self, uow_factory: UowFactory, redis: Redis, cache_ttl_s: int) -> None: ...

    async def get_daily_slate(self, filters: SlateFilters) -> Slate:
        if cached := await self._read_cache(filters):
            return cached
        async with self._uow_factory() as uow:
            rows = await uow.reports.list_for_slate(filters.slate_date, filters.competition)
            slate = Slate.from_rows(rows)   # converted inside the transaction
        await self._write_cache(filters, slate)
        return slate


# app/core/container.py  (composition root, no framework)
@asynccontextmanager
async def lifespan(settings: Settings) -> AsyncIterator[Clients]:
    engine, redis = make_engine(settings), make_redis(settings)
    try:
        yield Clients(settings, make_sessionmaker(engine), redis, make_llm(settings), make_tracer(settings))
    finally:
        await redis.aclose(); await engine.dispose()

def prediction_service(c: Clients) -> PredictionService:
    return PredictionService(make_uow_factory(c.sessionmaker), c.redis, c.settings.slate_cache_ttl_s)


# app/core/dependency.py  (FastAPI glue only)
def get_clients(request: Request) -> Clients:
    return request.app.state.clients

def get_prediction_service(c: Annotated[Clients, Depends(get_clients)]) -> PredictionService:
    return container.prediction_service(c)

PredictionServiceDep = Annotated[PredictionService, Depends(get_prediction_service)]
SlateFiltersDep = Annotated[SlateFilters, Query()]


# app/workers/daily_slate_job.py  (job entry, no framework)
async def run_daily_slate(clients: Clients) -> None:
    await container.pipeline_service(clients).run_daily_slate(now=utc_now())
```

**Replaces** (patterns from the PRD draft or common FastAPI habits that are now wrong):
- Route handlers with logic, queries, or `try/except` (logic belongs in the controller or service).
- Routes importing `core.security` dependencies that talk to Redis (they import aliases from `core.dependency`).
- `Depends` aliases or `Query` inside `app.schemas` (they live in `core.dependency`).
- A `Stats` node and a `Save` node inside `workflow/graph.py` (the service computes before and saves after the graph).
- Module level graphs, LLM clients, or `@observe` tracers bound to globals (built by `build_graph(llm, tracer)`).
- Services building queries on `models/` directly (go through `uow.<repository>`).
- Repositories or services calling `session.commit()` per method, or nested units of work.
- Module level clients (`from app.core.redis import redis`).
- Paywall checks scattered across controllers (only `present(...)` builds public responses).
- `HTTPException` raised anywhere below controllers (raise an `AppError` subclass).
- `os.environ` / `os.getenv` outside `core/config.py`.

**Enforcement**:
- `import-linter` contracts in `backend/pyproject.toml` (`[tool.importlinter]`, `root_package = "app"`, `include_external_packages = true`), run by `uv run lint-imports` in `pre-commit` and CI:
  - **layers** contract with the 15 layers above, siblings written with `|`. Check the `|` sibling syntax against the installed `import-linter` version when scaffolding.
  - **independence** contracts: the `app.controllers.*_controller` modules, `app.routes.*`, `app.tools.*`, `app.workers.*`.
  - **forbidden** contract: layers 5 and 7 to 15 plus `app.workers` may not import `fastapi`, `starlette`.
  - **forbidden** contract: `app.workers` may not import `app.core.dependency`, `app.controllers`, `app.routes`.
  - **forbidden** contract: `app.workflow` may not import `app.services`, `app.repositories`, `app.models`, `app.core.database`, `app.core.redis`.
  - **forbidden** contract with `allow_indirect_imports = true` for routes: no `redis`, `sqlalchemy`, `asyncpg`, `httpx`, `langgraph`, `app.services`, `app.repositories`, `app.models`, `app.tools`, `app.workflow`, `app.core.container`, `app.core.database`, `app.core.redis`, `app.core.security`, `app.core.telemetry`. Reaching these indirectly through the controller is expected; only direct imports are banned. List only external packages that are actually installed (some `import-linter` versions error on a forbidden package missing from the graph); check this when scaffolding.
- `tests/architecture/test_layers.py` as described in the testing contract.
- `pytest-socket` on `tests/unit/` as the runtime backstop.
- **Residual risk (accepted):** static checks cannot see access at runtime (a controller reaching `service._redis`, `importlib`, `getattr` tricks). Code review and `pytest-socket` cover these; private attribute access across layers is a review blocker.

**Rollout**: New code immediately. The backend is empty today, so the scaffold commit ships the folders, contracts, architecture test, and `pre-commit` config together, with zero existing violations.

**Exceptions**: None. A future exception must be a named `ignore_imports` entry in `pyproject.toml` with a comment linking an updated spec.

## Consequences

**Positive**:
- Every layer is testable on its own: engine and services with no network, controllers with fake services, graph with a fake LLM.
- The paywall lives in one function (`present`), so leakage tests target one place, and a guest sweep covers every route.
- API instances never run jobs, so scaling the API to 2 or more instances adds no job runs. (Protecting against a second scheduler instance or overlapping deploys needs a per job lock; see Follow-up.)
- Violations fail in `pre-commit`, before review.

**Negative / tradeoffs**:
- More files than the PRD draft: `repositories/` with `unit_of_work.py`, `core/container.py`, `core/dependency.py`, `core/errors.py`, `core/scheduler.py`, `app/http/`, `controllers/presenter.py`, `tests/architecture/`.
- Two deployables for the backend (API and scheduler worker) instead of one.
- Simple reads still pass through route, controller, service, repository; some functions will be thin pass throughs.
- `core/` holds layers 1, 4, 5, 11, and 12, so its rules are written per module; adding a `core` module means placing it in the contract (the test enforces this).
- Two enforcement mechanisms (`import-linter` and the allowlist test) to keep in sync.

**Neutral**:
- Migrations stay as SQL in `supabase/migrations`; SQLAlchemy models mirror them by hand (no Alembic).
- Dev dependencies added: `import-linter`, `pytest-socket`, `fakeredis`, `pre-commit`.

## Follow-up

- [ ] Update PRD §7.3 so the layout matches this spec: add `repositories/` (with `unit_of_work.py`), `core/container.py`, `core/dependency.py`, `core/errors.py`, `core/scheduler.py`, `app/http/`, `controllers/presenter.py`, `tests/architecture/`; change `workflow/graph.py` to Validate inputs, LLM, Validate output.
- [ ] `/architect` the prediction batch pipeline: scheduler library and retries, pre kickoff refresh, a per job run lock (Redis or a Postgres advisory lock) so a second scheduler or overlapping deploy cannot double run, cache freshness after commit (versioned slate keys with the pointer set after warming, or delete on commit), LLM output validation and fallback, prompt injection defence on football API strings. This spec fixes only where those pieces live.
- [ ] `/architect` the core data model and RLS: include a UNIQUE `(fixture_id, slate_date)` on `fixture_reports` so pipeline writes are idempotent; the backend connects as a privileged role, so RLS does not guard backend reads; decide how the PRD's "RLS paywall integration test" applies.
- [ ] `/architect` paywall and access control: tier resolution, the locked and unlocked response variants `present(...)` returns, 2 device session cap, rate limit windows, JWKS caching and refresh.
- [ ] No `AGENTS.md` exists. Run `/audit` to bootstrap root `AGENTS.md` plus `backend/AGENTS.md`; the layer rules belong in `backend/AGENTS.md` `## Rules`, the installed skills in the `## Agent skills` section (project wide: `fastapi`, `pydantic`, `uv`, `supabase`, `supabase-postgres-best-practices`, `redis-core`, `redis-connections`; pipeline area: `langgraph-fundamentals`, `langfuse`, `openrouter-models`).
- [ ] The chosen SQLAlchemy skill `yonatangross/orchestkit@sqlalchemy-2-async` no longer exists under that name. Pick a replacement if you want one: `yonatangross/orchestkit@python-backend` (async Python, FastAPI deps, SQLAlchemy 2.0 async sessions) or `bobmatnyc/claude-mpm-skills@sqlalchemy` (general ORM).
- [ ] The installed `langgraph-fundamentals` skill reports itself as retired and points to `langchain-build-agent`. Consider swapping it before the pipeline spec (`npx skills add langchain-ai/langchain-skills -s langchain-build-agent`).
- [ ] Connect the chosen MCP servers yourself (MCP settings): Supabase (hosted, read only), Redis (`redis/mcp-redis` via `uvx`), LangFuse (hosted, project keys). Record them in the `AGENTS.md` `MCP servers:` line.
- [ ] No `docs/scope/` exists yet. Run `/scope` to plan the MVP slices from the PRD; the backend scaffold feature should link this spec.
