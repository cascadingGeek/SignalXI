# 0005. Data model: a revisioned prediction core, billing and slip audits behind two least privilege roles

**Date**: 2026-11-27
**Status**: Proposed

## Summary

This spec defines every core table SignalXI stores in Supabase Postgres: competitions, teams, fixtures, prediction reports and picks, the grading trail, user profiles, payments, subscriptions and slip audits. Each pipeline run writes a new report revision only when its inputs actually changed. Nothing about a prediction can change after kickoff, and every grade change is logged automatically by the database, so the public ledger stays honest. The API and the scheduler worker each log in with their own database role that can touch only what it needs, and the browser can read nothing directly. You build it as three migrations plus the SQLAlchemy models and the two repository write paths the rules depend on.

## Requirements

**User stories**:
- As a bettor reading the ledger, I want every graded pick to be the one I actually saw before kickoff, so that I can trust the accuracy rate.
- As the engineer, I want a pipeline rerun or a crashed retry to never duplicate or silently rewrite a prediction, so that reruns are always safe.
- As a paying user, I want a second pass I buy to start when my current one ends, so that I never lose paid days.
- As a user who deletes my account, I want my personal data gone, so that my right to erasure (Nigeria Data Protection Act) is honoured.
- As the engineer, I want the API to be unable to change predictions and the worker to be unable to read user data, so that a bug in one process can't corrupt the other's data.

