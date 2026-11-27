# 0004. Competition coverage and phased rollout

**Date**: 2026-11-27
**Status**: Proposed

## Summary

SignalXI will cover far more than the PRD's nine competitions, added in three phases (European core and international football first, then midweek and summer leagues, then African football). No competition reaches users until its data passes a quality check and its picks have been graded in private "shadow mode" and come within 5 points of the benchmark. The benchmark is the Big Five leagues before launch and the live core leagues after. Competitions and their state live in a Postgres table the app can't change: only reviewed SQL migrations can. The daily slate is capped at 40 fixtures so it stays scannable and LLM costs stay bounded, and the public ledger can be filtered by competition so weaker leagues are visible, not hidden.

## Requirements

**User stories**:
- As a Nigerian bettor, I want the leagues I actually bet on (Championship, Europa League, Saudi Pro League, NPFL and more) on the slate so that SignalXI covers my weekend.
- As a bettor who checks the ledger, I want to see accuracy per competition so that I know which leagues SignalXI reads well.
- As the engineer, I want a new league proven in private before it goes public so that a weak data source never damages the public accuracy record.

**Definitions used below**:
- **Graded primary pick**: a pick with `is_primary = true` and `settlement_status` WON or LOST. Its **hit rate** is WON / (WON + LOST), rounded to one decimal place. VOID and PENDING picks are excluded. This is the same definition the ledger (#14) uses.
- **Points below**: a plain difference in percentage points (benchmark rate minus competition rate), never a ratio.
- **Benchmark**: before any Phase 1 `LEAGUE` competition is `LIVE`, the pooled hit rate of all graded shadow primary picks of the Big Five leagues. After that, the **core average**: the pooled 30 day hit rate of `LIVE` Phase 1 `LEAGUE` competitions, valid only with at least 100 graded primary picks across at least 3 of them. If neither is valid, the benchmark is undefined and nothing is promoted.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):
- **AC-1**: A `competitions` table holds one row per provider league in the seed list below, each with its provider league id, name, country, type, phase, priority and state. Every row starts `OFF`. A seed competition that can't be found in API-Football's leagues endpoint at build time is left out and logged in the migration's comment, never guessed.
- **AC-2**: Only SQL migrations in `supabase/migrations` write `competitions`. The backend service role gets `SELECT` only on it, so an `UPDATE` from the app fails with a permission error (an integration test proves this). An architecture test also fails if application code contains a write to `competitions`.
- **AC-3**: A weekly data gate job (Mondays 03:00 UTC) appends one `competition_gate_checks` row per competition and never changes `state`. It checks the most recent season that API-Football declares coverage for, and the two latest completed seasons before it.
  - A `LEAGUE` or `CONTINENTAL_CLUB` passes when that season's coverage covers fixture statistics, events, line ups and injuries, and both completed seasons have finished fixtures.
  - A `CUP` passes on the coverage flags alone, since its teams' strength comes from their league history.
  - A `NATIONAL_TEAM` competition passes on the coverage flags. Each of its fixtures is then eligible only if both teams have at least 15 competitive matches in the last three years (AC-9b).
  - A competition with no declared current season (between seasons) is recorded as `NO_SEASON`, not failed.
  - A gate that fails for a `SHADOW` or `LIVE` competition raises an alert and never demotes it.
- **AC-4**: The daily pipeline at 06:00 WAT builds each slate in this order:
  1. Ingest fixtures of `SHADOW` and `LIVE` competitions. `OFF` competitions are not ingested.
  2. Assign each fixture's `slate_date` (the WAT calendar date of its kickoff).
  3. Drop ineligible fixtures: cup rounds before the start round (AC-9), and national team fixtures with a thin team (AC-9b).
  4. Sort each group by competition `priority` (highest first), then kickoff, then provider fixture id.
  5. Take the first `SLATE_MAX_FIXTURES` (40) `LIVE` fixtures per `slate_date`, and the first `SHADOW_MAX_FIXTURES` (20) `SHADOW` fixtures per `slate_date` across all shadow competitions.
  6. Make the LLM call only for fixtures that were kept.
  Kept `LIVE` fixtures get reports with `visibility = PUBLISHED`, and kept `SHADOW` fixtures get `visibility = SHADOW`. Dropped fixtures keep their `fixtures` row but get no report and appear nowhere.
