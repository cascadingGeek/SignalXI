# Scope: SignalXI

A mobile first PWA for Nigerian football bettors that filters risk instead of selling tips: one primary pick per fixture, safer alternatives by market section, clear "why avoid" warnings, and a public ledger that grades every pick. Success is measured by guest to paid conversion.

**Build approach:** Tracer Bullet (each slice runs end to end through every layer, real and narrow, then later slices thicken one strand at a time).
**Workflow:** GA (after develop: `/check verify`, `/test`, a fresh model `/check review`, then `/document`; most features get a spec first). The project default level of rigor. `/architect` is the recommended first stop for a feature with a real decision, but skippable when you already know the build. Any feature can carry its own tag (e.g. `· Beta`) to do more or less.

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| 1 | Stack & architecture | Foundation | done |
| 2 | Coding standards & tooling | Foundation | in-progress |
| 3 | Data model | Foundation | planned |
| 4 | Design system & UI foundation | Foundation | planned |
| 5 | Prediction pipeline orchestration | Slice 1 | planned |
| 6 | Football data ingestion | Slice 1 | planned |
| 7 | Statistical engine | Slice 1 | planned |
| 8 | LLM fixture analysis | Slice 1 | planned |
| 9 | Slate API & cache | Slice 1 | planned |
| 10 | Daily slate page | Slice 1 | planned |
| 11 | Fixture detail drawer & market tabs | Slice 2 | planned |
| 12 | Slate filters | Slice 2 | planned |
| 13 | Post match settlement | Slice 3 | planned |
| 14 | Performance ledger page | Slice 3 | planned |
| 15 | Pre kickoff refresh | Slice 3 | planned |
| 16 | Accounts & sign in | Slice 4 | planned |
| 17 | Server side paywall | Slice 4 | planned |
| 18 | Device session cap & rate limits | Slice 4 | planned |
| 19 | Pricing & checkout | Slice 5 | planned |
| 20 | Payment webhooks & subscriptions | Slice 5 | planned |
| 21 | PWA install & offline | Slice 6 | planned |
| 22 | Legal, age notice & consent | Slice 6 | planned |
| 23 | SEO for public pages | Slice 6 | planned |
| 24 | Funnel analytics & error monitoring | Slice 6 | planned |
| 25 | Pipeline health alerts | Slice 6 | planned |

## Foundations

