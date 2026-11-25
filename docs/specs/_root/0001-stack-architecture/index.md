# 0001. Adopt a Vercel Next.js PWA with a Render FastAPI monolith in Frankfurt

**Date**: 2026-11-24
**Status**: Accepted

## Summary

This spec records the whole SignalXI stack in one place. The web app is a Next.js 16 PWA on Vercel. The backend is one FastAPI codebase that runs as two processes on Render in Frankfurt: an API and a scheduler worker. Supabase (database and auth) and Redis sit in the same city, so every backend query stays fast. The frontend gets its API types generated from the backend's OpenAPI schema (the machine readable description of every endpoint), so the two sides cannot silently drift apart. Scaffolding only installs what the first slice needs; each later feature adds its own libraries when it is built.

## Decision

**Chosen option**: Option 1: Vercel PWA + Render FastAPI monolith (API and worker) colocated with Supabase and Redis in Frankfurt.

One layered FastAPI monolith (per [backend spec 0001](../../backend/0001-backend-layering-dependency-rules/index.md)) deployed as two Render services from one Docker image, a Next.js 16 PWA on Vercel that calls it directly on an API subdomain, Supabase Postgres and Auth in `eu-central-1`, and Render's own Redis on the private network, all in Frankfurt.

**Implementation skills**: `nextjs-app-router-patterns` (`wshobson/agents`, `.claude/skills/nextjs-app-router-patterns/`) · `vercel-react-best-practices` (`vercel-labs/agent-skills`, `.claude/skills/vercel-react-best-practices/`) · `shadcn` (`shadcn-ui/ui`, `.claude/skills/shadcn/`) · `tailwind-design-system` (`wshobson/agents`, `.claude/skills/tailwind-design-system/`) · `tanstack-query` (`tanstack-skills/tanstack-skills`, `.claude/skills/tanstack-query/`) · `fastapi` (`fastapi/fastapi`, `.claude/skills/fastapi/`) · `pydantic` (`pydantic/skills`, `.claude/skills/pydantic/`) · `uv` (`astral-sh/agent-plugins`, `.claude/skills/uv/`) · `supabase` (`supabase/agent-skills`, `.claude/skills/supabase/`) · `redis-connections` (`redis/agent-skills`, `.claude/skills/redis-connections/`) · `multi-stage-dockerfile` (`github/awesome-copilot`, `.claude/skills/multi-stage-dockerfile/`) · `zod` (`pproenca/dot-skills`, `.claude/skills/zod/`) · `deploy-to-vercel` (`vercel-labs/agent-skills`, `.claude/skills/deploy-to-vercel/`)

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Proposed stack

