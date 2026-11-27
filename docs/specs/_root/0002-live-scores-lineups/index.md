# 0002. Live scores, line ups and match stats for slate fixtures

**Date**: 2026-11-27
**Status**: Proposed

## Summary

SignalXI will show live scores, key match events, confirmed line ups and match stats for every fixture on the published slate, so you can follow how predicted games are going. The scheduler worker fetches this from API-Football about once a minute, only while a slate match is live or about to start, and saves it to Redis (the fast cache) and Postgres. Phones read that saved copy every 30 seconds and never call the football API themselves, which keeps the app fast, cheap and inside the PRD's "batch served" rule. When a match ends, its picks are graded straight away instead of waiting up to two hours.

## Requirements

**User stories**:
- As a bettor watching my picks, I want to see the live score and minute on each slate card so that I know at a glance how predicted games are going.
- As a bettor, I want a Live tab in the match drawer with goals, red cards, line ups and stats so that I understand what is happening in a match.
- As a guest, I want live scores without signing in so that SignalXI is useful even before I pay.
- As a bettor, I want finished matches graded quickly so that the ledger reflects results within minutes.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):
- **AC-1**: A slate fixture's live window runs from `LIVE_WINDOW_LEAD_MIN` minutes before its kickoff until it is `FINISHED`, `ABANDONED` or `POSTPONED`, or `LIVE_WINDOW_TAIL_MIN` minutes after kickoff, whichever comes first. While any window is open, the worker calls API-Football's `fixtures?ids=` endpoint (never `live=all`) with the external ids of the open window fixtures, up to 20 per request, once every `LIVE_POLL_INTERVAL_S` seconds (default 60). `SUSPENDED` fixtures keep being polled. When no window is open, it makes zero calls. If the tail passes while a fixture is still in a live status, the job stops polling it, the fixture shows as stale (AC-11), and the 2 hour settlement sweep handles it.
- **AC-2**: Only fixtures on a published slate (a `fixture_reports` row with `visibility = PUBLISHED` for that fixture and slate date, per spec 0004) receive live data, because only their ids are requested. Shadow fixtures are never polled.
- **AC-3**: Each successful poll writes the live view for every polled fixture to Redis key `live:fixture:{fixture_id}` (status, minute, extra minute, score, half time score, events, line ups, stats, `updated_at`; TTL 4 hours). `updated_at` is the time of the last successful poll. In Postgres, `fixtures.status`, the half time and full time scores and `live_updated_at` (the time of the last real change) are written only when a value changes, never on every poll. `live_updated_at` is never used to decide staleness.
- **AC-4**: Goals, own goals, penalty goals, missed penalties, red cards and VAR decisions are stored in `fixture_events`. On each poll, the job compares the fixture's stored events with the provider's current list by `external_event_key`: new keys are inserted, changed ones (a corrected minute, player or detail) are updated in place, and keys the provider no longer returns are deleted. A goal cancelled by VAR lowers the shown score and keeps the goal row with its `detail` updated (for example "Goal cancelled"). A red card rescinded by VAR is removed the same way and no longer counts.
- **AC-5**: Line ups are read from the same `fixtures?ids=` reply (or the per fixture line ups endpoint if the reply has none) every `LINEUP_POLL_INTERVAL_S` seconds (default 300), from the window opening until both sides are stored. They are refreshed once more at kickoff, and checking stops 15 minutes after kickoff. Before they exist, the Live tab says "Line ups not confirmed yet". If none appear by then, it says "Line ups not available".
- **AC-6**: Shots, shots on target, possession and xG (expected goals, the quality of chances created) are read from the same reply's statistics and stored as one `fixture_stats` row per side, overwritten with the latest reading. Possession is parsed from the provider's percentage text ("55%") to an integer. xG comes from the provider's `expected_goals` statistic. A stat the provider does not return is stored as null and shown as "Not available", never as 0.
- **AC-7**: `GET /api/v1/live/slate?date=YYYY-MM-DD` takes the slate date (`fixture_reports.slate_date`) the app already holds, so a match that runs past midnight stays on its slate. For every fixture on that slate it returns status, minute, extra minute, score, `age_s` (seconds since `updated_at`, computed on the server) and `stale`, plus top level `window_open` (whether any of the slate's windows is open) and `next_poll_s` (seconds until the app should ask again). It is public (guests included) and never contains prediction data for fixtures locked to the viewer (spec 0003 adds the only prediction fields, behind the paywall).
- **AC-8**: `GET /api/v1/live/fixtures/{fixture_id}` returns the fixture's status, minute, score, half time score, `age_s`, `stale`, events (in minute order), line ups (or null) and stats (or null). It returns 404 for a fixture not on any published slate.
- **AC-9**: Both live endpoints read only Redis (falling back to Postgres when the Redis key is missing, which returns status, scores, events, line ups and stats without minute, with `stale: true`) and never call API-Football or the LLM. Each reply's `ETag` is a hash of that viewer's own serialised body. Replies carry `Cache-Control: private, no-store` for shared caches and `Vary: Authorization`, so no CDN or shared cache ever stores them, and a `304 Not Modified` is only sent when that viewer's body is unchanged. Rate limits: `LIVE_RATE_LIMIT_GUEST_PER_MIN` (600) per IP for guests, because many users share carrier IPs, and `LIVE_RATE_LIMIT_USER_PER_MIN` (120) per user when signed in. Beyond that, the reply is 429 with the standard error body.
- **AC-10**: A slate card shows a live badge (minute plus score, or HT, or FT plus final score) when its fixture is live or finished, and nothing extra before kickoff. The match drawer gains a Live tab with an events timeline, both line ups and the stats. While the page is visible and `window_open` is true, the app polls `/live/slate` every 30 seconds. It polls `/live/fixtures/{id}` every 30 seconds only while that fixture's Live tab is open. When `window_open` is false, it waits `next_poll_s` (or stops if none is given), and it never polls from a hidden tab.
- **AC-11**: A fixture is stale when its status is live (`LIVE_1H`, `HALF_TIME`, `LIVE_2H`, `EXTRA_TIME`, `PENALTIES`, `SUSPENDED`) and `age_s` exceeds `LIVE_STALE_AFTER_S` (default 180), or when kickoff passed more than `LIVE_STALE_AFTER_S` seconds ago and the status is still `SCHEDULED`. Scheduled, finished, postponed and abandoned fixtures are never stale. When stale, the UI shows "Last updated N min ago" (N from `age_s`) next to the badge and in the Live tab.
- **AC-12**: Whenever a poll sees a fixture as `FINISHED` and any of its picks are still `PENDING`, the live job calls settlement for that fixture. Settlement is idempotent (grading twice changes nothing), so a crash or retry is safe, and the 2 hour settlement sweep stays as the safety net.
- **AC-13**: API-Football requests are budgeted per provider day (the plan resets at 00:00 UTC). Before each live request, the job checks the remaining requests (the provider's remaining requests header from the last reply, else `API_FOOTBALL_DAILY_REQUEST_BUDGET` minus the Redis day counter). If that would leave fewer than `API_FOOTBALL_RESERVED_REQUESTS` for the slate job, pre kickoff refresh and settlement, it stops live polling until the next provider day, every live fixture goes stale (AC-11), and a pipeline alert is raised (feature #25).
- **AC-14**: The live job runs as its own task inside the existing scheduler worker process. The process wide run lock means it never runs twice. It runs alongside the 06:00 slate job and settlement without delaying them, and each tick has a `LIVE_TICK_TIMEOUT_S` (20 second) limit so a hanging API call never blocks the next tick. After a worker restart or a Redis flush mid match, the next tick rebuilds the Redis live views from Postgres plus a fresh poll, with no duplicate events.
- **AC-15**: Postponed, suspended and abandoned fixtures show that status on the card and in the Live tab. Polling stops for postponed and abandoned fixtures.
- **AC-16**: The Live tab shows the 18+ disclosure and the shared `LIVE_DISCLAIMER` text "Informational, not a live betting signal." The live badge never relies on colour alone, the ticking minute is not announced to screen readers (no `aria-live` on it), a score change is announced politely once, and everything meets WCAG AA in both themes.
- **AC-17**: With `LIVE_UPDATES_ENABLED` false, the worker makes no live or line up calls, both endpoints return `{ "enabled": false }` with no fixture data, and the app shows no live badge or Live tab.

## Decision

**Chosen option**: Option 1: Worker polls API-Football into Redis and Postgres; the app polls a cached endpoint.

A single live job in the scheduler worker fetches live data for slate fixtures by id about once a minute during live windows, stores it, hands finished matches to settlement, and the app reads it through two small, private, rate limited endpoints polled every 30 seconds.

**Implementation skills**: `fastapi` (`fastapi/fastapi`, `.claude/skills/fastapi/`) · `pydantic` (`pydantic/skills`, `.claude/skills/pydantic/`) · `python-backend` (`yonatangross/orchestkit`, `.claude/skills/python-backend/`) · `redis-core` (`redis/agent-skills`, `.claude/skills/redis-core/`) · `redis-connections` (`redis/agent-skills`, `.claude/skills/redis-connections/`) · `tanstack-query` (`tanstack-skills/tanstack-skills`, `.claude/skills/tanstack-query/`) · `supabase-postgres-best-practices` (`supabase/agent-skills`, `.claude/skills/supabase-postgres-best-practices/`)

## Feature design

**Data model sketch** (additions to the PRD §9 schema; the base tables come from the data model feature, #3):

| Entity | Fields | Rules |
|---|---|---|
| `fixtures` (extended) | `status` enum gains `LIVE_1H`, `HALF_TIME`, `LIVE_2H`, `EXTRA_TIME`, `PENALTIES`, `ABANDONED`, `SUSPENDED` (keeps `SCHEDULED`, `FINISHED`, `POSTPONED`); existing `ht_home_score`, `ht_away_score`, `ft_home_score`, `ft_away_score`; new `live_updated_at timestamptz null` (time of the last real change) | Written only when a value changes |
| `fixture_events` (new) | `id uuid pk`, `fixture_id uuid not null fk fixtures`, `external_event_key text not null unique`, `type` enum (`GOAL`, `OWN_GOAL`, `PENALTY_GOAL`, `MISSED_PENALTY`, `RED_CARD`, `VAR`), `side` enum (`HOME`, `AWAY`), `minute int not null`, `extra_minute int null`, `player_name text null` (VAR events may have none), `assist_name text null`, `detail text null`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()` | fixtures 1:N; index on `(fixture_id, minute, extra_minute)`; reconciled per poll (AC-4) |
| `fixture_lineups` (new) | `id uuid pk`, `fixture_id uuid not null fk`, `side` enum, `formation text null`, `coach_name text null`, `starting_xi jsonb not null` (array of `{name, number, position}`), `substitutes jsonb not null`, `confirmed_at timestamptz not null` | unique `(fixture_id, side)`; upserted |
| `fixture_stats` (new) | `id uuid pk`, `fixture_id uuid not null fk`, `side` enum, `shots int null`, `shots_on_target int null`, `possession_pct int null` (0 to 100), `xg numeric(4,2) null`, `updated_at timestamptz not null` | unique `(fixture_id, side)`; upserted |
| Redis `live:fixture:{fixture_id}` | JSON: `status`, `minute`, `extra_minute`, `home_score`, `away_score`, `ht_home_score`, `ht_away_score`, `events[]`, `lineups`, `stats`, `updated_at` (last successful poll) | Worker writes, API reads; TTL 4 hours |
| Redis `football_api:requests:{YYYY-MM-DD}` (UTC provider day) | integer counter | Incremented by the football API adapter on every call, from all jobs; TTL 48 hours |

The slate summary is built on read: one `MGET` (a single Redis call fetching several keys) of the slate's `live:fixture:*` keys. There's no second slate key to keep in sync. All tables keep rows permanently. Row level security: `fixture_events`, `fixture_lineups` and `fixture_stats` are public facts; only the backend service role writes them, and clients read them only through the API.

**State transitions** (`fixtures.status`, mapped in the football API adapter from API-Football's short codes):
- `SCHEDULED` (NS, TBD) → `LIVE_1H` (1H) → `HALF_TIME` (HT) → `LIVE_2H` (2H) → `FINISHED` (FT)
- `LIVE_2H` → `EXTRA_TIME` (ET, BT) → `PENALTIES` (P) → `FINISHED` (AET, PEN)
- any live state → `SUSPENDED` (SUSP, INT) → back to the live state it left, or `ABANDONED` (ABD)
- `SCHEDULED` → `POSTPONED` (PST, CANC)
- `FINISHED`, `ABANDONED` and `POSTPONED` are terminal for the live job. An unknown code is logged and leaves the status unchanged.

**API surface**:
| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/v1/live/slate` | GET | `date: YYYY-MM-DD` (req, the slate date), `If-None-Match` (opt) | `enabled`, `window_open`, `next_poll_s`, `fixtures[]: {fixture_id, status, minute, extra_minute, home_score, away_score, age_s, stale}`, `ETag` | public (guest or bearer) | 304 unchanged, 422 bad or missing date, 429 rate limited |
| `/api/v1/live/fixtures/{fixture_id}` | GET | `fixture_id: uuid` (req), `If-None-Match` (opt) | `enabled`, `fixture_id`, `status`, `minute`, `extra_minute`, `home_score`, `away_score`, `ht_home_score`, `ht_away_score`, `age_s`, `stale`, `events[]`, `lineups: {home, away} or null`, `stats: {home, away} or null`, `ETag` | public | 304, 404 not on a slate, 429 |

`fixture_id` is SignalXI's own id, the same one the slate API uses. External API ids never leave the backend.

**Value sourcing**:
| Action | Value produced / displayed | Source |
|---|---|---|
| Live job: which fixtures to poll | slate fixtures, kickoff, external id | `fixture_reports.slate_date` joined to `fixtures.kickoff_wat` and `fixtures.external_api_id` |
| Live job: is a window open | now, window bounds | "now" passed in by the scheduler; `LIVE_WINDOW_LEAD_MIN`, `LIVE_WINDOW_TAIL_MIN` |
| Live job: live status | `fixtures.status` | API-Football short status in the `fixtures?ids=` reply, mapped per the state table |
| Live job: minute, extra minute, score | live values | the `fixtures?ids=` reply |
| Live job: events, line ups, stats | rows | the same reply (per fixture line ups or statistics endpoint only when the reply lacks them) |
| Live job: event identity | `external_event_key` | derived: provider fixture id + event type + side + provider player id (or "none") + order of that combination within the match, so a corrected minute updates the same row |
| Live job: possession | `possession_pct` | provider "Ball Possession" text, parsed from "55%" |
| Live job: xG | `xg` | provider `expected_goals` statistic, else null |
| Live job: budget left | remaining requests | provider remaining requests header from the last reply, else `API_FOOTBALL_DAILY_REQUEST_BUDGET` minus the Redis UTC day counter |
| Live job: reserve | requests it may not use | `API_FOOTBALL_RESERVED_REQUESTS` |
| Live job: whether to call settlement | finished with pending picks | `fixtures.status = FINISHED` and `prediction_picks.settlement_status = PENDING` |
| Endpoints: `age_s` | seconds | derived on the server: now minus Redis `updated_at` (fallback: `live_updated_at`) |
| Endpoints: `stale` | true or false | derived per AC-11 from status, `age_s`, kickoff and `LIVE_STALE_AFTER_S` |
| Endpoints: `window_open`, `next_poll_s` | bool, seconds | derived from slate kickoffs, statuses and the window settings; `next_poll_s` is 30 while open, else seconds to the next window opening (null if none today) |
| Endpoints: slate membership for 404 | exists or not | `fixture_reports` |
| Endpoints: ETag | hash | derived: hash of the serialised reply for this viewer |
| Endpoints: rate limit key | IP or user id | request IP for guests, JWT subject when signed in |
| UI: "Last updated N min ago" | minutes | `age_s` from the reply (not the device clock) |

**Daily request estimate** (to choose the API-Football plan): about `ceil(open window fixtures / 20)` calls per minute while any window is open, so roughly 1 call × minutes with an open window (about 600 on a busy Saturday), plus at most a few line up or statistics fallback calls per fixture, plus `API_FOOTBALL_RESERVED_REQUESTS`.

**Key invariants**:
- Visitor requests never call API-Football or the LLM; only the worker does.
- One stored row per event key, at most two line ups and two stats rows per fixture.
- Postgres `fixtures` rows change only on a real value change.
- The live job never uses the reserved share of the daily API budget.
- Settlement may be called more than once for a fixture; grading twice changes nothing.
- Live replies are never stored by shared caches, and their ETag covers exactly the bytes that viewer received.
- Live endpoints never include prediction fields for fixtures locked to the viewer.

**Security model**:
- Scores, events, line ups and stats are public facts: anyone, including guests, may read them.
- Only the scheduler worker writes live data (service role). No client writes exist.
- Both endpoints are rate limited through the existing Redis sliding window limiter (600 a minute per guest IP, 120 per signed in user).
- Replies are `private` with `Vary: Authorization`, so a reply for one tier can never be cached and served to another.
- No personal data is involved. API-Football credentials stay in env, never in the database or the client.

**Configuration required** (backend, read in `app/core/config.py`):
- `LIVE_UPDATES_ENABLED`: turns the live job and endpoints on (default `false`)
- `LIVE_POLL_INTERVAL_S`: live poll interval in seconds (default `60`)
- `LIVE_TICK_TIMEOUT_S`: longest a live tick may run (default `20`)
- `LINEUP_POLL_INTERVAL_S`: line up check interval in seconds (default `300`)
- `LIVE_WINDOW_LEAD_MIN`: minutes before kickoff a window opens (default `45`)
- `LIVE_WINDOW_TAIL_MIN`: minutes after kickoff a window closes at the latest (default `180`)
- `LIVE_STALE_AFTER_S`: age after which live data counts as stale (default `180`)
- `LIVE_RATE_LIMIT_GUEST_PER_MIN`: live endpoint limit per guest IP (default `600`)
- `LIVE_RATE_LIMIT_USER_PER_MIN`: live endpoint limit per signed in user (default `120`)
- `API_FOOTBALL_DAILY_REQUEST_BUDGET`: requests per provider day allowed by the chosen plan (required when live updates are on; the plan is still to be chosen)
- `API_FOOTBALL_RESERVED_REQUESTS`: requests per day kept back for the slate job, refresh and settlement (required when live updates are on)

The frontend needs no new env: the endpoints report `enabled`, `window_open` and `next_poll_s`. `LIVE_DISCLAIMER` is one shared copy constant in `src/features/live/`.

**Critical test scenarios**:
- Happy path: a slate fixture kicks off, the worker polls by id, the card badge shows 23' and 1 to 0 within about a minute, the Live tab lists the goal, and FT triggers settlement, verifies **AC-1**, **AC-3**, **AC-4**, **AC-10**, **AC-12**
- Full time seen: a fixture moves from 2H to FT between polls and the `ids=` reply still returns it, so settlement is called, verifies **AC-1**, **AC-12**
- Event reconciliation: the provider corrects a goal's minute and then cancels it by VAR; one row remains with the new minute and "Goal cancelled", and the score drops, verifies **AC-4**
- Restart: the worker restarts and Redis is flushed mid match; the next tick rebuilds the views with no duplicate events, verifies **AC-14**
- Quiet day: no window open; zero API calls in 24 hours, verifies **AC-1**
- Budget: remaining requests reach the reserve; polling stops until 00:00 UTC, fixtures go stale, an alert fires, and the 06:00 job still runs, verifies **AC-11**, **AC-13**
- Outage: API-Football times out for 4 minutes; replies show `stale: true` and "Last updated 4 min ago" from `age_s`, even on a phone with a wrong clock, verifies **AC-11**
- Late status: kickoff passed 4 minutes ago and the status is still NS; the fixture is stale, verifies **AC-11**
- Midnight: a 23:30 WAT match is still returned by `/live/slate?date=` for its slate after 00:00, verifies **AC-7**
- Not on slate: `/live/fixtures/{id}` for a fixture with no slate report returns 404, verifies **AC-8**
- Paywall and caching: a guest and a premium user request the same fixture; their ETags differ, replies carry `Cache-Control: private` and `Vary: Authorization`, and the guest's reply has no prediction fields, verifies **AC-7**, **AC-9**
- Rate limit: the 601st guest request in a minute from one IP returns 429; a signed in user's 121st returns 429, verifies **AC-9**
- Polling: a hidden tab makes no requests; the detail endpoint is only polled with the Live tab open; with `window_open` false the app waits `next_poll_s`, verifies **AC-10**
- Flag off: no live calls and both endpoints return `enabled: false`, verifies **AC-17**

## Build plan

Tracer Bullet: the first task is a thin, real thread through every layer (worker, Redis, API, card), then later tasks thicken one strand at a time.

1. Migration for the confirmed model: the extended `fixtures` status enum plus `live_updated_at`, and the `fixture_events`, `fixture_lineups` and `fixture_stats` tables with their constraints and RLS (service role writes only), mirrored by SQLAlchemy models, satisfies **AC-3**, **AC-4**, **AC-5**, **AC-6**
2. Thin thread: add the `LIVE_*` settings and the flag; extend the football API adapter with the `fixtures?ids=` call, the status mapping and the UTC day request counter; add the live job as its own task in the scheduler worker with the tick timeout, opening windows from slate kickoffs and writing `live:fixture:*`, updating `fixtures` only on change; add `GET /api/v1/live/slate` (controller, presenter, per viewer ETag, private caching headers, rate limits, `age_s`, `window_open`, `next_poll_s`); add the live badge to the slate card with visible only polling, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-7**, **AC-9**, **AC-10**, **AC-14**, **AC-17**
3. Events and stats: reconcile events by key on each poll (including VAR cancellations and rescinded red cards), parse and upsert stats, add `GET /api/v1/live/fixtures/{id}` with its 404 and Postgres fallback, and build the drawer's Live tab (timeline and stats) with Live tab only polling, satisfies **AC-4**, **AC-6**, **AC-8**, **AC-9**, **AC-10**
4. Line ups: read line ups from the reply until both sides exist, refresh at kickoff, stop 15 minutes after, and add the line ups section with its "not confirmed yet" and "not available" states, satisfies **AC-5**
5. Failure handling: the stale rule, postponed, suspended and abandoned handling, the tail expiry hand off, the budget guard with its reserve and UTC reset, the restart rebuild, and the pipeline alert hook, satisfies **AC-1**, **AC-11**, **AC-13**, **AC-14**, **AC-15**
6. Settlement hand off: on each poll, call the settlement service for finished fixtures that still have pending picks, satisfies **AC-12**
7. Disclosures and accessibility: 18+ and `LIVE_DISCLAIMER` in the Live tab, badge text and icon (not colour only), polite score announcement, axe checks in both themes, satisfies **AC-16**

## Consequences

**Positive**:
- Users can follow predicted games inside SignalXI, which keeps them in the app and makes the ledger feel live.
- Picks are graded minutes after full time instead of up to two hours later.
- Visitor traffic stays on Redis, so live load costs no API calls and no LLM tokens, and the API budget scales with match hours, not viewers.
- Stored events, line ups and stats give Slip Audit and the stats engine verified context later.

**Negative / tradeoffs**:
- Scores lag real time by up to about 90 seconds (60 second worker poll plus 30 second app poll), behind TV and bookmaker apps.
- Live windows add steady API usage on match days (about 600 calls on a busy Saturday), so the API-Football plan must cover that plus the reserve, raising data cost.
- The scheduler worker now does continuous work on match days; a crash pauses live data for everyone until Render restarts it.
- Private, per viewer replies can't be cached by a CDN, so every poll reaches the API (cheap Redis reads, but more API instances under heavy match day load).
- Polling sends a request every 30 seconds per open tab during matches, which uses some mobile data even with 304 replies.

**Neutral**:
- `fixtures.status` gains new values that the settlement spec (#13) must handle (`ABANDONED` and `SUSPENDED`).
- The football API adapter becomes the single place that counts requests for all jobs.
- A new frontend feature folder, `src/features/live/`, holds the live types, API calls, query keys, badge, Live tab and the shared disclaimer copy.

## Follow-up

- [ ] This feature builds on decisions not specced yet: the data model (#3), pipeline orchestration and the job runner inside the worker (#5), football data ingestion (#6), the slate API and cache (#9), the slate page (#10), the fixture drawer (#11), settlement (#13), the server side paywall (#17) and pipeline health alerts (#25). Their specs must keep the contracts this spec relies on: `fixture_reports.slate_date`, `fixtures.external_api_id`, `prediction_picks.settlement_status`, an idempotent per fixture settle call, and an alert hook.
- [ ] Choose the API-Football plan from the daily request estimate above and set `API_FOOTBALL_DAILY_REQUEST_BUDGET` and `API_FOOTBALL_RESERVED_REQUESTS` before turning `LIVE_UPDATES_ENABLED` on. Confirm the plan's `fixtures?ids=` reply includes events, line ups and statistics.
- [ ] Settlement (#13) should define how `ABANDONED` and `SUSPENDED` fixtures grade (likely VOID).
- [ ] Design the Live tab and live badge on the design canvas, then add them to `frontend/design.md`.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
