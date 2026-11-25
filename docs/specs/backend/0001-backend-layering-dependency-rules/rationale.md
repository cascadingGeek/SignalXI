# 0001. Enforce strict downward layering in the backend: rationale

Decision record for [index.md](index.md). Read by humans and by `/architect` on update; `/develop` skips it.

## Context

SignalXI's backend (`backend/app`, FastAPI on Python 3.11+, managed by `uv`) serves a mobile PWA and runs scheduled batch jobs: a 06:00 WAT prediction slate, pre kickoff refreshes, and settlement every 2 hours. It touches four kinds of infrastructure: Supabase Postgres, Redis (slate cache, rate limits, device sessions), OpenRouter (LLM), and a football data API. The PRD requires that live traffic never calls the LLM or football API, that locked predictions never appear in a non premium payload, and that the statistical engine stays pure so its tests need no network.

The PRD sketches a folder layout and a dependency rule (`routes → controllers → services → models / tools / workflow`), but the sketch leaves gaps. The graph's Stats node needs `services/statistical_engine.py` while the rule puts workflow below services. `workers/` and `core/` are missing from the chain. Route auth dependencies in `core/security.py` would talk to Redis, which bends "routes never touch Redis". There is no data access layer, so service tests would need a database. Transaction ownership is unstated, yet webhook activation and report writes must be atomic.

The engineer set separation of concerns as the top priority: `routes/` holds route code only, `controllers/` holds one function per route, and `core/` hosts `errors.py`, `dependency.py`, `config.py`, and `scheduler.py` alongside the infrastructure clients.

The repo is empty (no source files), so whatever is chosen can be enforced from the first commit with zero migration cost. Left undecided, the first features would each invent their own wiring and the rule would erode before the first review.

## Options considered

### Option 1: PRD layout as written, enforced by `import-linter`

Keep the PRD folders and graph exactly, and add a layers contract for the stated chain.

**Pros**:
- No divergence from the PRD; least new structure.

**Cons**:
- The contract cannot pass as drawn: workflow must import a service, and routes must import a Redis touching module.
- Services query models directly, so service unit tests need a database.
- No transaction owner; partial webhook activation is possible.

### Option 2: Refined layer map, enforced by `import-linter`, an allowlist architecture test, and `pytest-socket` (chosen)

Close the gaps: service computes stats and saves after the graph; workers are an entry layer; add `repositories/` with a unit of work; `core.container` as composition root with `core.dependency` as thin FastAPI glue; per module tiers inside `core/`; direct import allowlists for routes, controllers, workers, and the engine; runtime socket blocking for unit tests.

**Pros**:
- Every rule is machine checkable and actually passable.
- Every layer is unit testable without network.
- Clear single owner for paywall (controllers), transactions (services), wiring (`core.dependency`).

**Cons**:
- More files and two enforcement tools to maintain.
- Thin pass through functions for simple reads.

### Option 3: Same layer map, documented only

Write the rules in `backend/AGENTS.md` and rely on review.

**Pros**:
- No tooling setup.

**Cons**:
- AI assisted builds and a small team drift quickly; a single convenience import from a route to Redis goes unnoticed until the paywall or the pure engine breaks.

## Rationale

Option 1 fails on its own terms: two of its rules contradict the layout, so it would ship with exceptions on day one. Option 3 has the right shape but no teeth, and this codebase will be built largely by agents following written specs, where a machine check is the only reliable guard.

Option 2 resolves each contradiction in the direction of stricter separation, which matches the engineer's stated priority. Moving stats computation and persistence out of the graph keeps `workflow/` a pure "verified numbers in, validated JSON out" step, which is exactly the PRD's deterministic first, LLM second principle. Putting the paywall only in controllers and all I/O only in services and below makes the PRD's two most dangerous failures (payload leakage and an impure engine) each testable at one layer. Running the scheduler as its own process avoids duplicate slate runs when the API scales, at the cost of a second deployable.

Two enforcement mechanisms are used because `import-linter` expresses direction and bans well but not allowlists; the small `grimp` based test covers the allowlists and the "new `core` module must be placed" check. `pytest-socket` is cheap insurance that a transitive import never opens a socket in a unit test.

### Engineer picks recorded during design