| Layer | Choice | Reason |
|---|---|---|
| Architecture pattern | Layered monolith, two processes (API, scheduler worker), rules in backend spec 0001 | One engineer, one deployable codebase; the worker split keeps batch jobs off the request path. |
| Repo shape | Plain folders, no monorepo tool: `frontend/`, `backend/`, `supabase/`, `e2e/`, root `docker-compose.yml` and `.github/workflows/` | Only one JS app; a workspace tool adds config and saves nothing. |
| Frontend language / runtime | TypeScript (strict), Node 24 LTS | Mature LTS, supported on Vercel and CI images. |
| Frontend framework | Next.js 16 App Router, React 19 | SSR for indexable public pages, server components keep the bundle small. |
| Styling / UI kit | Tailwind CSS v4, shadcn/ui (`new-york` style) | The setup shadcn uses for new projects; primitives are copied in, no runtime UI library. |
| Client state / server state | Zustand / TanStack Query | Per PRD §6 and `frontend/AGENTS.md`: UI state only in Zustand, all server data in Query. |
| Frontend package manager | pnpm | Fast, strict about undeclared dependencies, supported by Vercel and shadcn. |
| Frontend validation | Zod (env in `lib/env.ts`, forms) | Standard with shadcn forms; import only where used to protect the bundle. |
| API contract | FastAPI OpenAPI schema → `openapi-typescript` types + `openapi-fetch` client, generated into `frontend/src/types/api.gen.ts`; CI fails on drift | Pydantic stays the single source of truth; zero runtime weight. |
| Backend language / runtime | Python 3.13, managed with `uv` | Every backend dependency ships wheels for it; inside its support window. |
| Backend framework | FastAPI + uvicorn, Pydantic v2, `pydantic-settings` | Per PRD §6 and backend spec 0001. |
| Primary DB | Supabase Postgres, `eu-central-1` (Frankfurt), SQL migrations in `supabase/migrations` | Relational data with RLS; colocated with the API. |
| DB access | SQLAlchemy 2.0 async + asyncpg via Supavisor **session mode** (port 5432, user `postgres.<project-ref>`, SSL required); pool budget API `pool_size=5, max_overflow=2`, worker `pool_size=3`, `pool_pre_ping=True`, 15 s statement timeout | Long running processes; session mode keeps asyncpg prepared statements working and is reachable over IPv4. About 10 connections in total, well under the plan cap. |
| Auth | Supabase Auth with asymmetric signing keys; frontend via `@supabase/ssr`; the API accepts a Bearer token only (see *Auth contract*) | Reuse the platform already in the stack; never build auth. |
| Cache, rate limits, sessions | Render Key Value (paid, persistent) in Frankfurt, private network, `redis.asyncio`, `maxmemory-policy volatile-lru` (only keys with a TTL can be evicted, so session keys without one never are) | Lowest latency, flat price for a per request workload. |
| Background jobs | In process scheduler inside the worker service (`python -m app.core.scheduler`), guarded from day one by a process level run lock (Postgres advisory lock); the scheduler library and per job locks are chosen in the pipeline orchestration spec | Matches backend spec 0001; a Render deploy can briefly overlap two workers. |
| HTTP client (outbound) | `httpx` (async), injected into `app/tools/*` adapters | One client for football, LLM, and payment APIs; easy to fake in tests. |
| Football data | API-Football (api-sports.io v3), paid tier for production | Has injuries, lineups, and half time scores across every MVP competition. |
| LLM | OpenRouter, orchestrated by LangGraph | Per PRD §6. Model routing and output validation are owned by the LLM fixture analysis spec. |
| Payments | Paystack only for MVP | Covers cards, bank transfer, USSD, and wallets; one webhook format. Flutterwave deferred. |
| Frontend hosting | Vercel, production on `main`, functions pinned to `fra1` (Frankfurt) in `vercel.json`; preview deployments per branch are UI only and have no API access | Native Next.js host; `fra1` keeps server rendering next to the API instead of detouring through the default US region. |
| Backend hosting | Render, Frankfurt, paid always on instances: web service (API, at least 1GB) and background worker (at least 1GB for numpy, scipy, LangGraph), both from one `uv` based Dockerfile, declared in a committed `render.yaml`; deploy only after CI checks pass on `main` | Native worker type, no sleeping instances, region and services reproducible from the repo. |
| API access | Public API on a separate subdomain (`api.<domain>`); server components call it only for public guest views, the browser calls it with a Bearer token for everything signed in | No extra hop through Vercel functions; signed in data is never server rendered or shared cached. |
| Environments | Local (Supabase CLI + compose Redis) and production only. Vercel previews are UI only (no production CORS entry); real API testing happens locally | Cheapest setup for one engineer, and branch code never touches production data or user tokens. |
| Local dev | `supabase start` for Postgres and Auth, `docker compose up` (Redis only, `valkey/valkey:8` to match Render Key Value), API, worker, and Next.js run natively | Fast reloads; integration tests use the same setup. |
| Logging | `structlog`, JSON in production, console locally; request id and job run id bound to every line | Structured, readable in Render logs, easy to ship later. |
| LLM observability | LangFuse | Per PRD §6. |
| Testing | `pytest` (+ `pytest-socket`, `fakeredis`), `vitest`, Playwright in `e2e/` | Per root `AGENTS.md` tooling. |
| CI | GitHub Actions | Per root `AGENTS.md` tooling. |

**Deferred to their own feature specs** (named here so nobody picks them during scaffold): scheduler library and run lock (pipeline orchestration), LLM model routing and output validation (LLM fixture analysis), PWA service worker library (PWA install & offline), product analytics and error monitoring (funnel analytics & error monitoring), consent tooling (legal, age notice & consent), alerting channel (pipeline health alerts).

### Topology

```
Browser (PWA) ──▶ Vercel (Next.js SSR + static) ──▶ api.<domain> (Render web, Frankfurt)
      │                                                   │
      └── Supabase Auth (sign in) ──────────┐             ├─▶ Supabase Postgres (session pooler, Frankfurt)
                                            │             └─▶ Render Key Value / Redis (private, Frankfurt)
                                            ▼
                    Render worker (scheduler, same image) ─▶ API-Football · OpenRouter · LangFuse
                                                         ─▶ Postgres (write) ─▶ Redis (warm)
```

### Auth contract