**Acceptance criteria**:
- **AC-1**: On a fresh `supabase db reset`, three migrations apply in order and create the 11 tables in *Feature design* with every listed column, check, unique key, foreign key and index. `competitions` matches spec 0004's columns exactly. Row level security (RLS, Postgres rules that filter rows per database role) is enabled on all 11 tables.
- **AC-2**: The roles `anon`, `authenticated` and `service_role` hold no privilege on any of the 11 tables, and none on tables, sequences or functions created later in `public` (default privileges revoked for objects created by `postgres`, `auto_expose_new_tables` false). A `select` from any of these tables as `anon` or `authenticated` fails with a permission error, and none of them can execute any function this spec creates.
- **AC-3**: The login role `signalxi_worker` can insert and update the prediction core as listed in *Security model*, and gets a permission error on any access to `profiles`, `user_competition_prefs`, `payments`, `subscriptions` and `slip_audits`. The login role `signalxi_api` can read the prediction core, gets a permission error on any insert, update or delete there, and can write the user tables as listed. Neither role can write `competitions` or `pick_grade_events`, or delete any prediction core row.
- **AC-4**: `ReportRepository.save_revision` is idempotent. When the incoming `input_hash` equals the current revision's hash for that `(fixture_id, slate_date)`, it writes nothing and returns the current revision with `created = false`. Two concurrent calls with the same new input produce exactly one new revision (the fixture row is locked first).
- **AC-5**: When the incoming hash differs and kickoff has not passed, `save_revision` sets `superseded_at` on the current revision and inserts revision N+1 with its picks in one transaction. The new revision copies `visibility` and `is_free_preview` from the one it replaces; the first revision takes both from the caller. At most one revision per `(fixture_id, slate_date)` has `superseded_at is null` at any time. `superseded_at` can be set once and never cleared or changed.
- **AC-6**: Each report stores `locks_at`, copied by a trigger from `fixtures.kickoff_at` when the report is inserted. A report is locked once `clock_timestamp() >= least(locks_at, fixtures.kickoff_at)` (the wall clock at the moment of the write, not the transaction start), so moving a kickoff later never reopens a report. Once its current report for that slate date is locked, the database refuses (SQLSTATE `SX001`) to insert a report or pick for that `(fixture_id, slate_date)` and to set `superseded_at` on any of its reports. The repository turns `SX001` into `ReportLockedError` (an `AppError` of kind `conflict`); the pipeline skips that fixture, logs it, and carries on. A rescheduled fixture can still get a fresh report under a new slate date, whose own `locks_at` is the new kickoff.
- **AC-7**: The database refuses a report that is a free preview but not `PUBLISHED`, or is `HIGH_RISK_AVOID` with an empty `avoid_tooltip`. A deferred constraint trigger on both `fixture_reports` insert and `prediction_picks` insert refuses (SQLSTATE `SX003`) a report that doesn't have exactly one `is_primary` pick, including a report with no picks at all. `save_revision` runs `SET CONSTRAINTS ALL IMMEDIATE` before it returns, so this failure surfaces inside the repository, not later at commit. The database also refuses a pick whose market doesn't belong to its section (PRD §3.2), a second pick with the same market in one report, and `reasoning_bullets` with fewer than 1 or more than 3 entries or any empty entry. Check and constraint failures (`SX003`, `23514`, `23505`) map to `InvalidReportError` (kind `invalid`).
- **AC-8**: After insert, a pick can change only `settlement_status` and `settled_at`, together (never `settled_at` alone), and only while its report is the current revision and `clock_timestamp() >= report.locks_at`. A graded pick never returns to `PENDING`. `WON` or `LOST` requires the fixture's `ht_*` and `ft_*` scores to be non null; `VOID` does not. Each real change to `settlement_status` appends a `pick_grade_events` row automatically, with the fixture's scores and status read under a share lock, and sets `first_settled_at` to `clock_timestamp()` on the first grade. Any grade change more than 72 hours after `first_settled_at` (by `clock_timestamp()`) is refused. Each refusal raises SQLSTATE `SX002`, which the repository maps to `GradeFinalError` (kind `conflict`). `PickRepository.grade` with an unchanged status writes nothing.
- **AC-9**: Signing up creates a `profiles` row with the same id as the `auth.users` row (`on conflict do nothing`, so the trigger can never block a signup; migration 2 backfills profiles for any existing auth users). Deleting the auth user deletes the profile, its competition prefs and its slip audits, and sets `user_id` to null on its payments and subscriptions.
- **AC-10**: A second payment with the same `(provider, provider_reference)` is refused, as is a second subscription for the same `payment_id`. An `ACTIVE` subscription window that overlaps another `ACTIVE` window of the same user is refused. A payment's status only moves forward: `PENDING` to `SUCCESS` or `FAILED`, and `SUCCESS` to `REFUNDED`; any other change raises SQLSTATE `SX003`, so a replayed webhook can't move it backwards.
- **AC-11**: A `COMPLETED` slip audit must carry its result, its leg counts (1 to 15, all non null) and its combined odds (non null, `>= 1`). A `FAILED` audit carries an `error_code` from `EXTRACTION_FAILED`, `NO_LEGS`, `TOO_MANY_LEGS`, `LLM_INVALID_OUTPUT`, `TIMEOUT`. `screenshot_count` is 0 to 3 and is 0 exactly when `input_type = TEXT`.
- **AC-12**: Every SQLAlchemy model in `app/models` maps exactly the columns of its table. Each column's allowed values (its `CHECK (… IN (…))` list) equal the members of its Python `StrEnum` in `app/schemas/enums.py`, and the market to section mapping in the database equals `app/knowledge/markets.py`. The test reads the constraints through `pg_get_constraintdef` and fails on any difference.
- **AC-13**: `teams.provider_team_id` and `fixtures.provider_fixture_id` are unique, so ingest is an upsert (insert, or update when the key exists) by provider id. A fixture's `home_team_id` and `away_team_id` differ. `ft_home_score` and `ft_away_score` hold the score at the end of normal time, including stoppage time but never extra time or penalties.

## Decision

**Chosen option**: Option 2: a revisioned prediction core enforced by the database, behind two least privilege login roles.

The PRD §9 schema grows into 11 tables: the prediction core stores one row per report revision, kickoff locks it with triggers, grading writes its own trail, and billing and slip audits sit beside it. Only `signalxi_api` and `signalxi_worker` can reach any of it.

**Implementation skills**: `supabase-postgres-best-practices` (`supabase/agent-skills`, `.claude/skills/supabase-postgres-best-practices/`) · `supabase` (`supabase/agent-skills`, `.claude/skills/supabase/`) · `python-backend` (`yonatangross/orchestkit`, `.claude/skills/python-backend/`) · `pydantic` (`pydantic/skills`, `.claude/skills/pydantic/`)

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Conventions for every table**: `id uuid primary key default gen_random_uuid()` (the same as specs 0002 to 0004); strict enums stored as `text` with a `CHECK (col IN (…))` constraint, mirrored by a Python `StrEnum`; times as `timestamptz`; `created_at timestamptz not null default now()`; `updated_at` only on tables that are updated, set by one shared `set_updated_at()` trigger; an index on every foreign key column that no other index already starts with; every foreign key is `ON DELETE RESTRICT` unless stated otherwise. Trigger functions live in a `private` schema (not exposed by the Data API), are `security definer` only where stated, always set `search_path = ''`, and have `EXECUTE` revoked from `public`, `anon`, `authenticated` and `service_role`. `btree_gist` is installed in the `extensions` schema. Trigger errors use custom SQLSTATEs: `SX001` report locked, `SX002` grade refused, `SX003` invalid shape or transition.

