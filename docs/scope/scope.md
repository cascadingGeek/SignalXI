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
| 3 | Data model | Foundation | in-progress |
| 4 | Design system & UI foundation | Foundation | in-progress |
| 31 | Competition coverage & phased rollout | Foundation | in-progress |
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
| 26 | Slip audit pipeline | Slice 6 | planned |
| 27 | Slip audit page | Slice 6 | planned |
| 28 | Guest sample audit | Slice 6 | planned |
| 21 | PWA install & offline | Slice 7 | planned |
| 22 | Legal, age notice & consent | Slice 7 | planned |
| 23 | SEO for public pages | Slice 7 | planned |
| 24 | Funnel analytics & error monitoring | Slice 7 | planned |
| 25 | Pipeline health alerts | Slice 7 | planned |
| 29 | Live scores & line ups | Slice 8 | in-progress |
| 30 | In play prediction shifts | Slice 8 | in-progress |
| 32 | Where to watch links | Slice 8 | planned |
| 33 | Official match highlights | Slice 8 | planned |

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

### 3. Data model · in-progress
Fixtures, reports, picks, users, subscriptions and slip audits (PRD §9) as SQL migrations with RLS, mirrored by SQLAlchemy models.
**Done when:** every later slice (pipeline writes, settlement, paywall, billing, slip audits) fits without a breaking migration, and pipeline writes are idempotent per fixture and slate date.
- [x] Design it (spec): `/architect data model`
- [ ] Build it: `/develop data model`
  - [ ] Thin thread: migration 1 prediction core, roles and revoked defaults, models, `save_revision`, Supavisor role login, idempotency and lock tests (AC-1, AC-2, AC-4, AC-5, AC-6, AC-7, AC-13)
  - [ ] Grading strand and role matrix: settlement trigger, `pick_grade_events`, `PickRepository.grade`, permission tests for every role (AC-2, AC-3, AC-8)
  - [ ] Migrations 2 and 3: profiles with signup trigger, prefs, payments, subscriptions, slip audits, with their tests (AC-1, AC-3, AC-9, AC-10, AC-11)
  - [ ] Drift guard: models, enums and markets versus the database; per service `DATABASE_URL` documented (AC-1, AC-12)
- [ ] Verify it: `/check verify data model`
- [ ] Test it: `/test data model`
- [ ] Review it (fresh model): `/check review data model`
- [ ] Document it: `/document data model`
Spec [_root 0005](../specs/_root/0005-data-model/index.md) · code in `supabase/migrations/`, `supabase/seed.sql`, `backend/app/models/`, `backend/app/repositories/`

### 4. Design system & UI foundation · in-progress
Visual language, classification badges, cards, tabs and drawer primitives, tuned for mid range Android on slow networks.
**Done when:** `design.md` covers type, color, spacing and the four classification badges; base components meet WCAG AA and fit the 2MB budget.
- [x] Design it (spec): `/architect design system & UI foundation`
- [ ] Build it: `/develop design system & UI foundation`
  - [x] Thin thread: fonts, core tokens, Midnight first theme toggle, one badge on `/dev/ui`, theme and axe e2e (AC-1, AC-2, AC-3, AC-11, AC-12)
  - [x] Full tokens and themed shadcn primitives, skeleton pulse, colour literal and contrast tests (AC-4, AC-5, AC-6, AC-7, AC-12)
  - [x] Error and empty states, error copy map, Next.js error pages (AC-8, AC-9)
  - [x] AdSlot, env flags, app shell (header, bottom nav, footer) (AC-6, AC-10)
  - [ ] Complete `/dev/ui`, budget e2e, `frontend/design.md` (AC-11, AC-12, AC-13, AC-14) · built; open: PNG exports of the canvas under `docs/design/`
  - [ ] Adopt the v3 canvas: logo, signal bar badges, bottom and responsive drawers, CSS loader, illustrations (AC-5, AC-6, AC-13, AC-15, AC-16) · built 2026-11-27, not yet verified
- [x] Verify it: `/check verify design system & UI foundation`
- [x] Test it: `/test design system & UI foundation`
- [x] Review it (fresh model): `/check review design system & UI foundation`
- [x] Document it: `/document design system & UI foundation`
Spec [frontend 0001](../specs/frontend/0001-design-system-ui-foundation/index.md) · design canvas https://claude.ai/artifact/Jtn9yosDQK2WZ1ztYMSpWN (updated 2026-11-27, replaces 1t4J5GyAVk5ogSjz5iuEug) · code in `frontend/src/app/globals.css`, `frontend/src/components/`, `frontend/src/features/predictions/`, `frontend/design.md`