| Dimension | Pick | Runner up |
|---|---|---|
| How workflow gets stats | Service computes, graph receives | Pure tier importable by workflow |
| Workers | Entry layer, calls services | Calls a job controller |
| Data access | `repositories/` layer | Services query models |
| Auth and rate limit deps | Aliases in `core/dependency.py` delegating to services | `routes/deps.py` |
| Layer strictness | Downward with skips, routes hold route code only | Adjacent only |
| Engine purity | No I/O, stdlib plus numpy/scipy | Stdlib only |
| DB client | SQLAlchemy 2.0 async + asyncpg | `supabase-py` |
| Wiring | Constructor injection via composition root | Module singletons |
| Controllers | One async function per route | Class per domain |
| Enforcement | `import-linter` in CI and `pre-commit` | `pytest-archon` |
| Unit test guard | `pytest-socket` | Markers only |
| Errors | Domain exceptions in `core/errors.py`, mapped in `main.py` | Controllers convert |
| Same layer imports | Services only, acyclic | Never |
| Enums | `schemas/enums.py`, leaf tier pure | `knowledge/markets.py` |
| Transactions | Services own a unit of work | Per repository commit |
| `core/` placement | Two tiers by module | Move wiring to `app/wiring/` |
| Framework ban | No `fastapi`/`starlette` below controllers | Services only |
| Persistence of graph output | Service saves after graph | Save node in graph |
| Controller reach | Services and leaf tier only | Any lower layer |
| Scheduler process | Separate worker process | API lifespan |
| Unit test speed | No env, no I/O, under 5 s documented | CI time limit |

### Decisions made while writing (recommended, not asked)

- **Route type annotations** use `Annotated` aliases exported by `core.dependency` (`PredictionServiceDep`), so routes never import `app.services` even for types. Runner up: allow type only imports from services under `TYPE_CHECKING` (weaker, easy to misuse).
- **Repositories return ORM rows; services convert to schemas inside the unit of work.** Avoids async lazy load errors and keeps controllers schema only. Runner up: repositories return schemas (duplicates mapping per query).
- **Unit of work lives in `repositories/`**, not `core/database.py`, because it exposes repositories and foundation may not import upward. Runner up: generic session UoW in core with services constructing repositories (more wiring in every service).
- **Error `kind` enum, not HTTP codes, in `core/errors.py`**, keeping foundation HTTP free. Runner up: `status_code` on each exception (leaks HTTP downward).
- **Workers build their own services via `core.container` factories** from the `Clients` the scheduler passes in; the scheduler only owns the lifespan and the schedule. Runner up: scheduler builds and injects services (scheduler grows wiring logic).
- **Allowlist plus `pytest-socket` for the engine**, rather than a denylist, because an allowlist cannot miss a new network library. Runner up: `import-linter` forbidden list only.
- **`fakeredis` for service unit tests that use Redis**, keeping them socket free. Runner up: a hand rolled cache fake.
- **No Alembic**: SQL migrations in `supabase/migrations` stay the source of truth per the PRD layout; models mirror them. Runner up: Alembic autogenerate (two migration systems against one database).

### Cross check (same model, read only) and resolutions

A fresh read of the first draft found three rules that could not pass their own checks and ten decisions left for the builder to invent. The engineer chose to apply every recommended fix:

| Gap | Resolution |
|---|---|
| Workers imported `core.dependency`, which imports `fastapi`, breaking the framework ban | Split into `core.container` (framework free factories and `lifespan()`) and `core.dependency` (FastAPI aliases only); workers use the container |
| `SlateFiltersDep` in `app.schemas` needs `fastapi` | Request parameter aliases live in `core.dependency` |
| Foundation modules need `config` and `errors`, so they cannot be independent siblings | Two layers: `config \| errors` under `database \| redis \| telemetry \| security` |
| No client lifecycle for the scheduler process | `container.lifespan()` shared by `main.py` and the scheduler |
| Leaf tier order ambiguous | Three explicit layers; section to market mapping in `schemas/enums.py` |
| New top level packages (middleware) escape every contract | Every `app.*` module must map to a layer; middleware and the error handler live in `app/http/` |
| Allowlist semantics undefined | Govern `app.*` and third party; standard library exempt unless banned; `TYPE_CHECKING` counts |
| How nodes get the LLM tool and tracer | `build_graph(llm, tracer)` called by the container |
| Transactions spanning services | One unit of work per top level call; pass `uow` down; no nesting |
| JWKS fetch is network I/O in foundation | `core.security` verifies against given keys; an auth service fetches and caches them |
| Engine clock and randomness not machine checked | AST bans on `os`, `time`, `random`, `datetime.now`, unseeded `numpy.random` |
| Async lazy loads by convention only | `lazy="raise"` on every relationship |
| Paywall relies on each controller remembering | Only `controllers/presenter.py` may build public responses; guest sweep integration test |

Also corrected: the "cannot double run" claim (only API replicas are covered; a per job lock is a pipeline follow up), and the residual risk of runtime access that static checks cannot see is now stated. The reviewer suggested moving wiring out of `core/` into `app/wiring/` as simpler; not adopted, because the engineer chose to keep wiring in `core/`, and the container and dependency split removes the concrete problem inside it.
