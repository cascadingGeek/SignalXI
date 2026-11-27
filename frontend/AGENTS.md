# Frontend

## Overview

Next.js App Router PWA (TypeScript, Tailwind, shadcn/ui), mobile first for mid range Android on 3G/4G. It shows the daily slate, fixture drawer with market tabs (`Main`, `Goals`, `Half`, `Specials`), the performance ledger, and billing. Structure comes from PRD §7.2.

## Key files

| File | Owns |
|---|---|
| `src/app/` | Thin routes and providers only, grouped `(public)`, `(auth)`, `(dashboard)` |
| `src/features/<name>/` | Domain modules: `<name>.types.ts`, `.api.ts`, `.keys.ts`, `.queries.ts` + UI |
| `src/components/ui/` | shadcn/ui primitives, domain free |
| `src/lib/env.ts` | Validated env vars, the only env reader |
| `src/lib/api.ts` | Fetch wrapper that attaches the Supabase JWT |
| `src/lib/query-client.ts` | TanStack Query client and defaults |
| `src/store/` | Zustand client only state (filters, active tab, drawer open) |
| `public/` | `manifest.json`, service worker, icons |
| `src/lib/api-error.ts` | `ApiError`, the one shape every API failure surfaces as |
| `src/types/api.gen.ts` | Generated from `backend/openapi.json` by `pnpm gen:api`; never edit by hand |
| `tests/unit/`, `tests/e2e/`, `tests/architecture/` | Vitest (`pnpm test`, includes the architecture guards) and Playwright (`pnpm test:e2e`, config in `playwright.config.ts`) |
| `design.md` | Design system: type, both palettes, contrast rules, badges, ad inventory, states |
| `src/app/globals.css` | Colour tokens for Light (`:root`) and Midnight (`.dark`), mapped onto shadcn variables |
| `src/lib/error-copy.ts` | The one copy map for every API error kind plus `offline` |
| `src/app/dev/ui/` | Preview of every shared part in both themes; served only when `NEXT_PUBLIC_APP_ENV` is not production |

## Conventions

- Route files in `src/app/` stay thin: compose layouts and feature components, no API calls or business logic.
- Server data lives only in TanStack Query; Zustand never holds predictions, fixtures, or the user profile.
- `src/components/`, `src/lib/`, `src/hooks/`, `src/utils/` carry zero domain knowledge; domain code lives in `src/features/`.
- `src/types/` only for types shared by 2 or more features. Feature folders start flat; no empty subfolders in anticipation.
- Third party SDKs (Supabase, Paystack, Sentry) are wrapped in `src/services/`.
- Named exports only, except files Next.js requires to default export.
- Times shown in WAT (`formatWatTime`), money in Naira (`formatNaira`).
- Design system: build all UI to `design.md` (art direction and the maximalist product bar); token values live in CSS.
- Colours come only from tokens: `tests/architecture/colour-literals.test.ts` bans colour literals in `src/app`, `src/components` and `src/features` (except `globals.css`, `global-error.tsx`, `layout.tsx`).
- Theme is next-themes on the `<html>` class, Midnight (`dark`) by default with the OS ignored, stored under `sx-theme`.
- `AdSlot` renders only when `NEXT_PUBLIC_ADS_ENABLED` is true and never for premium; pass `placement` when a page has several slots.

## Gotchas

- `next.config.ts` imports `src/lib/env.ts`, so a bad env value fails `next build`. Vercel Preview leaves `NEXT_PUBLIC_API_BASE_URL` unset; the API client then throws a 503 `ApiError` instead of calling out.
- The paywall is server side: never fetch locked data and hide it in the UI. Locked items arrive as placeholders.
- The size budget e2e (`budget.spec.ts`) runs only with `E2E_BUDGET=1` against `pnpm build && pnpm start`, not `pnpm dev`.
- Offline: the service worker caches the app shell and the last fetched slate; keep the initial load under 2MB, no heavy chart libraries.

## Agent skills

- [nextjs-app-router-patterns](../.claude/skills/nextjs-app-router-patterns/): `wshobson/agents`, App Router, Server Components, data fetching
- [vercel-react-best-practices](../.claude/skills/vercel-react-best-practices/): `vercel-labs/agent-skills`, React and Next.js performance rules
- [shadcn](../.claude/skills/shadcn/): `shadcn-ui/ui`, adding, styling, and composing shadcn/ui components
- [tailwind-design-system](../.claude/skills/tailwind-design-system/): `wshobson/agents`, Tailwind v4 tokens and design system
- [tanstack-query](../.claude/skills/tanstack-query/): `tanstack-skills/tanstack-skills`, server state, query keys, caching
- [zustand-patterns](../.claude/skills/zustand-patterns/): `yonatangross/orchestkit`, Zustand 5 slices, selectors, `useShallow` (client only UI state)
- [vitest](../.claude/skills/vitest/): `antfu/skills`, unit tests, mocking, coverage
- [pwa-development](../.claude/skills/pwa-development/): `alinaqi/maggy`, manifest, service worker, offline caching (community, review before relying on it)
- [zod](../.claude/skills/zod/): `pproenca/dot-skills`, schema validation for env and forms
- [openapi-to-typescript](../.claude/skills/openapi-to-typescript/): `softaworks/agent-toolkit`, OpenAPI types (writes them by hand; this project generates them with `pnpm gen:api`, which wins)

MCP servers: shadcn (recommended, `shadcn@latest mcp init --client claude`), Next.js DevTools (recommended, needs Next.js 16+), Vercel (recommended, hosted OAuth)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