### 31. Competition coverage & phased rollout · in-progress
Grow coverage beyond the PRD's nine competitions in three phases (European core and international football, then midweek and summer leagues, then African football), where each competition earns its place through a data gate and private shadow grading.
**Done when:** a competition can only reach users after passing the data gate and shadow mode against a defined benchmark, shadow data never appears in any payload, the slate is capped at 40 by priority, and the ledger can be filtered by competition.
- [x] Design it (spec): `/architect competition coverage`
- [ ] Build it: `/develop competition coverage & phased rollout`
  - [ ] Thin thread: competitions tables with grants and RLS, Big Five seed, gate job, pipeline order with visibility, published only reads, leak and grant tests (AC-1, AC-2, AC-3, AC-4, AC-6, AC-7, AC-8, AC-14)
  - [ ] Weekly checks: benchmark, shadow report, underperformance alert (AC-10, AC-11)
  - [ ] Slate rules: caps, frozen slate, cup rounds by season, national team eligibility (AC-4, AC-5, AC-9, AC-9b)
  - [ ] Widen coverage: all phases and tournaments, replay, id drift check, `/competitions`, demotion rules (AC-1, AC-3, AC-10, AC-12, AC-13, AC-15)
  - [ ] Pre launch proving: Phase 1 in shadow at least 4 weeks before launch (AC-16)
