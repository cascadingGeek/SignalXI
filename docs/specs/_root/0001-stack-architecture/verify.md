# Verify: Stack & architecture · spec 0001 · updated 2026-11-25
_Steps derived from spec 0001's scaffold contract acceptance (`### Scaffold contract`, **Acceptance**). `/check verify` runs these; `/test` locks the durable ones._

The spec has no numbered `AC-N`, so the acceptance clauses are labelled here:
AC-1 all backend dependencies install and import on Python 3.13 · AC-2 both apps build · AC-3 `/readyz` green locally against `supabase start` and compose Redis · AC-4 CI green on the first commit · AC-5 layer contracts and the architecture test pass with zero violations · AC-6 health endpoints and processes behave per the contract.

## Commands
- [x] `cd backend && uv sync --locked && uv run python -c "import fastapi, sqlalchemy, asyncpg, redis, httpx, structlog, numpy, scipy"` → exits 0 on Python 3.13 → AC-1
- [x] `cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy` → all clean → AC-1, AC-4
- [x] `cd backend && uv run lint-imports` → `Contracts: 9 kept, 0 broken.` → AC-5
- [x] `cd backend && uv run pytest tests/unit tests/architecture` → all pass in under 5 s (one engine test skips until the engine exists) → AC-5
- [x] Add `import redis` to `app/routes/health.py`, then run `uv run lint-imports` and the architecture test → both fail and name the import. Revert the change afterwards → AC-5
- [x] `cd frontend && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build` → all pass, `/` prerenders as static → AC-2
- [x] `NEXT_PUBLIC_SITE_URL=nope pnpm build` → fails early with `Invalid environment variables … NEXT_PUBLIC_SITE_URL` → AC-2 (fail fast env)
- [x] `cd backend && uv run python -m scripts.export_openapi && git diff --exit-code openapi.json`, then `cd frontend && pnpm gen:api && git diff --exit-code src/types/api.gen.ts` → no diff → AC-4 (drift checks)
- [ ] Skipped (no Docker on the dev machine): `supabase start && docker compose up -d`, then `curl -i localhost:8000/readyz` → `200 {"status":"ready","postgres":"ok","redis":"ok"}` → AC-3
- [ ] First push of `feat/stack-architecture`: the `backend` and `frontend` workflows go green on GitHub Actions → AC-4
- [ ] Skipped (needs Docker in CI only, which GitHub runners have): the `e2e` workflow on the first PR → AC-3

## UI / manual
- [x] `uv run uvicorn app.main:app --port 8000`, then `curl -i -H 'Origin: http://localhost:3000' localhost:8000/healthz` → `200 {"status":"ok"}` with `x-request-id` and `access-control-allow-origin: http://localhost:3000` → AC-6
- [x] With Postgres down: `curl -i localhost:8000/readyz` → `503 {"error":{"kind":"unavailable","message":"unavailable: postgres"},"request_id":"…"}` → AC-6
- [x] Ctrl+C on the API → `Application shutdown complete` (graceful) → AC-6
- [x] `uv run python -m app.core.scheduler` with Postgres down → logs `scheduler_waiting_for_run_lock`, then exits 1 with `ConnectionRefusedError` (Render restarts it) → AC-6
- [x] `pnpm dev`, open `http://localhost:3000` → the SignalXI heading and the 18+ notice render → AC-2

## Value sourcing
- [x] `CORS_ALLOWED_ORIGINS="*"` or a trailing slash → settings refuse to load (unit test `tests/unit/core/test_config.py`) → AC-6
- [x] `DATABASE_URL` without `+asyncpg` → settings refuse to load → AC-1
- [x] `NEXT_PUBLIC_API_BASE_URL` unset (Vercel Preview) → the app builds and the API client returns a 503 `ApiError` instead of calling out (unit test `src/lib/env.test.ts`) → AC-2

## Acceptance-criteria coverage
- AC-1 covered by the uv sync and import commands · AC-2 by the frontend checks, the build, and the dev server · AC-3 skipped (no Docker locally; e2e on the first PR) · AC-4 by the drift checks, with the first push pending · AC-5 by `lint-imports`, the architecture test, and the negative check · AC-6 by the health, readiness, shutdown, and scheduler checks
