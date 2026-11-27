# 0003. In play prediction shifts

**Date**: 2026-11-27
**Status**: Proposed

## Summary

While a match is running, SignalXI will show how each published pick's outlook has moved since kickoff, as a live label with an arrow (for example "Live: Strong → Moderate ↓"). The scheduler worker works this out once a minute with plain statistics (a minute by minute goal model fed by the live score, time left and red cards), with no LLM, so it stays cheap, fast and grounded in real numbers. Shifts are prediction data, so they follow the existing paywall, and they are never graded: the ledger still grades only the pick published before kickoff. Depends on spec 0002 for the live data, and needs a legal review before it is switched on.

## Requirements

**User stories**:
- As a premium bettor, I want to see whether a pick's outlook has improved or worsened during the match so that I understand how the game is treating it.
- As a guest, I want to see live shifts on my free preview cards so that I can judge the value of upgrading.
- As a bettor who checks the ledger, I want live shifts kept apart from graded picks so that the public accuracy record stays honest.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):
- **AC-1**: The daily slate pipeline saves, for every published pick, `prediction_picks.model_probability` (the statistical engine's chance for that market, 0 to 1). For every fixture report it saves `fixture_reports.model_inputs` (the pre match goal rates the engine used). The engine produces a chance for every market enum in PRD §3.2. A pick with no `model_probability`, or a fixture with no `model_inputs`, gets no live shifts.
- **AC-2**: On every live poll (spec 0002), for every active pick of a live slate fixture, the worker computes a live chance with the deterministic in play model from the fixture's status, minute, extra minute, current and half time score, and its stored events in order (goals and red cards per side, so "led by one at any point" and "scored in both halves" can be rebuilt from scratch on every poll), plus `model_inputs`. No LLM call is made, and the same inputs always give the same chance. The chance reflects the real situation now, including time running out: a goalless game lowers Over picks and raises Under picks.
- **AC-3**: Labels are ranked Strong Candidate (index 2), Moderate Candidate (1) and High Risk (Avoid) (0). With `delta = live chance − model_probability` in percentage points, `steps = trunc(delta / SHIFT_STEP_POINTS)` (rounded toward zero, `SHIFT_STEP_POINTS` = 15) clamped to −2 to +2. The live label is the published index plus `steps`, clamped to 0 to 2, so a High Risk (Avoid) pick can only move up and a Strong pick can only move down. Hysteresis: once a label sits `k` steps away, it only moves back towards the published label when `|delta|` falls below `k × SHIFT_STEP_POINTS − SHIFT_HYSTERESIS_POINTS` (3). At kickoff `delta` is 0, so the live label equals the published label. Picks published as Insufficient Data get no shifts.
- **AC-4**: The direction compares the live label with the published label: `DOWN` when lower, `UP` when higher, `FLAT` when equal.
- **AC-5**: A pick becomes `DECIDED` only when the actual score or events settle it. Either its winning condition is already met and can't be undone (Over 1.5 with 2 goals, a 1UP market after the team led by one), its losing condition is met (BTTS No once both teams score), or its market's period has ended per the market rules table (for example a first half market once the status leaves `LIVE_1H`). The model running out of minutes never marks a pick decided. A decided pick stops shifting, shows "Decided in play, awaiting settlement", and shows no won or lost wording.
- **AC-6**: When normal time ends (status leaves `LIVE_2H` for `EXTRA_TIME`, `PENALTIES` or `FINISHED`), or the fixture is `ABANDONED`, every pick of that fixture becomes `DECIDED`. The live score keeps updating through extra time and penalties.
- **AC-7**: When the fixture's live data is stale (spec 0002 AC-11), every active pick's state becomes `STALE` and it shows Insufficient Data with "Last updated N min ago". Once fresh data arrives it returns to `ACTIVE`, recomputed with hysteresis continuing from its last `ACTIVE` label.
- **AC-8**: A `pick_live_outlooks` row is written only when a pick's live label or state changes, never on every poll. The first row is written on the first poll that sees the fixture in `LIVE_1H`, with the published label, `FLAT`, `ACTIVE`, and that poll's minute. A unique key on `(pick_id, minute, state, live_classification)` stops a restart from writing the same row twice.
- **AC-9**: Settlement and the ledger never read `pick_live_outlooks` or live labels. The headline accuracy rate and the market section breakdown grade only the picks published before kickoff.
- **AC-10**: Live shift fields appear in a reply only for fixtures unlocked for the viewer: premium members get them for every slate fixture, while guests and free members get them only for that slate's free preview fixtures (`is_free_preview`). For locked fixtures, no shift field (label, direction, state, chance, pick id) appears anywhere in any payload. For unlocked fixtures, `pick_id` is the same id the slate API uses for that pick. Spec 0002's per viewer ETag and private caching rules apply to every reply that carries shifts.
- **AC-11**: The slate card shows the primary pick's live label and arrow next to the published badge, which stays visible and unchanged. The drawer's market tabs show each alternative's live label the same way. Each live label is marked "Live" so it can't be mistaken for the published label, uses text and an arrow (not colour alone), and meets WCAG AA in both themes. The live chance itself is never shown.
- **AC-12**: Every surface that shows live shifts also shows the shared `LIVE_DISCLAIMER` ("Informational, not a live betting signal.", owned by spec 0002) next to the 18+ disclosure, plus "Live labels reflect the score, the time left and red cards."
- **AC-13**: With `IN_PLAY_SHIFTS_ENABLED` false (or `LIVE_UPDATES_ENABLED` false), the worker computes no shifts, no outlook rows are written, and no shift fields appear in any reply. The flag stays false in production until the legal and consent review (#22) has approved the live shift copy.

## Decision

**Chosen option**: Option 1: Deterministic minute by minute model in the worker, labels moved relative to the published pick.

The worker reruns a pure, seedless goal model for every published pick on each live poll, maps the change in chance onto the existing four labels starting from the published label, stores a snapshot only when the label or state changes, and the presenter serves shifts behind the existing paywall.

**Implementation skills**: `fastapi` (`fastapi/fastapi`, `.claude/skills/fastapi/`) · `pydantic` (`pydantic/skills`, `.claude/skills/pydantic/`) · `python-backend` (`yonatangross/orchestkit`, `.claude/skills/python-backend/`) · `redis-core` (`redis/agent-skills`, `.claude/skills/redis-core/`) · `tanstack-query` (`tanstack-skills/tanstack-skills`, `.claude/skills/tanstack-query/`) · `supabase-postgres-best-practices` (`supabase/agent-skills`, `.claude/skills/supabase-postgres-best-practices/`)

## Feature design

**Data model sketch** (additions to the PRD §9 schema and spec 0002):

| Entity | Fields | Rules |
|---|---|---|
| `prediction_picks` (extended) | `model_probability numeric(5,4) null` | Written once by the slate pipeline at publish; never updated |
| `fixture_reports` (extended) | `model_inputs jsonb null`: `{home_goal_rate, away_goal_rate, first_half_share}` (expected goals per 90 minutes for each side, and the share of goals expected in the first half) | Written once at publish; never updated |
| `pick_live_outlooks` (new) | `id uuid pk`, `pick_id uuid not null fk prediction_picks`, `minute int not null`, `live_probability numeric(5,4) not null` (stored for auditing, never shown), `live_classification` (existing enum), `direction` enum (`UP`, `DOWN`, `FLAT`), `state` enum (`ACTIVE`, `DECIDED`, `STALE`), `created_at timestamptz not null default now()` | prediction_picks 1:N; unique `(pick_id, minute, state, live_classification)`; index on `(pick_id, created_at)`; append only; kept permanently |
| Redis `live:fixture:{fixture_id}` (from 0002) | gains `outlooks: {pick_id: {live_classification, published_classification, direction, state, last_active_classification}}` | Worker writes; the presenter decides what each viewer gets |

Row level security: `pick_live_outlooks` is readable only by the backend service role, the same as `prediction_picks`. No client reads it directly.

**State transitions** (a pick's live outlook):
- (none) → `ACTIVE` on the first poll in `LIVE_1H`
- `ACTIVE` → `STALE` when the fixture's data goes stale; `STALE` → `ACTIVE` on fresh data
- `ACTIVE` or `STALE` → `DECIDED` when the score settles it (AC-5), normal time ends, or the fixture is abandoned (AC-6)
- `DECIDED` is terminal

**Market rules table** (in `app/knowledge/`, one entry for every PRD §3.2 market enum, enforced by a unit test that fails if any enum is missing): for each market, its period (full match, first half, second half), its winning, losing and void conditions on the score path, and its decided predicate. Draw No Bet markets use the chance of winning given that it isn't a draw (a draw refunds the bet), and are only decided at full time. 1UP markets win once the team has led by one at any point. Under markets (`UNDER_3_5_GOALS`, `UNDER_4_5_GOALS`) are decided as lost once total goals pass the line, and are otherwise only decided at full time.

**In play model** (pure, in `app/services/statistical_engine.py`, vectorised with numpy; no I/O, "now" and all inputs passed in):
- A minute by minute Markov chain (a step by step probability table) from the current minute to the end of normal time. Each half gets expected stoppage minutes (`STOPPAGE_1H_MIN` 2, `STOPPAGE_2H_MIN` 4), so 45+3 or 90+3 still has scoring time left.
- Each minute, each side scores with probability `rate / 90`, weighted by `first_half_share` for the half being played, multiplied by `RED_CARD_OWN_FACTOR` (0.75) per red card it has and `RED_CARD_OPPONENT_FACTOR` (1.15) per red card the other side has. Red cards rescinded by VAR are already removed from the events (spec 0002 AC-4) and don't count.
- The state tracks goals per side per half and whether each side has led by one at any point, rebuilt from the ordered events on every poll. Goals are capped at `MAX_GOALS_PER_SIDE_PER_HALF` (5), with the cap's tail folded into the top cell.
- Constants live in `app/knowledge/`, not env.

**API surface** (adds fields to the two spec 0002 endpoints; no new endpoints):
| Endpoint | Method | Key inputs | Added outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/v1/live/slate` | GET | as in 0002 | per fixture `primary_outlook: {pick_id, published_classification, live_classification, direction, state}`, only when the fixture is unlocked for the viewer, otherwise the key is absent | public; bearer token decides tier | as in 0002 |
| `/api/v1/live/fixtures/{fixture_id}` | GET | as in 0002 | `outlooks[]: {pick_id, section, market, published_classification, live_classification, direction, state}`, only when unlocked, otherwise absent | public; bearer decides tier | as in 0002 |

**Value sourcing**:
| Action | Value produced / displayed | Source |
|---|---|---|
| Live model: pre match chance | `model_probability` | `prediction_picks.model_probability`, written by the slate pipeline from the statistical engine |
| Live model: goal rates, half split | rates, share | `fixture_reports.model_inputs`, written by the slate pipeline |
| Live model: status, minute, extra minute, scores | live state | Redis `live:fixture:{id}` (spec 0002) |
| Live model: goal and red card path per side | ordered events | `fixture_events` (spec 0002), ordered by minute and extra minute |
| Live model: stoppage, factors, goal cap | constants | `app/knowledge/` |
| Live model: what a market needs | win, lose, void, period, decided rule | the market rules table in `app/knowledge/` |
| Live label | `live_classification` | derived per AC-3 from the published index, `delta`, `SHIFT_STEP_POINTS`, `SHIFT_HYSTERESIS_POINTS` and the last active label |
| Last active label (hysteresis memory) | label | Redis `outlooks[pick_id].last_active_classification`, else the latest `ACTIVE` row in `pick_live_outlooks`, else the published label |
| Published label shown beside it | `published_classification` | `prediction_picks.classification` |
| Direction | `direction` | derived: live label compared with the published label |
| State | `state` | derived: AC-5 market rules, AC-6 status, spec 0002 `stale` |
| Snapshot minute | `minute` | Redis live state |
| Pick id in replies | `pick_id` | `prediction_picks.id`, the same id the slate API exposes for unlocked picks |
| Viewer tier | guest, free or premium | JWT plus the subscription check (server side paywall spec, #17) |
| Unlocked fixture for non premium | yes or no | `fixture_reports.is_free_preview` |

**Key invariants**:
- No LLM call ever produces or explains a live shift.
- At kickoff, every live label equals its published label.
- The live chance is never sent to any client.
- Shift fields, including pick ids, never appear for a fixture locked to the viewer, in any endpoint.
- A pick is decided only by the score path or the end of its period, never by the model's clock.
- `pick_live_outlooks` is append only and is never read by settlement or the ledger.
- A `DECIDED` pick never changes again.

**Security model**:
- Live shifts are prediction data under the hard server side paywall: the presenter strips them for locked fixtures, exactly as it strips `primary_prediction` and `market_sections` (PRD §10.1).
- Replies that carry shifts are private, per viewer ETagged and never stored by shared caches (spec 0002 AC-9).
- Only the scheduler worker computes and writes shifts (service role). There are no client writes.
- Live endpoints keep spec 0002's rate limits. No personal data is involved.

**Configuration required** (backend, read in `app/core/config.py`):
- `IN_PLAY_SHIFTS_ENABLED`: turns shift computation and shift fields on (default `false`; it has no effect unless `LIVE_UPDATES_ENABLED` is on; it stays off in production until the legal review in AC-13)

**Critical test scenarios**:
- Happy path: a Strong "Over 1.5 goals" pick, 0 to 0 at 60', drifts to Moderate ↓ as time runs out, a row is written on the change only, then a goal brings it back once past the hysteresis margin, verifies **AC-2**, **AC-3**, **AC-4**, **AC-8**
- Kickoff: the first outlook, written on the first `LIVE_1H` poll, equals the published label with `FLAT`, verifies **AC-3**, **AC-8**
- Decided by score: Over 1.5 at 2 to 0 becomes `DECIDED` with "Decided in play, awaiting settlement" and no won wording; a first half market freezes when the status leaves `LIVE_1H`, verifies **AC-5**
- Not decided by the clock: Over 1.5 at 0 to 0 at 90+3 stays `ACTIVE` with a small but non zero chance, verifies **AC-5**
- Draw No Bet: a level score gives a chance based on win given no draw, and the pick isn't decided before full time, verifies **AC-5**
- Market coverage: the unit test fails if any PRD §3.2 market enum lacks a rules table entry, verifies **AC-1**, **AC-5**
- Extra time: a cup tie goes to extra time and every pick freezes at the end of normal time while the score keeps updating, verifies **AC-6**
- Stale: the API is silent for 4 minutes, active picks show Insufficient Data, then recover from their last active label, verifies **AC-7**
- Restart: the worker restarts and Redis is flushed mid match; the path state is rebuilt from events, hysteresis resumes from the latest active row, and no duplicate outlook rows appear, verifies **AC-2**, **AC-7**, **AC-8**
- Red card: a home red card at 30' lowers a "Home Win" chance compared with the same match without it; a red card rescinded by VAR has no effect, verifies **AC-2**
- Determinism and speed: the model run twice on identical inputs returns identical chances, and one pick at minute 1 computes in under 50 ms, verifies **AC-2**
- Paywall: a guest gets `primary_outlook` for a free preview fixture and no shift keys or pick ids at all for a locked one (payload inspected), verifies **AC-10**
- Ledger: a pick whose live label went to High Risk (Avoid) but won is graded WON and counted normally, verifies **AC-9**
- Flag off: no outlooks computed or returned, verifies **AC-13**

## Build plan

Tracer Bullet: a thin real thread first (one pick on one card through every layer), then thicken.

1. Migration: `prediction_picks.model_probability`, `fixture_reports.model_inputs` and the `pick_live_outlooks` table with its unique key and RLS, mirrored by SQLAlchemy models; the slate pipeline writes both new columns at publish, satisfies **AC-1**
2. Thin thread: the market rules table and the vectorised in play model for the main and goals markets in the statistical engine, with unit tests; the worker computes the primary pick's chance on each live poll, maps label and direction, stores outlooks in Redis and a snapshot on change; the presenter adds `primary_outlook` to `/live/slate` for unlocked fixtures; the card shows "Live: <label> <arrow>" beside the published badge, satisfies **AC-2**, **AC-3**, **AC-4**, **AC-8**, **AC-10**, **AC-11**, **AC-13**
3. All markets and alternatives: complete the rules table for the half and specials markets (period ends, both halves, 1UP, Draw No Bet) with the coverage test, compute every published pick, add `outlooks[]` to `/live/fixtures/{id}` and live labels in the drawer tabs, satisfies **AC-1**, **AC-2**, **AC-5**, **AC-10**, **AC-11**
4. States: the score based decided rule, the normal time and abandoned freeze, stale handling, hysteresis memory and the restart rebuild, satisfies **AC-3**, **AC-5**, **AC-6**, **AC-7**, **AC-8**
5. Guardrails: the shared disclaimer and the "Live labels reflect…" line on every shift surface, an architecture test that settlement and ledger code never import the outlook repository, and payload tests for locked fixtures, satisfies **AC-9**, **AC-10**, **AC-12**

## Consequences

**Positive**:
- Users see how each pick is faring during the match, in the same four labels they already know.
- Shifts cost no LLM tokens and add no API calls beyond spec 0002's polling.
- The published pick and the ledger stay untouched, so the accuracy record remains trustworthy.
- Snapshots let you check later whether the live model's moves were sensible.

**Negative / tradeoffs**:
- The live model is a simplification (constant scoring rates, fixed red card and stoppage constants), so some shifts will feel wrong to experienced bettors until the constants are tuned against real matches.
- Over picks drift down and Under picks drift up in every quiet game. That reflects the real chance, but users may read it as the app losing confidence.
- Showing live outlooks during matches can nudge some users towards in play betting; the disclaimer and the legal review gate reduce but do not remove that risk.
- The slate pipeline must now persist the engine's chances and goal rates, and the engine must cover every market, which ties spec 0003 to the statistical engine's output shape.
- More worker CPU per live poll (a numpy table per pick per minute).

**Neutral**:
- Two columns are added to tables the data model feature (#3) will create; that spec should include them.
- New constants in `app/knowledge/` (`SHIFT_STEP_POINTS`, `SHIFT_HYSTERESIS_POINTS`, `RED_CARD_OWN_FACTOR`, `RED_CARD_OPPONENT_FACTOR`, `STOPPAGE_1H_MIN`, `STOPPAGE_2H_MIN`, `MAX_GOALS_PER_SIDE_PER_HALF`) are tuned in code review, not by env.

## Follow-up

- [ ] Depends on spec 0002 (live data) and on the unspecced statistical engine (#7), slate pipeline (#5, #8), data model (#3) and server side paywall (#17). Those specs must persist `model_probability` and `model_inputs`, compute a chance for every market, and keep the presenter as the single paywall gate.
- [ ] Tune the red card, stoppage and step constants against a season of real matches before turning `IN_PLAY_SHIFTS_ENABLED` on in production.
- [ ] Legal and consent (#22) must review the live shift copy for responsible gambling wording; this gates the production flag (AC-13).
- [ ] Design the live label on the card and in the drawer on the design canvas, then add it to `frontend/design.md`.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