- [ ] Verify it: `/check verify competition coverage`
- [ ] Test it: `/test competition coverage`
- [ ] Review it (fresh model): `/check review competition coverage`
- [ ] Document it: `/document competition coverage`
Spec [_root 0004](../specs/_root/0004-competition-coverage-rollout/index.md) · shapes the data model (#3), pipeline (#5, #8), engine (#7), settlement (#13) and ledger (#14)

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
**Done when:** given fixture stats it returns probabilities for every MVP market in PRD §3.2 (including `UNDER_4_5_GOALS`, added 2026-11-27) and data quality flags, deterministically, with no I/O.
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
Public accuracy tracker: a win/loss log of every graded pick, the rolling 30 day rate on primary picks by classification, a "By Market Section" breakdown, and ROI (return on investment) so users see what following the picks would have returned. ROI is a user request beyond PRD §5.4; the spec decides which odds and stake it assumes.
**Done when:** the headline rate grades only primary picks, the section breakdown shows all settled alternatives, ROI is shown with its odds and stake basis stated, and history is browsable.
- [ ] Design it (spec): `/architect performance ledger page`

### 15. Pre kickoff refresh · needs a decision
Refresh reports 90 minutes before major kickoff windows, so late team news is reflected.
**Done when:** affected fixtures are refreshed before kickoff, the cache updates, and already published picks stay auditable in the ledger.
- [ ] Design it (spec): `/architect pre kickoff refresh`

## Slice 4: Accounts and paywall

### 16. Accounts & sign in · needs a decision
Sign up and sign in with no payment step; free members can save preferred competitions. Owns the Account page from the 2026-11-27 canvas (plan, saved competitions, theme, devices, links to audit history, policies and sign out); the plan and device rows fill in as features 18 and 20 land.
**Done when:** a guest can create a free account, sign in and out, and saved competitions persist.
- [ ] Design it (spec): `/architect accounts & sign in`

### 17. Server side paywall · needs a decision
Guests and free members get 2 to 3 full free cards (at least one HIGH_RISK_AVOID) and locked placeholders; premium gets everything.
**Done when:** no locked pick, avoid tooltip or market section ever appears in a guest or free payload, checked by a guest sweep of every public route.
- [ ] Design it (spec): `/architect server side paywall`

### 18. Device session cap & rate limits · needs a decision
At most 2 active devices per premium account, and sliding window rate limits on auth, prediction, slip audit and webhook routes.
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

## Slice 6: Slip audit

Premium "third eye" review of a user's own bet slip before they stake (PRD §5.3, §8.2).

### 26. Slip audit pipeline · needs a decision
On demand audit of 1 to 3 slip screenshots or pasted text: extract the legs, match them to known fixtures, run the slip math, and return grounded verdicts and a trimmed slip, within each plan's daily quota.
**Done when:** a premium user gets a verdict for every leg (Keep, Keep (Value), Cautious, Drop, Drop (No Value)) and a trimmed slip with recalculated odds; unknown fixtures are marked as unverified instead of invented; Monthly Pro gets 3 audits a day and Weekend Pass 1, resetting at midnight WAT, and parallel requests can't beat the count; more than 3 images or 15 legs is rejected; raw screenshots are never stored.
- [ ] Design it (spec): `/architect slip audit pipeline`

### 27. Slip audit page · needs a decision
The premium audit screen: upload or paste a slip, images shrunk on the phone before upload, and the result styled like a real bet slip, with a ticket header, leg rows with verdict badges, a trimmed slip card, and a history of past audits.
**Done when:** a premium user can audit a slip from a mid range Android on 3G, sees the remaining daily quota, can spot which legs to cut at a glance, and can reopen past audits; free users and guests never reach the audit endpoint.
- [ ] Design it (spec): `/architect slip audit page`

### 28. Guest sample audit · needs a decision
A locked, interactive sample audited slip shown to guests and free members, to drive upgrades.
**Done when:** guests and free members can explore a sample audit that looks like the real thing, with a clear upgrade path, and it never calls the audit pipeline.
- [ ] Design it (spec): `/architect guest sample audit`

## Slice 7: Launch readiness

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

## Slice 8: Live match experience

User requests beyond the PRD, built after launch.

### 29. Live scores & line ups · in-progress
Show live scores and confirmed line ups for fixtures on the slate, across every competition the slate covers (PRD §5.1 lists nine), so users can follow how predicted games are going.
**Done when:** scores and line ups on slate fixtures update during matches without visitor requests calling the football API (a job saves them, visitors read them), and a finished match hands over cleanly to settlement.
- [x] Design it (spec): `/architect live scores & line ups`
- [ ] Build it: `/develop live scores & line ups`
  - [ ] Thin thread: migration, live job polling `fixtures?ids=`, `/live/slate` with private ETags and rate limits, live badge on the card (AC-1, AC-2, AC-3, AC-7, AC-9, AC-10, AC-14, AC-17)
  - [ ] Events, stats and line ups: event reconciliation, `/live/fixtures/{id}`, the Live tab (AC-4, AC-5, AC-6, AC-8, AC-10)
  - [ ] Failure handling and settlement hand off: stale rule, statuses, budget guard, restart rebuild, settle on finish (AC-1, AC-11, AC-12, AC-13, AC-14, AC-15)
  - [ ] Disclosures and accessibility (AC-16)
- [ ] Verify it: `/check verify live scores & line ups`
- [ ] Test it: `/test live scores & line ups`
- [ ] Review it (fresh model): `/check review live scores & line ups`
- [ ] Document it: `/document live scores & line ups`
Spec [_root 0002](../specs/_root/0002-live-scores-lineups/index.md)

### 30. In play prediction shifts · in-progress
Update a fixture's outlook while the match is running, as goals, cards and momentum change it.
**Done when:** a spec records how live shifts fit PRD §1 (picks are made once in advance and visitors never trigger LLM calls), shifted picks are labelled as live and kept apart from the graded pre match pick, and the ledger still grades only what was published before kickoff.
- [x] Design it (spec): `/architect in play prediction shifts`
- [ ] Build it: `/develop in play prediction shifts`
  - [ ] Thin thread: migration, market rules and in play model for main and goals markets, primary pick shift on the card (AC-1, AC-2, AC-3, AC-4, AC-8, AC-10, AC-11, AC-13)
  - [ ] All markets and alternatives in the drawer (AC-1, AC-2, AC-5, AC-10, AC-11)
  - [ ] States: decided, normal time freeze, stale, hysteresis, restart rebuild (AC-3, AC-5, AC-6, AC-7, AC-8)
  - [ ] Guardrails: disclaimers, ledger isolation test, locked payload tests (AC-9, AC-10, AC-12)
- [ ] Verify it: `/check verify in play prediction shifts`
- [ ] Test it: `/test in play prediction shifts`
- [ ] Review it (fresh model): `/check review in play prediction shifts`
- [ ] Document it: `/document in play prediction shifts`
Spec [_root 0003](../specs/_root/0003-in-play-prediction-shifts/index.md) · production flag gated on legal review (#22)

### 32. Where to watch links · needs a decision
Show which licensed broadcaster carries each fixture in Nigeria, with an outbound link, as the legal alternative to live streaming (unlicensed streams are out of scope).
**Done when:** each slate fixture with a known Nigerian broadcaster shows it with a link, the source of broadcaster data is decided, and no stream is embedded or relayed.
- [ ] Design it (spec): `/architect where to watch links`

### 33. Official match highlights · needs a decision
After full time, show highlights the leagues and clubs publish themselves in the fixture drawer.
**Done when:** finished fixtures show an official highlight clip when one exists, only from licensed official sources, and missing clips show nothing rather than a broken player.
- [ ] Design it (spec): `/architect official match highlights`

## Deferred
Out of scope for the current build pass, kept so the plan stays honest.
- **Weekly slate view**: a 7 day date filter, which means generating further ahead · needs a decision
- **Push notifications**: optional alerts 1 hour before major kickoff windows, plus the three notification switches on the Account board (hidden in v1) · needs a decision
- **Animation library**: GSAP or similar for timeline or physics animation that CSS can't do; weigh it against the 2MB budget and reduced motion · needs a decision · from spec frontend 0001
- **Pause account**: let a member pause their account for 7, 30 or 90 days from the responsible gambling page (designer proposal on the 2026-11-27 canvas, not in the PRD); decide what happens to paid plan time and sessions · needs a decision · from spec frontend 0001
- **Ad network**: pick the network, add cookie consent and an 18+ ad policy, then turn `NEXT_PUBLIC_ADS_ENABLED` on; the slots already exist · needs a decision · from spec frontend 0001
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