- The API reads only `Authorization: Bearer <supabase access token>`. No cookies cross to the API; the frontend calls it with `credentials: "omit"`. `lib/api.ts` attaches the token from the Supabase client session.
- JWKS from `<SUPABASE_URL>/auth/v1/.well-known/jwks.json`, fetched by a service with `httpx` (backend spec 0001: `core.security` only verifies against keys passed in), cached in memory for 10 minutes, refetched once on an unknown `kid`.
- Accept only ES256 or RS256; require `aud = authenticated` and `iss = <SUPABASE_URL>/auth/v1`; 30 s clock leeway. Any failure yields a guest viewer for public routes and 401 for signed in routes.
- CORS (Starlette `CORSMiddleware`): `allow_origins` is an exact list from `CORS_ALLOWED_ORIGINS` (comma separated, no wildcard, no regex), `allow_credentials=False`, `allow_headers=["Authorization", "Content-Type"]`, `max_age=600`.
- Sign in methods and redirect URLs are owned by the accounts & sign in spec.

### Scaffold contract

The scaffold (this feature's `/develop` step) installs only the runnable skeleton, and proves each integration with one smoke test.

- **Install list.** Frontend: `next`, `react`, `react-dom`, `tailwindcss`, shadcn init (`new-york`), `@tanstack/react-query`, `zustand`, `zod`, `@supabase/ssr`, `@supabase/supabase-js`, `openapi-fetch`, dev: `openapi-typescript`, `vitest`, ESLint, Prettier. Backend: `fastapi`, `uvicorn[standard]`, `pydantic-settings`, `sqlalchemy[asyncio]`, `asyncpg`, `redis`, `httpx`, `structlog`, `numpy`, `scipy`, dev: `pytest`, `pytest-asyncio`, `pytest-socket`, `fakeredis`, `import-linter`, `ruff`, `mypy`. `e2e/`: `@playwright/test`. Later features install their own (LangGraph, LangFuse, Paystack adapter, API-Football adapter, PWA, analytics).
- **Frontend shape.** `create-next-app` defaults with `src/`, the `@/*` import alias, Turbopack, ESLint flat config, Prettier with the Tailwind plugin, Vitest on `jsdom`. Default output mode (not standalone).
- **Backend shape.** Every layer package from backend spec 0001 exists from the start (empty `__init__.py`, `core/__init__.py` empty), so the `import-linter` contracts and the architecture test pass with zero violations.
- **Processes.** API: `uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips="*"` (one worker per instance; scale by instances). Worker: `python -m app.core.scheduler`. Both handle SIGTERM with a graceful shutdown. Local API port 8000, web port 3000.
- **Health.** `GET /healthz` returns 200 when the process is up (no I/O), used by Render. `GET /readyz` checks Postgres and Redis and returns 503 if either fails.
- **Pinning.** `backend/.python-version` (3.13) and `requires-python = ">=3.13,<3.14"`; ruff, mypy target `py313`. `frontend/package.json` `packageManager` (pnpm) and `engines.node` (24.x). Supabase CLI version pinned in CI. Postgres major follows the Supabase project default at creation and is recorded in `supabase/config.toml`.
- **API types.** `backend/scripts/export_openapi.py` imports `app.main` with test settings (no DB or Redis) and writes `backend/openapi.json` (committed, with deterministic `operationId`s from route names). `pnpm gen:api` writes `frontend/src/types/api.gen.ts`. CI regenerates both and fails on `git diff --exit-code`.
- **Files committed.** `render.yaml`, `frontend/vercel.json` (`regions: ["fra1"]`), `docker-compose.yml`, `backend/.env.example`, `frontend/.env.example`; `.env*` files other than examples are gitignored. Local Supabase keys come from `supabase status`.
- **CI** (GitHub Actions): `backend.yml` (ruff, mypy, `lint-imports`, unit tests, OpenAPI drift), `frontend.yml` (ESLint, Prettier check, `tsc`, vitest, API types drift), `e2e.yml` (Playwright against local Supabase and Redis, on PRs). The first two are required checks on `main`; Render and Vercel deploy only after they pass.
- **Migrations.** Applied to production by hand with `supabase db push` before the Render deploy that needs them, written expand then contract (old and new code both work during the change).
- **Run lock.** The scheduler takes a Postgres advisory lock at startup; a second worker waits instead of running jobs.
- **Acceptance.** All backend dependencies install and import on Python 3.13; both apps build; `/readyz` is green locally against `supabase start` and compose Redis; CI is green on the first commit.

### Configuration required

Backend (`backend/app/core/config.py`, the only env reader; one `Settings` shared by API and worker, fail fast in both; the worker ignores CORS):
- `APP_ENV`: `local` or `production`
- `DATABASE_URL`: `postgresql+asyncpg://` Supavisor session mode string (port 5432; local: direct port 54322)
- `REDIS_URL`: Render Key Value internal URL (local: compose Redis)
- `SUPABASE_URL`: project URL, the JWKS and issuer base
- `CORS_ALLOWED_ORIGINS`: comma separated exact origins (production web origin; local `http://localhost:3000`)
- `API_FOOTBALL_KEY`, `OPENROUTER_API_KEY`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST`, `PAYSTACK_SECRET_KEY`: added by the feature that first uses each, not at scaffold. Production uses Paystack live keys only; webhooks are tested locally through a tunnel with test keys.

Frontend (`frontend/src/lib/env.ts`, validated with Zod at build time and on server start):
- `NEXT_PUBLIC_SITE_URL`: the web origin (canonical URLs, manifest, social cards)
- `NEXT_PUBLIC_API_BASE_URL`: the API subdomain, used by server and browser (local: `http://localhost:8000`). Unset in Vercel Preview, so previews render without API data.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase client (Production only in Vercel)
- `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`: added by the checkout feature

## Consequences

**Positive**:
- Every backend query and cache call stays inside Frankfurt, so request latency is dominated only by the Lagos to Europe hop.
- One Docker image runs the API, the worker, CI, and local integration tests the same way.
- Generated API types turn a backend schema change into a frontend type error instead of a runtime bug.
- No tool from a later feature leaks into the scaffold.

**Negative / tradeoffs**:
- No hosting region in Africa: users pay a Lagos to Frankfurt round trip (roughly 100 to 150 ms) on every uncached request. Vercel's edge only helps static assets and the SSR shell.
- Two vendors for compute (Vercel and Render) plus Supabase: three dashboards, three sets of secrets.
- Vercel previews are UI only: anything that needs real data is tested locally, and there is no shared staging environment.
- Session mode pooling caps total connections, so pools stay small. If instance count grows, the alternative is transaction mode (port 6543) with asyncpg's statement caches turned off (`statement_cache_size=0` and SQLAlchemy's `prepared_statement_cache_size=0`).
- Paid always on instances for the API, worker, and Key Value cost money even on quiet days.
- Migrations are applied by hand, so a forgotten `supabase db push` breaks a deploy; expand then contract limits the damage.

