# SignalXI

Mobile first PWA for Nigerian football bettors: a risk filtering prediction slate (not a tipster). Product rules live in `signalxi_product_requirements_document.md`; read its §1 "Core Mental Model" before any design decision.

## Stack

Mirrors [spec _root 0001](docs/specs/_root/0001-stack-architecture/index.md) `## Proposed stack`, the source of truth.

- **Frontend / PWA**: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui; Zustand (client state) + TanStack Query (server state). Deployed on Vercel.
- **Backend API + scheduler worker**: FastAPI, Python 3.13, managed with `uv`; SQLAlchemy 2.0 async. Two deployables (API, scheduler).
- **Data**: Supabase (Postgres, Auth, RLS), migrations as SQL in `supabase/migrations`; Redis (cache, rate limits, device sessions).
- **AI pipeline**: LangGraph + OpenRouter, traced with LangFuse; football data from API-Football.
- **Package manager**: `uv` (backend); `pnpm` (frontend, Node 24).
- **Hosting**: Vercel (`fra1`) for the web app; Render Frankfurt for the API, the worker (one Docker image, `render.yaml`) and Key Value; Supabase `eu-central-1`.

## Build approach

Tracer Bullet (each slice runs end to end through every layer, real and narrow, then later slices thicken one strand at a time).

## Commands

```bash
# Backend (from backend/)
uv sync                      # install
uv run honcho start          # API (:8000) + scheduler worker, from Procfile; `honcho start api` for the API alone
uv run pytest tests/unit     # fast unit suite, sockets disabled
uv run lint-imports          # layer contracts (spec 0001)
uv run python -m scripts.export_openapi   # refresh openapi.json after an API change
# Frontend (from frontend/)
pnpm install && pnpm dev     # web on :3000
pnpm lint && pnpm typecheck && pnpm test   # ESLint, tsc, vitest
pnpm test:e2e                # Playwright against the running local stack
pnpm gen:api                 # regenerate src/types/api.gen.ts from backend/openapi.json
# Local services: `supabase start` (Postgres, Auth) and `docker compose up` (Redis only)
```

## Specs

Stored in `docs/specs/<area>/NNNN-slug/` (`index.md` decision, `rationale.md` reasoning).

## Rules

- Clean Architecture: dependencies only point downward/inward; business rules never import a web framework, ORM session, or HTTP client. Backend layering is fixed by spec 0001 (see `backend/AGENTS.md`).
- Deterministic first, LLM second: the LLM only interprets numbers the statistical engine computed. Live traffic never calls the LLM or the football API; it reads batch results from Redis/Supabase.
- Hard server side paywall: locked prediction data must never appear in any response payload for guests or free users.
- Strict types: TypeScript `strict`, no `any`; Python fully annotated, `mypy --strict`.
- Folders: frontend is folder by feature (`src/features/*`); backend is by layer per spec 0001.
- Env is read and validated at startup in exactly one place per app (`frontend/src/lib/env.ts`, `backend/app/core/config.py`); fail fast on missing values.
- One error pattern per side: backend raises `AppError` subclasses mapped to HTTP in `app.http`; frontend surfaces one consistent API error shape.
- Named exports only in TS (default exports only where Next.js requires them). Public APIs and services carry a short doc comment or docstring.
- UI meets WCAG AA, <2MB initial load, no heavy chart libraries in v1.0; show the 18+ and responsible gambling disclosure.
- Imports sit at the top of the file, never inside a function (ruff `PLC0415`). Frontend imports go through the `@/` alias, never `./` or `../` (ESLint `no-restricted-imports`).
- Comments stay minimal, about 2 to 3 lines per file: one line docstrings on public services and APIs, reasoning lives in specs, not code.
- Tests live in each app's `tests/<kind>/` folder (`unit`, `integration`, `e2e`, `architecture`), mirroring the source path; never colocated with source.
- Conventional commit messages (`feat:`, `fix:`, `chore:` and so on).

## Tooling

Installed by `/develop tooling`. Backend `ruff` + `mypy --strict`; frontend ESLint (Next config) + Prettier (Tailwind plugin). `pre-commit` runs lint, format, typecheck, `lint-imports`. Tests: `pytest` + `vitest` unit, integration on local Supabase + Redis, Playwright e2e (PRD §10.2). CI: GitHub Actions on push/PR (lint, typecheck, `lint-imports`, unit tests).

## Git

- integration: on (workflow creates `feat/` branches per feature)
- commit: manual. The engineer commits and opens PRs; the workflow drafts a commit message per milestone and the PR description, and never runs `git commit`, `git push`, or `gh pr create`.

## Agent skills

- [supabase](.claude/skills/supabase/): `supabase/agent-skills`, Supabase Auth, RLS, client libraries, CLI
- [supabase-postgres-best-practices](.claude/skills/supabase-postgres-best-practices/): `supabase/agent-skills`, schema, migrations, RLS policies, indexes
- [multi-stage-dockerfile](.claude/skills/multi-stage-dockerfile/): `github/awesome-copilot`, the shared API and worker Docker image
- [deploy-to-vercel](.claude/skills/deploy-to-vercel/): `vercel-labs/agent-skills`, Vercel deploys
- [github-actions](.claude/skills/github-actions/): `callstackincubator/agent-skills`, GitHub Actions workflows (targets React Native builds; spec _root 0001 wins where they differ)

MCP servers: Supabase (recommended, hosted, read only), Redis (recommended, `redis/mcp-redis` via `uvx`), LangFuse (recommended, hosted), Playwright (recommended, `npx @playwright/mcp@latest`, for `frontend/tests/e2e/`), Render (recommended, `https://mcp.render.com/mcp`), GitHub (recommended, read only toolsets)

Declined: render, api-football, structlog skills (weak candidates)

## Context files

- [backend/AGENTS.md](backend/AGENTS.md) (FastAPI layer map, wiring, transactions, testing contract)
- [frontend/AGENTS.md](frontend/AGENTS.md) (Next.js PWA structure, state split, thin routes)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
