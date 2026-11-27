# 0002. Live scores, line ups and match stats: rationale

## Context

> ⚠️ Premise note: this feature builds on nine features that have no spec yet (data model #3, orchestration #5, ingestion #6, slate API #9, slate page #10, drawer #11, settlement #13, paywall #17, alerts #25). It sits in Slice 8, after launch, so that order is fine, but every contract it borrows from them (slate membership, fixture ids, a per fixture settle call, an alert hook) is stated in `index.md` Follow-up so those specs keep them.

SignalXI publishes one slate a day and grades it after each match. Between kickoff and the final whistle the app shows nothing, so users who want to know how their predicted games are going leave for a live score app. Live scores are not in the PRD; the engineer asked for them so the slate stays useful during matches and the ledger feels current.

The PRD's §1 rules shape every option. Slates are batch served: visitor traffic never triggers LLM calls, and `AGENTS.md` adds that visitor traffic never calls the football API either. Users are on mid range Android phones over 3G and 4G, with a 2MB initial load budget, so anything that keeps long connections open or ships a heavy client library hurts the core audience. The backend is a FastAPI API plus a single scheduler worker that holds a Postgres advisory lock, with Redis already in place for caching and rate limits.

Football data comes from API-Football, whose plans cap daily requests. The plan is not chosen yet. Live polling competes for that budget with the 06:00 slate job, the pre kickoff refresh and settlement, which the product cannot run without. Coverage is the nine PRD competitions, and only fixtures with a published pick matter to SignalXI.

Not deciding leaves users without live context and leaves the ledger up to two hours behind full time, the moment users care most about results.

## Options considered

### Option 1: Worker polls into Redis and Postgres; the app polls a cached endpoint

The scheduler worker calls API-Football's `fixtures?ids=` endpoint for the slate's open window fixtures once a minute, writes a compact live view to Redis and durable facts to Postgres, and the app polls two small, private endpoints every 30 seconds with per viewer ETags.

**Pros**:
- Keeps the batch served rule: visitors read a cache; only the worker calls the API.
- One request a minute covers up to 20 slate fixtures, including their events, line ups and stats, so API use is bounded and predictable.
- Polling works on flaky mobile networks with no reconnect logic and no new client library.
- Reuses everything already in the stack (worker, Redis, rate limiter, TanStack Query).

**Cons**:
- Up to about 90 seconds of lag end to end.
- Polling costs a small request every 30 seconds per open tab.

### Option 2: Server sent events from the API

Same worker ingestion, but the API holds an open SSE connection (a one way stream from server to browser) per viewer and pushes changes as they land in Redis.

**Pros**:
- Updates reach the screen seconds after the worker writes them.
- No repeated requests while nothing changes.

**Cons**:
- Long lived connections drop often on mobile networks and need reconnect and backoff logic.
- Every open connection holds API resources, raising hosting cost on match days.
- The worker still polls once a minute, so most of the lag remains anyway.

### Option 3: Supabase Realtime from Postgres changes

The worker writes live state to Postgres every poll, and the app subscribes to row changes through Supabase Realtime.

**Pros**:
- Push updates without building SSE.
- Uses a service the project already runs.

**Cons**:
- A Postgres write per fixture per minute, which `fixtures` was not designed for.
- Adds the Realtime client to the bundle and ties live traffic to the database.
- Locked prediction data would need careful row level rules on a second path, outside the presenter that owns the paywall.

### Option 4: The app calls a live score API directly

The phone fetches scores from a third party API with a public key.

**Pros**:
- No backend work.

**Cons**:
- Breaks the rule that visitors never call the football API, and leaks the API key.
- Burns the daily request budget per visitor, with no control.

## Rationale

Option 1 is the only one that keeps both PRD §1 rules (batch served, visitors never call external APIs) while staying inside the existing stack. The forces that decide it are the mobile audience and the fixed API budget. Polling a small cached endpoint every 30 seconds works on weak 3G with no reconnect logic, and ETags keep most replies empty. A single `fixtures?ids=` request a minute covers up to 20 slate fixtures with their events, line ups and stats, so API use depends on match hours, not on how many people are watching. `live=all` was rejected because it returns matches SignalXI doesn't cover and drops a match the moment it ends, which would hide the full time transition settlement needs.

SSE (Option 2) would cut on screen lag from about 90 seconds to about 60, because the worker still polls once a minute. That small gain costs reconnect logic, long connections on mobile and higher hosting cost on match days, so it isn't worth it for the MVP audience. Supabase Realtime (Option 3) moves live writes into Postgres every minute and opens a second read path that bypasses the presenter, the one place the paywall is enforced. That is the riskiest thing to weaken in this product.

Settlement right at full time was chosen because the live job already knows the exact moment a match ends; waiting for the 2 hour sweep would leave a finished, ungraded pick on screen at the moment users check results. The sweep stays as the safety net, so a missed trigger never loses a grade. Line ups are display only here because re picking belongs to the pre kickoff refresh (#15), and mixing them would add LLM cost close to kickoff without a spec deciding when that is worth it.

Smaller calls made in this spec: the event key is derived from the event's content because API-Football events carry no stable id; the request counter lives in the football API adapter so every job shares one budget, with the API's own remaining requests header preferred when present; stale data is flagged after 180 seconds (three missed polls) rather than hidden, so users see why numbers stopped; and the flag defaults off so the feature can ship dark until the API plan is chosen.

Changes after the cross check (2026-11-27): replies are private with a per viewer ETag and `Vary: Authorization`, because spec 0003 makes the payload differ by tier and a shared ETag or cache could serve premium data to a guest or a stale locked view to an upgrader. Guests are rate limited per IP at 600 a minute because Nigerian mobile carriers put many users behind one IP. Events are reconciled against the provider's list on each poll, because API-Football corrects minutes and players after the fact. Settlement is called on every poll while picks are still pending, instead of tracking a fragile "first time seen" flag. The server sends `age_s` so a wrong phone clock can't break "last updated". The slate summary is built on read from the per fixture keys, removing a second Redis key that could drift.