**Data model sketch**:

*Migration 1, prediction core* (`supabase/migrations/<ts>_prediction_core.sql`):

| Table | Columns | Keys and rules |
|---|---|---|
| `competitions` | exactly as spec 0004: `provider_league_id int not null unique`, `name`, `country`, `type` (`LEAGUE`, `CUP`, `CONTINENTAL_CLUB`, `NATIONAL_TEAM`), `phase smallint` 1 to 3, `priority smallint` 0 to 100, `state` (`OFF`, `SHADOW`, `LIVE`) default `OFF`, `cup_start_rank smallint null`, `shadow_days smallint not null default 28`, `min_shadow_picks smallint not null default 30`, `shadow_started_at null`, `live_since null`, `created_at`, `updated_at` | check `type <> 'CUP' or cup_start_rank is not null`; written only by migrations; no seed rows here (spec 0004 seeds them) |
| `teams` | `provider_team_id int not null unique`, `name text not null`, `short_name text null`, `country text null`, `is_national boolean not null default false`, `logo_url text null`, `created_at`, `updated_at` | upserted by ingest |
| `fixtures` | `provider_fixture_id int not null unique`, `competition_id uuid not null → competitions`, `provider_season int not null`, `provider_round text null`, `home_team_id uuid not null → teams`, `away_team_id uuid not null → teams`, `kickoff_at timestamptz not null`, `status text not null default 'SCHEDULED'` (`SCHEDULED`, `LIVE_1H`, `HALF_TIME`, `LIVE_2H`, `EXTRA_TIME`, `PENALTIES`, `SUSPENDED`, `FINISHED`, `POSTPONED`, `ABANDONED`), `ht_home_score`, `ht_away_score`, `ft_home_score`, `ft_away_score` (`smallint null`, each `>= 0`), `live_updated_at timestamptz null`, `created_at`, `updated_at` | check `home_team_id <> away_team_id`; index `(competition_id, kickoff_at)`, `(kickoff_at)`, `(home_team_id)`, `(away_team_id)` |
| `fixture_reports` | `fixture_id uuid not null → fixtures`, `slate_date date not null`, `revision smallint not null` (`>= 1`), `visibility text not null` (`SHADOW`, `PUBLISHED`), `is_free_preview boolean not null default false`, `overall_classification text not null` (`STRONG`, `MODERATE`, `HIGH_RISK_AVOID`, `INSUFFICIENT_DATA`), `avoid_tooltip text null`, `input_hash text not null` (64 lowercase hex), `prompt_version text not null`, `llm_model text not null`, `engine_snapshot jsonb not null`, `model_inputs jsonb null` (spec 0003), `locks_at timestamptz not null` (set by trigger from the fixture's kickoff at insert), `published_at timestamptz not null default now()`, `superseded_at timestamptz null` | unique `(fixture_id, slate_date, revision)`; check `input_hash ~ '^[0-9a-f]{64}$'`; unique `(fixture_id, slate_date) where superseded_at is null` (the current revision); check `visibility = 'PUBLISHED' or not is_free_preview`; check `overall_classification <> 'HIGH_RISK_AVOID' or coalesce(length(trim(avoid_tooltip)), 0) > 0`; index `(slate_date, visibility) where superseded_at is null` |
| `prediction_picks` | `report_id uuid not null → fixture_reports`, `is_primary boolean not null`, `section text not null` (`main`, `goals`, `half`, `specials`), `market text not null` (the 35 PRD §3.2 enums), `classification text not null` (same 4 values), `reasoning_bullets text[] not null` (check `cardinality(reasoning_bullets) between 1 and 3` and no null or blank element), `model_probability numeric(5,4) null` (0 to 1, spec 0003; written for every pick, nullable only because spec 0003 declares it so), `settlement_status text not null default 'PENDING'` (`PENDING`, `WON`, `LOST`, `VOID`), `settled_at timestamptz null`, `first_settled_at timestamptz null`, `created_at` | unique `(report_id, market)`; unique `(report_id) where is_primary`; check market belongs to section (a `CASE` over the PRD §3.2 table); a deferred constraint trigger (on report insert and pick insert, per row, cheap guard) requires exactly one primary per report; index `(settlement_status) where settlement_status = 'PENDING'` |
| `pick_grade_events` | `pick_id uuid not null → prediction_picks`, `from_status text not null`, `to_status text not null` (settlement values), `scores jsonb not null` (`{ht_home, ht_away, ft_home, ft_away, fixture_status}`), `created_at` | index `(pick_id, created_at)`; append only; inserted only by the picks trigger (`security definer`, a function that runs with its owner's rights) |

*Migration 2, accounts and billing* (`<ts>_accounts_billing.sql`):

| Table | Columns | Keys and rules |
|---|---|---|
| `profiles` | `id uuid primary key → auth.users(id) on delete cascade`, `created_at`, `updated_at` | created by an `after insert` trigger on `auth.users` (`private.handle_new_user()`, `security definer`, `search_path = ''`, `insert … on conflict do nothing`; `supabase_auth_admin` gets `USAGE` on `private` and `EXECUTE` on it); migration 2 backfills existing auth users; no email copy (auth owns it) |
| `user_competition_prefs` | `user_id uuid → profiles on delete cascade`, `competition_id uuid → competitions`, `created_at` | primary key `(user_id, competition_id)`; index `(competition_id)` |
| `payments` | `user_id uuid null → profiles on delete set null`, `provider text not null` (`PAYSTACK`), `provider_reference text not null`, `plan_type text not null` (`WEEKEND_PASS`, `MONTHLY_PRO`), `amount_kobo integer not null` (`> 0`), `currency text not null default 'NGN'` (`NGN`), `status text not null default 'PENDING'` (`PENDING`, `SUCCESS`, `FAILED`, `REFUNDED`), `channel text null`, `paid_at timestamptz null`, `created_at`, `updated_at` | unique `(provider, provider_reference)`; check `status <> 'SUCCESS' or paid_at is not null`; index `(user_id)`; no raw webhook body stored |
| `subscriptions` | `user_id uuid null → profiles on delete set null`, `payment_id uuid not null unique → payments`, `plan_type text not null`, `status text not null default 'ACTIVE'` (`ACTIVE`, `CANCELLED`), `starts_at timestamptz not null`, `expires_at timestamptz not null`, `created_at`, `updated_at` | check `expires_at > starts_at`; `exclude using gist (user_id with =, tstzrange(starts_at, expires_at) with &&) where (status = 'ACTIVE')` (needs the `btree_gist` extension); index `(user_id, expires_at)` |

*Migration 3, slip audits* (`<ts>_slip_audits.sql`):

| Table | Columns | Keys and rules |
|---|---|---|
| `slip_audits` | `user_id uuid not null → profiles on delete cascade`, `status text not null` (`COMPLETED`, `FAILED`), `input_type text not null` (`SCREENSHOT`, `TEXT`), `screenshot_count smallint not null` (0 to 3), `quota_date date not null`, `original_leg_count smallint null`, `original_combined_odds numeric(12,2) null`, `trimmed_leg_count smallint null`, `trimmed_combined_odds numeric(12,2) null`, `structural_summary text null`, `audit_result_json jsonb null`, `schema_version smallint not null`, `matched_fixture_ids uuid[] not null default '{}'`, `error_code text null`, `created_at` | check `(input_type = 'TEXT') = (screenshot_count = 0)`; check that `COMPLETED` has every one of these non null with `original_leg_count` 1 to 15, `trimmed_leg_count` 0 to `original_leg_count`, and both odds `>= 1` (each written `x is not null and …`, so a null never passes); check that `FAILED` has `error_code` in (`EXTRACTION_FAILED`, `NO_LEGS`, `TOO_MANY_LEGS`, `LLM_INVALID_OUTPUT`, `TIMEOUT`); index `(user_id, created_at desc)`, `(user_id, quota_date) where status = 'COMPLETED'` |

**Relationships**: competitions 1:N fixtures; teams 1:N fixtures (twice, home and away); fixtures 1:N fixture_reports (revisions × slate dates); fixture_reports 1:N prediction_picks; prediction_picks 1:N pick_grade_events; auth.users 1:1 profiles; profiles N:M competitions through user_competition_prefs; profiles 1:N payments, slip_audits; payments 1:1 subscriptions. Spec 0002's `fixture_events`, `fixture_lineups` and `fixture_stats`, spec 0003's `pick_live_outlooks`, and spec 0004's `competition_seasons` and check tables are created by their own migrations on top of this one and follow the same role and RLS pattern.

**State transitions**:
- Report revision: `current` (inserted, `superseded_at is null`) → `superseded` (a newer hash arrived before the lock). Both states freeze once `least(locks_at, fixtures.kickoff_at)` passes. Nothing else changes on a report.
- Pick settlement: `PENDING` → `WON` | `LOST` | `VOID`; a graded value may move to another graded value (a score correction) until 72 hours after `first_settled_at`, then it is final. Never back to `PENDING`. Only picks of a current revision move, and only after its `locks_at`.
- Fixture status: as spec 0002 (`SCHEDULED` → live states → `FINISHED`; `POSTPONED`, `ABANDONED`, `SUSPENDED` branches). Postponed then rescheduled: the same fixture row gets the new `kickoff_at`, but the original report keeps its `locks_at`, so it stays frozen and gradable; settlement VOIDs its picks once that WAT day has ended without the match being played. Per spec 0004 AC-5 the fixture is never added to a slate already built, but a later 06:00 run may give it a fresh report under its new `slate_date`. Where two current reports exist for one fixture, reads keyed only by `fixture_id` (the spec 0002 and 0003 live endpoints) use the one with the latest `slate_date`; the ledger grades both.
- Subscription window: `ACTIVE` with `now()` before `starts_at` is queued, inside the range is current, after `expires_at` is expired (worked out from the times, never stored); `CANCELLED` (a refund) is set by the billing feature, which also decides whether later queued windows move up (#20). A window whose `user_id` became null after erasure no longer takes part in the overlap check, which is harmless since nobody can use it.
- Payment: `PENDING` → `SUCCESS` | `FAILED`; `SUCCESS` → `REFUNDED`. Enforced by trigger.

**API surface** (no HTTP endpoints; this feature adds repository methods, used by later features through the `UnitOfWork`):

| Function | Kind | Key inputs | Key outputs | Caller (role) | Key errors |
|---|---|---|---|---|---|
| `uow.reports.save_revision(draft: ReportDraft)` | async method | `fixture_id: UUID`, `slate_date: date`, `input_hash: str`, `prompt_version: str`, `llm_model: str`, `engine_snapshot: dict`, `model_inputs: dict \| None`, `overall_classification`, `avoid_tooltip: str \| None`, `visibility`, `is_free_preview: bool`, `picks: list[PickDraft]` | `SavedRevision(report_id, revision, created: bool)` | pipeline (worker) | `ReportLockedError` (conflict, `SX001`) once locked; `InvalidReportError` (invalid, `SX003`, `23514`, `23505`) on a shape failure, raised inside the call because it ends with `SET CONSTRAINTS ALL IMMEDIATE` |
| `uow.picks.grade(pick_id: UUID, status: SettlementStatus, settled_at: datetime)` | async method | the pick, its new status, the settlement time | `changed: bool` | settlement (worker) | `GradeFinalError` (conflict, `SX002`) past 72 hours, before `locks_at`, on a superseded revision, back to `PENDING`, or `WON`/`LOST` without scores |

**Value sourcing**:

| Action | Value produced | Source |
|---|---|---|
| ingest | `teams.*`, `fixtures.*` (provider ids, kickoff, status, scores, round, season) | API-Football fixtures reply, via the football data ingestion feature (#6); status mapping per spec 0002 |
| ingest | `fixtures.competition_id` | the `competitions` row whose `provider_league_id` matches the reply's league id |
| ingest | `teams.name`, `logo_url` | the fixtures reply's team object |
| ingest | `teams.is_national` | derived: true when the fixture's competition `type = NATIONAL_TEAM`, set on first insert |
| ingest | `teams.country`, `short_name` | left null for now; a later call to API-Football's teams endpoint may fill them |
| live job | `fixtures.live_updated_at` | the live job (spec 0002), on a real change only |
| ingest / settlement | `ft_*` scores | API-Football `score.fulltime` (normal time only), never `extratime` or `penalty` |
| `save_revision` | `slate_date` | the caller: the WAT calendar date of `kickoff_at` at the 06:00 run (spec 0004 AC-4), computed in `app/utils` |
| `save_revision` | `input_hash` | the caller: SHA-256 hex of canonical JSON of `{engine_snapshot, prompt_version, llm_model}`, one helper in `app/utils`. `engine_snapshot` is a Pydantic model with no timestamps or run ids; the engine rounds floats to 6 decimal places; the bytes are `json.dumps(model_dump(mode="json"), sort_keys=True, separators=(",", ":"), ensure_ascii=False)`. `visibility` and `is_free_preview` stay out of the hash because spec 0004 applies state changes from the next 06:00 run only |
| `save_revision` | `llm_model`, `prompt_version`, `avoid_tooltip`, `overall_classification` | the LLM fixture analysis node (#8): the model id OpenRouter reports, the prompt version from `app/knowledge`, and the validated output |
| `save_revision` | `locks_at` | the trigger: `fixtures.kickoff_at` at insert |
| `save_revision` | `revision` | derived: the current revision's number + 1, or 1 when there is none |
| `save_revision` | `visibility`, `is_free_preview` (first revision) | the caller: competition state (spec 0004) and the pipeline's free preview pick; later revisions copy them from the revision they replace |
| `save_revision` | `engine_snapshot`, `model_inputs`, `model_probability` | the statistical engine (#7) output and spec 0003 |
| `save_revision` | picks' `section`, `market`, `classification`, `reasoning_bullets`, `is_primary` | the validated LLM output (#8); the primary is one of the section picks flagged, never a duplicate row |
| `grade` | `settlement_status` | settlement (#13) from the fixture scores and the market rules in `app/knowledge` |
| `grade` | `settled_at` | the caller passes the current time at grading |
| trigger | `first_settled_at`, `pick_grade_events.scores` | the trigger: `now()` on the first grade; the fixture row's scores and status at the time of the change |
| checkout / webhook | `payments.amount_kobo`, `plan_type`, `provider_reference`, `user_id` | the pricing and checkout feature (#19): the plan price table in `app/knowledge`; a reference the backend generates at checkout; the signed in user |
| webhook | `payments.status`, `channel`, `paid_at` | the payment webhooks feature (#20) maps Paystack events to these; `provider` is always `PAYSTACK` and `currency` always `NGN` |
| webhook | `subscriptions.starts_at` | derived: `max(now(), latest expires_at of the user's ACTIVE windows)` inside the same transaction, with the user's profile row locked |
| webhook | `subscriptions.expires_at` | `starts_at` + the plan duration (72 hours or 30 days, PRD §4.1) from the plan table |
| slip audit | `quota_date` | the WAT calendar date when the audit starts |
| slip audit | `matched_fixture_ids`, counts, odds, `structural_summary`, result | Node 2 and Node 3 of the slip audit pipeline (#26): trimmed counts and odds cover only `KEEP` and `KEEP_VALUE` legs; `audit_result_json` is the `SlipAuditReport` dump; `schema_version` is a constant beside that schema |
| slip audit | `error_code` | the slip audit pipeline, from the fixed list in AC-11 |
| slip audit quota | audits used today | Redis (PRD §10.1) is the source of truth; the `COMPLETED` rows for `(user_id, quota_date)` are only the fallback count if Redis loses the key |

**Key invariants**:
- At most one current revision per `(fixture_id, slate_date)`; a rerun with an unchanged `input_hash` writes nothing.
- No report, pick or supersede after kickoff; picks never change except their settlement; superseded revisions are never graded.
- Every grade change has a `pick_grade_events` row, because the database writes it, not the application.
- Each report has exactly one primary pick, and every market sits in its PRD §3.2 section.
- A free preview is always `PUBLISHED`; a `HIGH_RISK_AVOID` report always has an avoid tooltip.
- No two `ACTIVE` subscription windows of one user overlap; one subscription per successful payment; one payment per provider reference.
- Raw screenshots and raw webhook bodies are never stored.

**Write path** (`save_revision`, one `UnitOfWork` transaction): `select … from fixtures where id = :id for update` (locks the fixture, which serialises concurrent writers); read the current revision; equal hash → return it; else update `superseded_at = now()` on it, insert the new report and its picks, run `SET CONSTRAINTS ALL IMMEDIATE`, and map `SX001` and `SX003` as listed. Ingest upserts fixtures in ascending `provider_fixture_id` order, so batches never lock rows in opposite orders. Log `report_revision_saved` or `report_revision_unchanged` with `fixture_id`, `slate_date` and `revision`.

**Security model**:
- **Roles.** `signalxi_worker` and `signalxi_api` are `LOGIN`, `NOINHERIT` roles created in migration 1 with no password, inside a `do $$ … if not exists` guard (roles are global to the cluster, so a rerun must not fail). Each gets `alter role … set lock_timeout = '5s'` and `set idle_in_transaction_session_timeout = '60s'`, so a crashed process can't hold a fixture lock for long (statement timeout stays in the app, spec 0001). Passwords are set by hand in production (`alter role … password`, never in git) and by `supabase/seed.sql` locally. Through Supavisor (Supabase's connection pooler) the usernames are `signalxi_worker.<project-ref>` and `signalxi_api.<project-ref>`. Migrations keep running as `postgres`.
- **Worker grants**: `select` on `competitions`; `select, insert, update` on `teams` and `fixtures`; `select, insert` on `fixture_reports` and `prediction_picks`, plus column grants `update (superseded_at)` on reports and `update (settlement_status, settled_at)` on picks; `select` on `pick_grade_events`. Nothing on the user tables.
- **API grants**: `select` on `competitions`, `teams`, `fixtures`, `fixture_reports`, `prediction_picks` and `pick_grade_events`; `select` on `profiles`; `select, insert, delete` on `user_competition_prefs`; `select, insert` and `update (status, channel, paid_at)` on `payments`; `select, insert` and `update (status)` on `subscriptions`; `select, insert, delete` on `slip_audits`.
- **RLS**: enabled on every table. One permissive policy per granted role and command, `using (true)`. Grants decide what each role can do; RLS makes sure no other role sees rows. No policy exists for `anon`, `authenticated` or `service_role`, and all their grants are revoked, together with `revoke all on all tables, sequences and functions in schema public from anon, authenticated, service_role`, `alter default privileges for role postgres in schema public revoke all on tables, sequences and functions from anon, authenticated, service_role`, and `auto_expose_new_tables: false` in `supabase/config.jsonc`, so the Data API (PostgREST) exposes nothing.
- **Paywall**: the database holds locked data for every tier; the hard paywall stays in the API presenter (backend spec 0001). This spec adds no client read path that could bypass it.
- **Compliance**: the Nigeria Data Protection Act applies to `profiles`, prefs, payments and slip audits. Erasure follows AC-9; payments and subscriptions are kept without a user link for tax and chargeback records.

**Configuration required**:
- `DATABASE_URL`: the same variable, but now a different value per Render service: the API service uses the `signalxi_api` login and the worker uses `signalxi_worker` (local: the direct port 54322 with the seed passwords). No new variable and no change to `config.py`.
- `supabase/seed.sql` (local only): sets development passwords for both roles.
- `supabase/config.jsonc`: `api.auto_expose_new_tables` set to `false`.

**Critical test scenarios** (integration tests against local Supabase, in `backend/tests/integration/`):
- Happy path: ingest a fixture, `save_revision` twice with the same hash (one revision), then with a new hash (revision 2, revision 1 superseded, preview flag copied), verifies **AC-4**, **AC-5**, **AC-13**
- Failure case: two concurrent `save_revision` calls with the same new hash produce one revision; a call after `kickoff_at` raises `ReportLockedError`; a report with zero or two primaries fails at commit, verifies **AC-4**, **AC-6**, **AC-7**
- Postponed: publish, move `kickoff_at` a day later, confirm a supersede is still refused and the old picks can be VOIDed; a fresh report under the new `slate_date` is accepted, verifies **AC-6**, **AC-8**
- Ledger: grade WON, regrade LOST within 72 hours (two grade events), regrade after 72 hours refused, grading a superseded revision's pick refused, editing `market` refused, verifies **AC-8**
- Auth/permission: as `anon` and `authenticated`, `select` on every table fails; as `signalxi_api`, insert into `fixture_reports` fails; as `signalxi_worker`, `select` on `payments` fails; neither can update `competitions`, verifies **AC-2**, **AC-3**
- Accounts: create and delete an auth user, check the cascade and the nulls; a duplicate provider reference and an overlapping `ACTIVE` window are refused, verifies **AC-9**, **AC-10**
- Schema drift: models versus `information_schema`, `CHECK` value lists versus `StrEnum`s, and markets versus sections, verifies **AC-1**, **AC-11**, **AC-12**

## Build plan

Tracer Bullet: the first slice runs one real thread end to end (migration, role, model, repository, integration test proving idempotency), then each slice thickens one strand.

1. Thin thread: migration 1 with the roles, the revoked defaults, `btree_gist`, `set_updated_at()`, `competitions`, `teams`, `fixtures`, `fixture_reports` and `prediction_picks` with their checks, the kickoff lock trigger, the deferred primary check, grants and RLS; `seed.sql` role passwords and `auto_expose_new_tables: false`; the `StrEnum`s in `app/schemas/enums.py`, `app/knowledge/markets.py`, the five SQLAlchemy models (`lazy="raise"`), `ReportRepository.save_revision` on the `UnitOfWork`, the `input_hash` helper, integration tests connecting as `signalxi_worker`, and a first manual login through Supavisor session mode as each custom role on the real project (this is what everything else depends on), satisfies **AC-1**, **AC-2**, **AC-4**, **AC-5**, **AC-6**, **AC-7**, **AC-13**
2. Grading strand: `pick_grade_events`, the picks immutability and settlement trigger (the current revision only, after kickoff or postponed/abandoned, the 72 hour window, `first_settled_at`), `PickRepository.grade`, and the ledger tests, satisfies **AC-8**
3. Role strand: the permission test matrix for `anon`, `authenticated`, `signalxi_api` and `signalxi_worker` across every table so far, satisfies **AC-2**, **AC-3**
4. Migration 2: `profiles` with the signup trigger, `user_competition_prefs`, `payments`, `subscriptions` with the exclusion constraint, grants, RLS and models; cascade, uniqueness and overlap tests, satisfies **AC-1**, **AC-3**, **AC-9**, **AC-10**
5. Migration 3: `slip_audits` with its checks, grants, RLS and model; its tests, satisfies **AC-1**, **AC-3**, **AC-11**
6. Drift guard: the test comparing every model with `information_schema`, every `CHECK` list with its `StrEnum`, and markets with sections; document the per service `DATABASE_URL` in `backend/.env.example` and `render.yaml` comments, satisfies **AC-1**, **AC-12**

## Consequences

**Positive**:
- The ledger's honesty is enforced by Postgres, not by remembering to call the right code: no rewrite after kickoff, and no grade change without a trail.
- Reruns, retries and a doubled scheduler tick are harmless, which the pre kickoff refresh (#15) and the orchestration spec (#5) rely on.
- An API bug can't touch predictions and a worker bug can't read user data; a leaked anon key reads nothing.
- Every later slice (pipeline, settlement, paywall, billing, audits, live data) adds tables or uses these as they are, with no breaking migration.

**Negative / tradeoffs**:
- Triggers hold business rules (the kickoff lock, settlement rules, the grade trail), so part of the behaviour lives in SQL; the integration tests are the only guard on it.
- Two database passwords to set and rotate by hand, and a connection string per service. A forgotten grant shows up as a permission error at runtime, not at deploy.
- Integration tests need local Supabase, which can't run on your development machine (no Docker), so they run in CI only; schema bugs surface later in the loop.
- Revisions multiply report and pick rows (at most a few per fixture per day), and every slate read must filter on `superseded_at is null`.
- The lock uses the earlier of the stored and current kickoff, so a kickoff moved earlier locks sooner, and one moved later never unlocks; a refresh for a delayed kickoff is refused (safe, but a lost refresh).

**Neutral**:
- Spec 0001's DB access row (`postgres.<project-ref>`) is replaced by the two role logins.
- Spec 0004's client role read policies are dropped (deny all instead), and its "service role" means `signalxi_worker`.
- PRD §9 names change: `users` becomes `profiles`, `external_api_id` becomes `provider_fixture_id`, `kickoff_wat` becomes `kickoff_at`, `raw_stats_json` becomes `fixture_reports.engine_snapshot`, `favorite_leagues` becomes `user_competition_prefs`, `idempotency_key` becomes the unique `(provider, provider_reference)`.

## Follow-up

- [ ] Update spec 0001's DB access row and the `/readyz` note for the two role logins, and spec 0004's RLS paragraph (deny all, worker role), once this is confirmed.
- [ ] Specs 0002, 0003 and 0004: their migrations grant to `signalxi_worker` and `signalxi_api` the same way (worker writes, API reads) and add no policies for client roles.
- [ ] Pricing and checkout (#19): fix the exact plan prices in `app/knowledge` (PRD gives ranges) and how `CANCELLED` is reached on a refund.
- [ ] Settlement (#13): VOID the original slate's picks for a postponed fixture only after that WAT day has ended, and grade both visibilities (spec 0004).
- [ ] Before production: generate and store both role passwords in Render.
- [ ] Account deletion (#16): names the deletion path (the Supabase Auth admin API) that triggers the AC-9 cascade.