- **AC-5**: A slate's membership is set by that day's 06:00 run and frozen for the day. A postponed fixture keeps its place. A fixture added or rescheduled later is not added, and no fixture is bumped. A state change (promotion or demotion) applies from the next 06:00 run, never to a slate already built.
- **AC-6**: Every user facing read goes through one shared repository function that joins `fixture_reports.visibility = PUBLISHED`. This covers the slate API, the fixture API, the live endpoints (specs 0002 and 0003), the ledger, SEO pages and the sitemap. `fixtures` RLS for client roles hides fixtures with no published report. A shadow fixture never appears in any payload for any tier, and is never counted in `locked_count` or any other total.
- **AC-7**: Free preview selection (`is_free_preview`) runs after the cap, over `PUBLISHED` reports only. A check constraint makes `visibility = SHADOW` imply `is_free_preview = false`.
- **AC-8**: Settlement grades shadow and published picks with the same code. Shadow fixtures get no live polling and no Redis live keys (spec 0002), so they are graded by the 2 hour settlement sweep.
- **AC-9**: Fixtures of `CUP` competitions are included only when their round's rank is at least the competition's `cup_start_rank` (the round of 32, or that cup's equivalent stage). Ranks come from `competition_seasons.round_order` for the fixture's season. A round name not in that list is excluded and raises an alert, and is never included by default. National team tournaments are `NATIONAL_TEAM` type, not `CUP`, so every stage of them is eligible.
- **AC-9b**: A `NATIONAL_TEAM` fixture is eligible only if both teams have at least `NATIONAL_TEAM_MIN_MATCHES` (15) competitive matches in the last three years. Competitive means any competition API-Football doesn't classify as friendlies (its "Friendlies" leagues are excluded by id). Team counts are cached in Redis for 7 days.
- **AC-10**: A weekly shadow report job (after the gate job) appends one `competition_weekly_checks` row per `SHADOW` and `LIVE` competition: hit rate, graded pick count, benchmark rate and the as of date. A `SHADOW` competition is marked ready to promote when all of these hold:
  - It has been in shadow at least `shadow_days`: 28, or 14 for national team tournaments.
  - It has at least `SHADOW_MIN_PICKS` graded primary picks: 30, or 10 for national team tournaments.
  - Its hit rate is no more than `SHADOW_MAX_GAP_POINTS` (5) points below the benchmark.
  - The benchmark is defined.
  A national team tournament must also pass a stats engine replay of its previous edition, with no LLM step: the replay's hit rate must be within 5 points of the benchmark, and it is recorded in that competition's latest `competition_gate_checks.report`. The report goes to the pipeline alert channel (#25). Promotion itself is a migration (AC-2).
- **AC-11**: For each `LIVE` competition with at least `UNDERPERFORM_MIN_PICKS` (20) graded primary picks in the last 30 days, the weekly check flags it as underperforming when its rate is more than `UNDERPERFORM_GAP_POINTS` (8) below the benchmark. When a competition has been flagged at `UNDERPERFORM_WEEKS` (4) weekly checks in a row, one alert is raised. No new alert fires while the flag continues, and the alert rearms after a check without the flag. It never changes the state; you decide.
- **AC-12**: Demoting a competition (`LIVE` to `SHADOW` or `OFF`) never hides its history. Its published picks stay in the ledger, settlement and live polling continue for fixtures already published, and a return to `SHADOW` sets a new `shadow_started_at` (the shadow window restarts).
- **AC-13**: `GET /api/v1/competitions` returns every competition that is `LIVE` or has published picks, as `{id, name, country, type, active}` (`active` is true when it's `LIVE`). It is sorted by priority (highest first), then name, cached publicly for 5 minutes, and rate limited. It never exposes `phase`, `priority`, `state` or shadow only competitions. The slate filter shows only `active` competitions grouped by type. The ledger filter shows them all.
- **AC-14**: Fixtures reference their competition by `competition_id` (a foreign key to `competitions`), replacing the PRD's free text `competition` column. The slate and ledger show the competition's name and country from that table.
- **AC-15**: The gate job checks that each stored `provider_league_id` still returns the same name and country from API-Football, and alerts on a mismatch. A changed id is fixed by a migration that updates only the id and keeps the state.
- **AC-16**: Before launch, the Phase 1 competitions go through the same gate and shadow, so launch day picks are already proven against the pooled Big Five benchmark.

**Seed list** (phase, type, priority; priority 100 is highest; one row per provider league):

| Phase | Competitions | Type | Priority |
|---|---|---|---|
| 1 | Premier League, La Liga, Serie A, Bundesliga, Ligue 1 | LEAGUE | 100 |
| 1 | UEFA Champions League | CONTINENTAL_CLUB | 100 |
| 1 | AFCON, AFCON Qualifiers, UEFA Nations League | NATIONAL_TEAM | 95 |
| 1 | World Cup Qualifiers, one row each: CAF, UEFA, CONMEBOL, CONCACAF, AFC | NATIONAL_TEAM | 95 |
| 1 | FIFA World Cup, UEFA European Championship, Copa America, CONCACAF Gold Cup, AFC Asian Cup (when held) | NATIONAL_TEAM | 95 |
| 1 | EFL Championship | LEAGUE | 90 |
| 1 | UEFA Europa League, UEFA Conference League, FIFA Club World Cup (when held) | CONTINENTAL_CLUB | 90 |
| 1 | Eredivisie | LEAGUE | 85 |
| 2 | Primeira Liga, Süper Lig, Scottish Premiership, Belgian Pro League, Swiss Super League, Austrian Bundesliga, Saudi Pro League | LEAGUE | 70 |
| 2 | Norwegian Eliteserien, Swedish Allsvenskan | LEAGUE | 65 |
| 2 | CONMEBOL Libertadores | CONTINENTAL_CLUB | 65 |
| 2 | 2. Bundesliga, Serie B, LaLiga Hypermotion, Ligue 2, Brasileirão Série A, MLS | LEAGUE | 60 |
| 2 | FA Cup, EFL Cup, Copa del Rey, Coppa Italia, DFB-Pokal (from the round of 32 or equivalent) | CUP | 60 |
| 3 | CAF Champions League, CAF Confederation Cup | CONTINENTAL_CLUB | 75 |
| 3 | Nigeria Premier Football League | LEAGUE | 75 |
| 3 | South African Premiership, Egyptian Premier League | LEAGUE | 55 |
| 3 | Ghana Premier League, Kenya Premier League, Tanzanian Ligi Kuu Bara | LEAGUE | 50 |

Phase is a priority order, not a strict sequence: any competition may enter shadow once it passes the gate.

## Decision

**Chosen option**: Option 1: A competitions table with a data gate, private shadow mode and migration only state changes.

Coverage grows phase by phase, but each competition earns its place: a weekly job checks its data, graded shadow picks prove it against a defined benchmark, and a reviewed migration switches it live. The slate is capped by priority and frozen each morning, and only published picks ever reach users.

**Implementation skills**: `supabase-postgres-best-practices` (`supabase/agent-skills`, `.claude/skills/supabase-postgres-best-practices/`) · `supabase` (`supabase/agent-skills`, `.claude/skills/supabase/`) · `fastapi` (`fastapi/fastapi`, `.claude/skills/fastapi/`) · `python-backend` (`yonatangross/orchestkit`, `.claude/skills/python-backend/`) · `redis-core` (`redis/agent-skills`, `.claude/skills/redis-core/`)

## Feature design

**Data model sketch** (additions to the PRD §9 schema):

| Entity | Fields | Rules |
|---|---|---|
| `competitions` (new) | `id uuid pk`, `provider_league_id int not null unique`, `name text not null`, `country text not null`, `type` enum (`LEAGUE`, `CUP`, `CONTINENTAL_CLUB`, `NATIONAL_TEAM`), `phase smallint not null` (1 to 3), `priority smallint not null` (0 to 100), `state` enum (`OFF`, `SHADOW`, `LIVE`) default `OFF`, `cup_start_rank smallint null`, `shadow_days smallint not null default 28`, `min_shadow_picks smallint not null default 30`, `shadow_started_at timestamptz null`, `live_since timestamptz null`, `created_at`, `updated_at` | Written only by migrations; service role `SELECT` only; check `cup_start_rank is not null` when `type = CUP`; tournaments seeded with 14 days and 10 picks |
| `competition_seasons` (new) | `id uuid pk`, `competition_id fk`, `provider_season int not null`, `round_order jsonb null` (the provider's round names in order, CUP only) | unique `(competition_id, provider_season)`; written by migrations |
| `competition_gate_checks` (new) | `id uuid pk`, `competition_id fk`, `checked_at timestamptz not null`, `season int null`, `result` enum (`PASSED`, `FAILED`, `NO_SEASON`), `report jsonb not null` (each check and why, plus the tournament replay result) | append only; written by the gate job (service role `INSERT` only) |
| `competition_weekly_checks` (new) | `id uuid pk`, `competition_id fk`, `as_of date not null`, `state_at_check` enum, `hit_rate numeric(4,1) null`, `graded_picks int not null`, `benchmark_rate numeric(4,1) null`, `ready_to_promote boolean not null`, `underperforming boolean not null`, `alerted boolean not null` | unique `(competition_id, as_of)`; append only; written by the shadow report job |
| `fixtures` (changed) | `competition_id uuid not null fk competitions` replaces the free text `competition`; `provider_round text null`; `provider_season int not null` | index on `(competition_id, kickoff_wat)` |
| `fixture_reports` (extended) | `visibility` enum (`SHADOW`, `PUBLISHED`) not null | index on `(slate_date, visibility)`; check `visibility = 'PUBLISHED' or is_free_preview = false` |

Row level security: client roles read `competitions` only for rows that are `LIVE` or have published reports. `fixture_reports` and `fixtures` policies for client roles require a `PUBLISHED` report. The gate and weekly check tables are service role only.

**State transitions** (`competitions.state`, every move is a migration and applies from the next 06:00 run):
- `OFF` → `SHADOW` once the latest gate check is `PASSED` (sets a new `shadow_started_at`)
- `SHADOW` → `LIVE` once the weekly check marks it ready (sets `live_since`)
- `LIVE` → `SHADOW` or `OFF`, and `SHADOW` → `OFF`, whenever you decide. History stays (AC-12).

**API surface**:
| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/v1/competitions` | GET | none | `competitions[]: {id, name, country, type, active}` | public, `Cache-Control: public, max-age=300`, rate limited | 429 |

The slate, fixture, live and ledger endpoints keep their shapes. They add `competition: {id, name, country}` per fixture and read through the shared published only function. The ledger gains an optional `competition_id` filter.

**Value sourcing**:
| Action | Value produced / displayed | Source |
|---|---|---|
| Seed migration | provider league ids, names, countries | looked up once at build time from API-Football's leagues endpoint, recorded in the migration; not found means left out and logged |
| Seed migration | phase, priority, type, start rank, shadow days, min picks | the seed list above |
| Season migration | round order per cup season | the provider's round names for that season, written each new season before the cup starts |
| Gate job | coverage flags, declared season | API-Football leagues endpoint `coverage` for the most recent declared season |
| Gate job | completed seasons | API-Football fixtures for the two prior seasons with a finished status |
| Gate job | tournament replay | stats engine run over the previous edition's finished fixtures, no LLM |
| Gate job | name and country match | API-Football leagues endpoint by `provider_league_id` |
| Pipeline | which competitions | `competitions.state` |
| Pipeline | `slate_date` | WAT calendar date of `fixtures.kickoff_wat` |
| Pipeline | cup eligibility | rank of `fixtures.provider_round` in `competition_seasons.round_order` compared with `cup_start_rank` |
| Pipeline | national team eligibility | per team competitive match counts from API-Football fixtures by team for three years, friendlies league ids excluded, cached in Redis for 7 days |
| Pipeline | caps, order | `SLATE_MAX_FIXTURES`, `SHADOW_MAX_FIXTURES`; `priority`, kickoff, provider fixture id |
| Preview selection | which fixtures can be previews | `PUBLISHED` reports after the cap |
| Weekly checks | hit rate, graded picks | derived from graded primary picks (definition above) at the check, then stored in `competition_weekly_checks` |
| Weekly checks | benchmark | per the definition above |
| Weekly checks | thresholds | `SHADOW_MAX_GAP_POINTS`, `UNDERPERFORM_*`, per row `shadow_days` and `min_shadow_picks` |
| Underperformance alert | consecutive weeks, already alerted | the latest `competition_weekly_checks` rows for that competition |
| Competitions endpoint | list, `active` | `competitions` joined to the existence of published reports |

**Key invariants**:
- No shadow report, pick, fixture or count ever reaches a client, for any tier.
- The app can't change a competition's state; the database refuses it.
- A published slate never exceeds `SLATE_MAX_FIXTURES` fixtures, its membership is frozen after 06:00, and dropped fixtures cost no LLM calls.
- Shadow and published picks are graded by the same settlement code.
- A competition is never promoted while the benchmark is undefined.
- Demotion never removes published history.

**Security model**:
- Shadow data is internal: one shared published only read function plus client facing RLS, the same way locked data is stripped today.
- Competition state changes go through code review and are enforced by database grants, because they decide what the public ledger contains.
- `GET /api/v1/competitions` returns public facts only and is rate limited. No personal data is involved.

**Configuration** (code constants in `app/knowledge/coverage.py`, changed by reviewed code like state, not env): `SLATE_MAX_FIXTURES` 40, `SHADOW_MAX_FIXTURES` 20, `SHADOW_MAX_GAP_POINTS` 5, `UNDERPERFORM_GAP_POINTS` 8, `UNDERPERFORM_MIN_PICKS` 20, `UNDERPERFORM_WEEKS` 4, `NATIONAL_TEAM_MIN_MATCHES` 15, `CORE_MIN_PICKS` 100, `CORE_MIN_COMPETITIONS` 3. No new env.

**Football API budget**: the gate job uses about 3 requests per competition per week (about 165 for the full list), plus about 3 per national team during qualifier windows (several hundred a window, cut by the 7 day cache). It runs through the shared adapter counter (spec 0002 AC-13) and skips this week's run if the remaining requests would drop below the reserve. Shadow fixtures add their normal ingestion and sweep requests, and no live polling.

**Critical test scenarios**:
- Happy path: a competition passes the gate, a migration moves it to `SHADOW`, its reports are saved as `SHADOW`, the sweep grades them, the weekly check marks it ready after 28 days and 30 picks within 5 points of the benchmark, and a migration makes it `LIVE` from the next run, verifies **AC-2**, **AC-3**, **AC-4**, **AC-8**, **AC-10**
- Grant: the service role's `UPDATE competitions SET state` fails with a permission error, verifies **AC-2**
- Leak check: with shadow fixtures present, every public endpoint, the sitemap and `locked_count` show nothing of them for guest, free and premium viewers (payload inspected), verifies **AC-6**, **AC-7**
- No benchmark: before launch with fewer than 30 Big Five shadow picks graded, nothing is marked ready, verifies **AC-10**, **AC-16**
- Gate fails: a league with no line up coverage gets a `FAILED` check with the reason and stays `OFF`; a `LIVE` league failing raises an alert and stays `LIVE`, verifies **AC-3**
- National teams: a qualifier where one team has 12 competitive matches skips only that team's fixtures, verifies **AC-9b**
- Cap and order: a Saturday with 70 live fixtures publishes 40 by priority then kickoff, the other 30 get no LLM call, and previews are chosen only from the 40, verifies **AC-4**, **AC-7**
- Frozen slate: a fixture rescheduled into today at 12:00 is not added, and a postponed one keeps its place, verifies **AC-5**
- Cups: an FA Cup third round fixture is ignored, a round of 32 fixture is included, and an unknown round name is excluded with an alert, verifies **AC-9**
- Underperformance: a live league 9 points below at four checks in a row raises one alert, none at the fifth, and a new one only after recovering and sliding again, verifies **AC-11**
- Demotion: a demoted league's published picks still appear in the ledger and its competition still appears in `/competitions` with `active: false`, verifies **AC-12**, **AC-13**
- Id drift: a stored provider id that now returns a different name raises an alert, verifies **AC-15**

## Build plan

Tracer Bullet: thread one competition end to end through gate, shadow and live first, then widen the list.

1. Migration: the `competitions`, `competition_seasons`, `competition_gate_checks` and `competition_weekly_checks` tables with checks, grants and RLS; `fixtures.competition_id`, `provider_round` and `provider_season`; `fixture_reports.visibility` with its preview check; seed the Big Five rows, mirrored by SQLAlchemy models, satisfies **AC-1**, **AC-2**, **AC-14**
2. Thin thread with the Premier League: the gate job for one league, the pipeline order with state and visibility, the shared published only read function, client RLS, settlement of both visibilities, and the grant and leak tests, satisfies **AC-3**, **AC-4**, **AC-6**, **AC-7**, **AC-8**
3. Weekly checks: the benchmark, the shadow report and the underperformance alert with their stored rows, wired to the alert hook, satisfies **AC-10**, **AC-11**
4. Slate rules: caps, the frozen slate, cup rounds by season and national team eligibility, satisfies **AC-4**, **AC-5**, **AC-9**, **AC-9b**
5. Widen coverage: seed the rest of Phase 1, Phase 2, Phase 3 and the tournaments (ids, seasons, round orders), the tournament replay, the id drift check, `GET /api/v1/competitions`, competition fields on replies, and the demotion rules, satisfies **AC-1**, **AC-3**, **AC-10**, **AC-12**, **AC-13**, **AC-15**
6. Pre launch proving: move the Phase 1 competitions that pass the gate to `SHADOW` at least four weeks before launch, satisfies **AC-16**

## Consequences

**Positive**:
- SignalXI covers the competitions Nigerian bettors actually bet on, including midweek, summer and African fixtures.
- A weak data source can't quietly damage the public ledger: it has to prove itself in private first, against a benchmark that is always defined or blocks promotion.
- Every coverage change is a reviewed migration, enforced by the database, with a git history.
- The cap and the frozen morning slate keep the daily LLM bill and the slate predictable.

**Negative / tradeoffs**:
- Adding a league takes at least four weeks (two for tournaments), which is slow when a new season starts.
- Shadow mode spends LLM calls and API requests on picks nobody sees (up to 20 fixtures a day).
- Busy days drop lower priority fixtures, and a fixture rescheduled into today is never added.
- Switching a league needs an engineer to write a migration, and each new cup season needs a round order migration.
- The gate job and national team checks add football API requests, which share the plan budget with spec 0002.
- The tournament replay skips the LLM step, so small tournaments are proven on less evidence than leagues.

**Neutral**:
- The PRD's free text `competition` column becomes a foreign key, which the data model feature (#3) must adopt.
- Phase 3's strong home advantage is handled by the statistical engine fitting home advantage per competition (a contract for #7), not by special rules here.
- Spec 0002's live job polls only fixtures with a `PUBLISHED` report (updated there).

## Follow-up

- [ ] Contracts for unspecced features: the data model (#3) adopts the tables and columns above; the statistical engine (#7) fits home advantage per competition and supports the tournament replay; the daily pipeline (#5, #8) follows the AC-4 order; settlement (#13) grades both visibilities; the ledger page (#14) adds the competition filter and per competition hit rates using the definition above; the paywall (#17) reads through the shared published only function; SEO (#23) excludes shadow fixtures.
- [ ] Update PRD §5.1's competition list to point to this spec (your document; not edited here).
- [ ] Check that the API-Football plan's daily budget covers the wider coverage, the gate job and spec 0002's live polling before Phase 2.
- [ ] Later, an admin screen with audit logging could replace migrations for state changes.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