### 1. Stack & architecture · done
Record the full stack from PRD §6 as one decision, then scaffold both apps so every slice builds on real structure. Spec 0001 already settles the backend layering.
**Done when:** the stack (including hosting, the frontend package manager, and local dev setup) is recorded in a spec, and the empty frontend and backend scaffolds boot locally and pass build.
- [x] Decide the stack (spec): `/architect stack & architecture`
- [x] Scaffold from the decision: `/develop stack & architecture`
Spec [_root 0001](../specs/_root/0001-stack-architecture/index.md) · backend layering [backend 0001](../specs/backend/0001-backend-layering-dependency-rules/index.md) · code in `frontend/`, `backend/`, `supabase/`
_Skipped at done (2026-11-25, engineer's call): `/readyz` green against `supabase start` and the e2e workflow, because Docker cannot be installed on the dev machine. CI on first push still to be seen._

### 2. Coding standards & tooling · in-progress
Conventions and tooling choices are captured in `AGENTS.md`; install them once the scaffold exists.
**Done when:** ruff, mypy, ESLint, Prettier, `pre-commit` and `lint-imports` run clean, and CI runs on push.
- [x] Capture conventions + tooling choices: `/audit`
- [ ] Install the tooling: `/develop tooling`
- [ ] Check it runs clean: `/test`

### 3. Data model · needs a decision
Fixtures, reports, picks, users, subscriptions (PRD §9) as SQL migrations with RLS, mirrored by SQLAlchemy models.
**Done when:** every later slice (pipeline writes, settlement, paywall, billing) fits without a breaking migration, and pipeline writes are idempotent per fixture and slate date.
- [ ] Design it (spec): `/architect data model`

### 4. Design system & UI foundation · needs a decision
Visual language, classification badges, cards, tabs and drawer primitives, tuned for mid range Android on slow networks.
**Done when:** `design.md` covers type, color, spacing and the four classification badges; base components meet WCAG AA and fit the 2MB budget.
- [ ] Design it (spec): `/architect design system & UI foundation`

## Slice 1: Real fixtures to a public slate

The thinnest real thread: the 06:00 job pulls real fixtures for one competition, computes stats, runs one LLM pass per fixture, saves, warms the cache, and a guest sees today's primary picks. No auth, paywall, drawer or ledger yet.

### 5. Prediction pipeline orchestration · needs a decision
The scheduler process and the daily job that runs ingest, engine, LLM, save and cache warm in order.
**Done when:** the job runs on schedule at 06:00 WAT, a second scheduler or overlapping deploy cannot double run it, and a failed fixture does not sink the whole slate.
- [ ] Design it (spec): `/architect prediction pipeline orchestration`

### 6. Football data ingestion · needs a decision
Pull upcoming fixtures, form, home and away splits, half splits and injuries from the football data provider.
**Done when:** a run stores today's and tomorrow's fixtures with the stats the engine needs, and missing data is flagged rather than guessed.
- [ ] Design it (spec): `/architect football data ingestion`

### 7. Statistical engine · needs a decision
Pure math: Poisson goal model, half splits, form weighting and anomaly flags, producing baseline probabilities per market.
**Done when:** given fixture stats it returns probabilities for every MVP market and data quality flags, deterministically, with no I/O.
- [ ] Design it (spec): `/architect statistical engine`

### 8. LLM fixture analysis · needs a decision
One LLM pass per fixture that reads only the computed numbers and returns the nested report (classification, primary pick, sections, reasoning, avoid tooltip).
**Done when:** output passes strict validation (enums, sections, avoid tooltip on HIGH_RISK_AVOID), invalid output is rejected or retried safely, and every call is traced.
- [ ] Design it (spec): `/architect LLM fixture analysis`

### 9. Slate API & cache · needs a decision
Read endpoint for the daily slate, served from the cache, never triggering the LLM or the football provider.
**Done when:** the slate endpoint returns today's and tomorrow's reports from cache, the cache is fresh after each pipeline run, and the response shape is ready for the paywall presenter.
- [ ] Design it (spec): `/architect slate API & cache`

### 10. Daily slate page · needs a decision
The primary public view: match cards with the primary pick, classification badge, kickoff in WAT, and the "+N alternative markets" cue.
**Done when:** a guest on a mid range phone sees today's slate render fast, with loading, empty and error states.
- [ ] Design it (spec): `/architect daily slate page`

## Slice 2: Deeper fixture view

### 11. Fixture detail drawer & market tabs · needs a decision
Tap a card to open `All`, `Main`, `Goals`, `Half`, `Specials` tabs with alternative picks and reasoning bullets.
**Done when:** each tab shows its picks with badges and 2 to 3 reasoning bullets, and HIGH_RISK_AVOID fixtures pin the "Why Avoid" banner on top.
- [ ] Design it (spec): `/architect fixture detail drawer & market tabs`

### 12. Slate filters · needs a decision
Filter the slate by date (today, tomorrow), competition and classification.
**Done when:** filters combine, the URL reflects them, and an empty result shows a clear state.
- [ ] Design it (spec): `/architect slate filters`

## Slice 3: Trust: settlement and ledger

### 13. Post match settlement · needs a decision
A job every 2 hours that fetches half time and full time scores and grades every pick WON, LOST or VOID.
**Done when:** every market in all four sections grades correctly from the scores, postponed matches void, and grading is idempotent.
- [ ] Design it (spec): `/architect post match settlement`

### 14. Performance ledger page · needs a decision
Public accuracy tracker: the rolling 30 day rate on primary picks by classification, plus a "By Market Section" breakdown.
**Done when:** the headline rate grades only primary picks, the section breakdown shows all settled alternatives, and history is browsable.
- [ ] Design it (spec): `/architect performance ledger page`

### 15. Pre kickoff refresh · needs a decision
Refresh reports 90 minutes before major kickoff windows, so late team news is reflected.
**Done when:** affected fixtures are refreshed before kickoff, the cache updates, and already published picks stay auditable in the ledger.
- [ ] Design it (spec): `/architect pre kickoff refresh`

## Slice 4: Accounts and paywall

### 16. Accounts & sign in · needs a decision
Sign up and sign in with no payment step; free members can save preferred competitions.
**Done when:** a guest can create a free account, sign in and out, and saved competitions persist.
- [ ] Design it (spec): `/architect accounts & sign in`

### 17. Server side paywall · needs a decision
Guests and free members get 2 to 3 full free cards (at least one HIGH_RISK_AVOID) and locked placeholders; premium gets everything.
**Done when:** no locked pick, avoid tooltip or market section ever appears in a guest or free payload, checked by a guest sweep of every public route.
- [ ] Design it (spec): `/architect server side paywall`

### 18. Device session cap & rate limits · needs a decision
At most 2 active devices per premium account, and sliding window rate limits on auth, prediction and webhook routes.
**Done when:** a third sign in ends the oldest session, and each limited route rejects bursts with a clear error.
- [ ] Design it (spec): `/architect device session cap & rate limits`

## Slice 5: Billing

### 19. Pricing & checkout · needs a decision
Pricing page for the Weekend Pass and Monthly Pro, and checkout for signed in users.
**Done when:** a free member can start checkout for either plan using the local payment methods, and gets clear success and failure states.
- [ ] Design it (spec): `/architect pricing & checkout`

### 20. Payment webhooks & subscriptions · needs a decision
Verify the payment webhook, activate or extend the subscription once, and unlock premium right away.
**Done when:** forged or replayed webhooks are rejected, a valid payment activates the plan exactly once, expiry is enforced, and the full slate unlocks immediately.
- [ ] Design it (spec): `/architect payment webhooks & subscriptions`

## Slice 6: Launch readiness

### 21. PWA install & offline · needs a decision
Manifest and service worker so the app installs, and the shell plus the last slate load offline.
**Done when:** the app installs on Android and iOS, and offline it opens to the last fetched slate without leaking locked data.
- [ ] Design it (spec): `/architect PWA install & offline`

### 22. Legal, age notice & consent · needs a decision
The 18+ notice and responsible gambling disclaimer everywhere, privacy policy and terms, and tracking consent.
**Done when:** the disclaimer is visible on every page, privacy and terms pages exist, and non essential tracking waits for consent.
- [ ] Design it (spec): `/architect legal, age notice & consent`

### 23. SEO for public pages · needs a decision
Server rendered, indexable slate preview, ledger and pricing pages.
**Done when:** public pages have metadata, social cards and a sitemap, and locked content never appears in the HTML.
- [ ] Design it (spec): `/architect SEO for public pages`

### 24. Funnel analytics & error monitoring · needs a decision
Track the conversion funnel and catch frontend and API errors in production.
**Done when:** guest view, free pick opened, sign up, checkout started and paid are measurable, and production errors reach you with context.
- [ ] Design it (spec): `/architect funnel analytics & error monitoring`

### 25. Pipeline health alerts · needs a decision
Know when the daily job, refresh or settlement fails or produces an empty slate.
**Done when:** a failed or empty run alerts you before users notice, with enough detail to rerun it.
- [ ] Design it (spec): `/architect pipeline health alerts`

## Deferred
Out of scope for the current build pass, kept so the plan stays honest.
- **Weekly slate view**: a 7 day date filter, which means generating further ahead · needs a decision
- **Push notifications**: optional alerts 1 hour before major kickoff windows · needs a decision
- **PRD §11 backlog**: Corners and Bookings sections, risk and form map, affiliate links, ads, native apps, social features

## Legend

**The decision box.** Every feature carries exactly one, the sub-task whose label ends with `(spec)`. Its wording varies (`Design it (spec)` normally, `Decide the stack (spec)` on Stack & architecture), so skills locate it by that `(spec)` suffix, never by an exact label. Every other box is an execution box and `/architect` never ticks one.

**Feature lifecycle**: the scope updates as a feature moves; each row is what it shows and who sets it:

| State | Set by | The feature shows |
|---|---|---|
| `planned` · needs a decision | `/scope` | one box: `Design it (spec): /architect <feature>` |
| `in-progress` (designed) | **`/architect` at spec capture** | `Design it` ticked; spec linked; `Build it: /develop <feature>` + **2 to 5 milestones**; the tier's closing boxes (`Verify it` Alpha+, `Test it` Beta+, `Review it` + `Document it` GA); any surfaced follow-up enrolled |
| `in-progress` (building) | `/develop` | milestone sub-boxes tick one by one; code pointer filled |
| `in-progress` (verified) | `/check verify` | `Build it` + milestones ticked; `Verify it` ticked |
| `done` | **you, when you decide it is** (any skill sets it when you say so); `/sync` reconciles | boxes you ran ticked, skipped ones marked skipped; the tier's last stage (`Prototype` → after `/develop`; `Alpha` → after `/check verify`; `Beta`/`GA` → after `/test`) is the suggested point to call it done; `/sync` captures conventions |

- **Next step** = the first unticked box (always a command or a tracked milestone).
- **needs a decision** = run `/architect` first; otherwise straight to `/develop` (or `/audit` for standards & tooling). The tag drops once the spec is captured.
- **Atomic build tasks live in the spec's `## Build plan`, not here**: the scope carries only the milestone rollup.
- **Status** `planned` → `in-progress` → `done`, plus `existing` (pre-workflow) and `dropped` (de-scoped, kept for history).
- **Approach tag** beside a heading (e.g. `· Facade`) overrides the project default for that feature; no tag = inherits it.
- **Workflow tier tag** beside a heading (e.g. `· GA`, `· Prototype`) sets that one feature's rigor above or below the project default; no tag inherits the default. It decides the feature's check boxes and each skill's next suggestion.
- **Workflow** (header line) is the project default, what runs after `/develop`: **Prototype** = nothing (trust develop's own build time self check); **Alpha** = `/check verify`; **Beta** = `/check verify` then `/test`; **GA** = adds a fresh model `/check review` then `/document`. A feature built on an unratified decision (an `Assumed` spec) stays flagged, but that never blocks `done`.
- **Pointer line** (`spec <n> · code in <path>`): the spec link added by `/architect`, the code path by `/develop`.