**Neutral**:
- `backend/AGENTS.md` and `frontend/AGENTS.md` gain the concrete versions and commands once the scaffold exists (`/sync`).
- The root `AGENTS.md` `## Stack` section should be updated to mirror this spec (`/sync`).

## Follow-up

- [ ] `/sync` after the scaffold: mirror `## Proposed stack` into root `AGENTS.md` `## Stack` (Python 3.13 not 3.11+, Render decided, compose is Redis only), fill in pnpm and the real commands, and set `## Build approach` to Tracer Bullet; update `backend/AGENTS.md` the same way.
- [ ] Measure latency from Lagos to Supabase `eu-central-1` versus `eu-west-2` once the project exists; switching regions later means a migration, so check before real data lands.
- [ ] Pick a domain before production deploy (not needed for the local scaffold): `api.<domain>`, CORS, Supabase redirect URLs, and the Paystack webhook URL depend on it.
- [ ] `/sync`: record the new skills in `AGENTS.md` `## Agent skills` (`multi-stage-dockerfile`, `github-actions`, `deploy-to-vercel` at root; `zod`, `openapi-to-typescript` in `frontend/AGENTS.md`), MCP servers Render and GitHub (recommended), and `Declined:` render, api-football, structlog skills (weak candidates).
- [ ] Installed `github-actions` skill targets React Native mobile builds, and `openapi-to-typescript` writes types by hand instead of running the `openapi-typescript` tool. Neither should override this spec; consider removing them.
- [ ] Connect the Render MCP (`https://mcp.render.com/mcp`, OAuth) and the GitHub MCP (read only toolsets) yourself in your MCP settings.
- [ ] PWA spec: clear the cached slate on sign out and on any tier change, so an expired user keeps no premium data offline.
- [ ] Choose an API-Football paid tier before the ingestion feature: the free tier is 100 requests a day.
- [ ] `langgraph-fundamentals` is retired upstream; consider `langchain-build-agent` before the LLM fixture analysis spec.
