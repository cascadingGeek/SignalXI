# SignalXI

**Football intelligence for Nigerian bettors. SignalXI filters risk instead of selling tips.**

SignalXI is a mobile first web app (a PWA, a website you can install on your phone like an app) that gives you a daily slate of football predictions. Every pick is labelled by how risky it is, matches worth avoiding are flagged with the reason why, and every published pick is graded in public after the final whistle, so you can see exactly how accurate it has been.

> **18+ only.** SignalXI is informational sports analytics. Predictions and slip audits are statistical analysis, not guaranteed outcomes. SignalXI does not take bets, hold money, or run betting pools. Please bet responsibly.

---

## Contents

- [Why SignalXI exists](#why-signalxi-exists)
- [Who it is for](#who-it-is-for)
- [What it does](#what-it-does)
- [How you use it](#how-you-use-it)
- [Plans and pricing](#plans-and-pricing)
- [How the predictions are made](#how-the-predictions-are-made)
- [Principles](#principles)
- [Stack and tools](#stack-and-tools)
- [Repository layout](#repository-layout)
- [Running it locally](#running-it-locally)
- [Project status and roadmap](#project-status-and-roadmap)
- [Contributing](#contributing)

---

## Why SignalXI exists

Nigerian bettors (mostly on SportyBet, Bet9ja, 1xBet and Paripesa) are surrounded by Telegram tipsters, fake win rate screenshots and long accumulators that look tempting and rarely land. Global prediction sites are cluttered, push one low odds pick (like a straight home win at 1.20), don't show an honest record of past accuracy, and never warn you which games to stay away from.

SignalXI takes the opposite approach. It does not promise winners. It helps you **avoid bad bets**: it points you to lower variance markets, flags trap fixtures, and checks your own bet slip for weak legs before you stake.

## Who it is for

Football bettors in Nigeria, roughly 18 to 35, staking about ₦500 to ₦20,000 a week, mostly on mid range Android phones over 3G or 4G. They want:

- a short, structured daily slate instead of a flood of tips
- safer alternatives laid out the way their bookmaker lays out markets
- a clear answer to "which games should I avoid, and why?"
- a trusted "third eye" to review their own slip before they place it
- proof, not screenshots, of how accurate the picks have really been

## What it does

### 1. The daily slate
One card per match, showing a single **primary prediction** (the pick the model is most confident in), its risk label, and a hint like "+5 alternative markets". You can filter by date, competition and risk label. All kickoff times are in WAT.

Competitions covered grow in three phases: first the Big Five leagues, the EFL Championship, the Eredivisie, the three UEFA club competitions and international football (AFCON, World Cup qualifiers, Nations League and major tournaments); then midweek and summer leagues (Portugal, Turkey, Scotland, Belgium, Scandinavia, second tiers, Saudi Arabia, Brazil, MLS, Libertadores, domestic cups); then African football (CAF club cups, NPFL and other African leagues). A competition only appears once its data passes a quality check and its picks have been graded privately for four weeks. See [spec 0004](docs/specs/_root/0004-competition-coverage-rollout/index.md).

### 2. Risk labels
Every match, and every pick inside it, gets one of four labels:

| Label | Colour | Meaning |
|---|---|---|
| **Strong Candidate** | Green | Strong statistical alignment, stable form, low variance |
| **Moderate Candidate** | Amber | A reasonable edge, but real unknowns remain |
| **High Risk (Avoid)** | Red | High upset chance, mixed signals, or a trap game. Always comes with a "Why Avoid" note |
| **Insufficient Data** | Gray | Missing line ups, newly promoted teams, or stale data. SignalXI declines to call it |

Labels never rely on colour alone, and meet WCAG AA contrast in both themes.

### 3. Match detail and market tabs
Tap a match to open a drawer with bookmaker style tabs: **All, Main, Goals, Half, Specials**. Each tab shows one or two alternative picks with their own label and two or three short, data backed reasons. For High Risk games, the "Why Avoid" warning sits at the top before anything else.

Markets are deliberately limited to high signal ones, for example Double Chance, Draw No Bet, Over 1.5 goals, Both Teams To Score, half time markets, and combos like "Home Win and Over 1.5". Noisy lottery markets (corners by minute, throw ins, player props) are left out on purpose.

### 4. Slip Audit (premium)
Upload one to three screenshots of your bet slip, or paste your picks as text, and SignalXI reviews every leg. The result looks like a real bet slip:

- a ticket header with leg count, combined odds, a slip health warning (too many legs, filler odds of 1.15 or lower, coin flip risk) and your remaining audits for the day
- one row per leg with a verdict: **Keep**, **Keep (Value)**, **Cautious**, **Drop**, or **Drop (No Value)**, plus a short risk note
- a **trimmed slip** with only the legs worth keeping and the new combined odds

Screenshots are processed in memory and never stored. Past audits are kept as a history list.

### 5. Public performance ledger
A public record of every published pick, graded automatically after each match as **WON**, **LOST** or **VOID**. The headline 30 day accuracy rate counts only the primary pick for each match (so nobody can cherry pick the alternatives), broken down by risk label. A second tab shows how each market section performed.

### 6. Installable and light
Add SignalXI to your home screen on Android or iOS. It opens offline to the last slate you loaded, and the first load stays under 2MB so it works on slow networks. It opens in a dark theme (Midnight) by default, with a light theme one tap away.

## How you use it

1. **Open SignalXI** on your phone. As a guest you see two or three full prediction cards free (including at least one High Risk warning), with the rest of the slate shown as locked cards.
2. **Scan the slate.** Look at the primary pick and its label for each match. Skip anything marked High Risk (Avoid) or Insufficient Data.
3. **Tap a match** to see safer or higher value alternatives in the Main, Goals, Half and Specials tabs, each with its reasons.
4. **Create a free account** (no card needed) to save your favourite competitions.
5. **Upgrade** to a Weekend Pass or Monthly Pro to unlock the full slate, every "Why Avoid" note, the full ledger history, and Slip Audits.
6. **Before you stake, audit your slip.** Upload a screenshot or paste your picks, see which legs to keep or cut, and use the trimmed slip.
7. **Check the ledger** any time to see how past picks actually did.

## Plans and pricing

| Plan | Price (NGN) | What you get |
|---|---|---|
| **Guest** | Free | 2 to 3 full prediction cards per slate (including a High Risk warning), locked placeholders for the rest, a sample Slip Audit |
| **Free member** | Free | Same as guest, plus saved competitions and checkout |
| **Weekend Pass** | ₦500 to ₦1,000 for 72 hours | Full slates, all market tabs, all "Why Avoid" notes, full ledger, 1 Slip Audit a day |
| **Monthly Pro** | ₦3,500 to ₦5,000 for 30 days | Everything in Weekend Pass, with 3 Slip Audits a day |

Each Slip Audit takes up to 3 screenshots (or a text paste) and up to 15 legs. Payment is through Paystack: bank transfer, USSD, wallets and debit cards. Signing up and paying are separate steps.

## How the predictions are made

SignalXI is **deterministic first, LLM second**: plain statistics produce the numbers, and an AI model only explains them.

1. **Collect data** (every day at 06:00 WAT): fixtures, form, home and away splits, half by half scoring, and injuries from a football data API.
2. **Compute the numbers**: a pure Python statistical engine (Poisson goal models, form weighting, anomaly checks) produces the probabilities.
3. **Interpret them**: one LLM call per match reads only those verified numbers and assigns risk labels, fills the market tabs and writes the short reasons. It never invents statistics.
4. **Validate and publish**: anything that fails strict schema checks (an unknown market, a High Risk pick with no "Why Avoid" note) is rejected. Good results are saved and cached.
5. **Refresh**: picks are refreshed about 90 minutes before major kickoff windows so late team news counts.
6. **Grade**: every 2 hours a settlement job reads half time and full time scores and grades every pick for the ledger.

Visitors never trigger an AI call or a football API call. They read results that were prepared in advance, which keeps the app fast and the costs predictable. The one exception is Slip Audit, which runs on demand for premium users within their daily quota.

## Principles

- **Risk filter, not tipster.** The product helps you avoid bad bets; it never promises wins.
- **Primary pick first, alternatives on demand.** The slate stays short and scannable.
- **Deterministic first, LLM second.** Models interpret numbers, they don't make them up.
- **Batch served.** Predictions are made ahead of time and served from a cache.
- **Hard server side paywall.** Locked predictions are never sent to guests or free users, not even hidden in the page.
- **Built for slow networks.** Under 2MB on first load, offline support, no heavy chart libraries.

## Stack and tools

| Area | Tools |
|---|---|
| **Frontend / PWA** | Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, next-themes |
| **Client and server state** | Zustand (UI state only), TanStack Query (all server data) |
| **Backend API and scheduler** | FastAPI on Python 3.13, managed with `uv`; SQLAlchemy 2.0 (async). Two processes: the API and a scheduler worker |
| **Database and auth** | Supabase (Postgres, Auth, Row Level Security); migrations as SQL in `supabase/migrations` |
| **Cache, quotas, sessions** | Redis (slate cache, rate limits, daily audit quotas, device sessions) |
| **AI pipeline** | LangGraph for orchestration, OpenRouter for model routing, LangFuse for tracing and cost tracking |
| **Football data** | API-Football |
| **Payments** | Paystack (Flutterwave is deferred until after the MVP) |
| **Testing** | Vitest and Testing Library, Playwright with axe accessibility checks, pytest |
| **Quality** | ESLint, Prettier, ruff, mypy (strict), import linter layer contracts, pre-commit |
| **Hosting** | Vercel (Frankfurt) for the web app; Render (Frankfurt) for the API, the worker and Redis; Supabase in `eu-central-1` |
| **CI** | GitHub Actions: lint, typecheck, layer contracts and unit tests on every push and pull request |

## Repository layout

```
SignalXI/
├── frontend/        Next.js PWA (features in src/features/*, shared UI in src/components/)
│   └── design.md    the design system: type, colours, badges, states
├── backend/         FastAPI API + scheduler worker, layered per spec _root 0001
├── supabase/        SQL migrations and Row Level Security policies
├── docs/
│   ├── scope/       the living feature plan (what to build, in what order)
│   ├── specs/       one decision record per feature or architecture choice
│   └── reviews/     code review findings
├── render.yaml      Render blueprint for the API, worker and Redis
└── AGENTS.md        engineering rules and commands for people and AI tools
```

## Running it locally

You need Node 24 with `pnpm`, Python 3.13 with `uv`, the Supabase CLI, and Docker (for Redis).

```bash
# Local services
supabase start               # Postgres and Auth
docker compose up            # Redis

# Backend (from backend/)
uv sync
uv run honcho start          # API on :8000 plus the scheduler worker
uv run pytest tests/unit     # unit tests
uv run lint-imports          # layer contracts

# Frontend (from frontend/)
pnpm install
pnpm dev                     # web app on :3000
pnpm lint && pnpm typecheck && pnpm test
pnpm test:e2e                # Playwright, against the running local stack
```

Copy `frontend/.env.example` and `backend/.env.example` to `.env` files before you start. Both apps check their settings at startup and stop with a clear error if something is missing. In development, `/dev/ui` shows every shared UI part in both themes.

## Project status and roadmap

SignalXI is in early development, built in thin end to end slices (each slice works through every layer before the next one adds more).

| Phase | What it covers | Status |
|---|---|---|
| Foundation | Stack and architecture, tooling, data model, design system | Stack done; design system and tooling in progress |
| Slice 1 | Real fixtures to a public slate (pipeline, stats engine, LLM pass, slate page) | Planned |
| Slice 2 | Match detail drawer, market tabs, filters | Planned |
| Slice 3 | Settlement, performance ledger (with win/loss log and ROI), pre kickoff refresh | Planned |
| Slice 4 | Accounts, server side paywall, device limits | Planned |
| Slice 5 | Pricing, checkout, payment webhooks | Planned |
| Slice 6 | Slip Audit pipeline, page and guest sample | Planned |
| Slice 7 | PWA install, legal notices, SEO, analytics, pipeline alerts | Planned |
| Slice 8 | Live scores and line ups, in play prediction shifts (after launch) | Planned |

The full, current plan lives in [`docs/scope/scope.md`](docs/scope/scope.md).

**Not planned for v1:** corners and bookings markets, a league risk map, bookmaker affiliate links, native apps, other sports, and comments or social feeds.

## Contributing

Start with [`AGENTS.md`](AGENTS.md); it holds the rules every change follows, and `frontend/AGENTS.md` and `backend/AGENTS.md` cover each app. A few that matter most:

- Business logic never imports a web framework, database session or HTTP client; backend layers are enforced by tests.
- Locked prediction data must never appear in a response for guests or free users.
- TypeScript runs in `strict` mode with no `any`; Python is fully typed under `mypy --strict`.
- UI meets WCAG AA, uses design tokens only (no raw colours), and shows the 18+ notice.
- Tests live in each app's `tests/<kind>/` folder, never next to the source.
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `chore:`).

Big decisions are written down before they're built: check [`docs/specs/`](docs/specs/) for the decision behind a feature, and [`docs/scope/scope.md`](docs/scope/scope.md) for what's next.
