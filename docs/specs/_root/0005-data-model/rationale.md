# 0005. Data model: rationale

## Context

> ⚠️ Premise note: "data model" reads like a list of tables to copy from PRD §9. The load bearing part is not the tables, though. It is two promises the schema has to keep on its own: the public ledger grades only what users saw before kickoff, and a pipeline rerun never duplicates or rewrites a prediction. If those live only in application code, one careless refactor breaks the product's central claim. The real decision is where those guarantees are enforced.

SignalXI sells honesty. The ledger (PRD §5.4) grades every published pick in public, and the pitch against Telegram tipsters is that nothing is cherry picked. The pipeline runs at 06:00 WAT and again before kickoff windows (scope #15), retries on failure, and can briefly run in two workers during a Render deploy (spec 0001). Each of those can write the same fixture's prediction more than once. The schema must make a rerun harmless and make what was shown at kickoff permanent.

Specs 0002, 0003 and 0004 were written before this one and already lean on it. They add a `competitions` table that replaces the PRD's free text column, a `visibility` flag that separates private shadow picks from published ones, model probabilities and inputs, and live data tables. Spec 0004 also asks that the backend hold `SELECT` only on `competitions`. That is impossible while the backend logs in as `postgres` (spec 0001), which bypasses every grant and RLS rule.

The user side carries money and personal data. Paystack webhooks get retried and can be replayed, so a duplicate must never extend access twice (PRD §10.1). Users can buy a pass while another is running. Slip audits hold betting history, and the Nigeria Data Protection Act gives users a right to erasure, while tax and chargeback disputes need payment records kept for years. The browser reaches only the FastAPI API (spec 0001), so direct table access from the client is not needed at all.

Leaving this undecided blocks every Slice 1 feature: the pipeline, the engine and the slate API all need somewhere to write and read. Deciding it loosely means a breaking migration later, the one thing the scope's "done when" rules out.

## Options considered

### Option 1: PRD §9 as written, rules in the application

Six tables as the PRD lists them (`users`, `subscriptions`, `fixtures`, `fixture_reports`, `prediction_picks`, `slip_audits`), with the pipeline upserting one report per fixture and slate date. The backend connects as `postgres`, and the code enforces locks, idempotency and grading rules.

**Pros**:
- The fewest tables and no triggers; every rule is in Python, where unit tests run fast.
- Matches the PRD word for word, so nothing to explain to a reader.

**Cons**:
- An overwrite in place loses what users saw at 06:00 once the refresh runs, so the ledger can't prove what it graded.
- Nothing stops a bug, a manual SQL fix or a refactor from changing a pick after kickoff.
- Free text competitions and team names break spec 0004 and split a team's history when the provider renames it.
- Spec 0004's grant rule can't hold while the backend is `postgres`.

### Option 2: A revisioned core enforced by the database, behind two least privilege roles (chosen)

Each pipeline run writes a new report revision only when the inputs' hash changes, and Postgres triggers lock reports at kickoff, freeze picks except settlement, and log every grade. Teams, competitions, payments and preferences become proper tables. The API and the worker each get a login role granted only what they need, and client roles get nothing.

**Pros**:
- The ledger's guarantees hold no matter which code path writes, including a hand written SQL fix.
- Reruns are harmless by construction (hash compare under a row lock).
- An API bug can't corrupt predictions; a worker bug can't read user data.
- Absorbs specs 0002 to 0004 without a breaking change.

**Cons**:
- Business rules split between Python and SQL triggers; trigger behaviour is only covered by integration tests, which need local Supabase (CI only on your machine).
- Two more credentials to manage, and grants to keep in step with every new table.
- More rows (revisions) and a `superseded_at is null` filter on every read.

### Option 3: Append only event log for predictions

Store every pipeline output and every grade as immutable events, and build current reports and the ledger as views or projections over them.

**Pros**:
- The strongest audit trail; nothing is ever updated.
- Any past state can be rebuilt.

**Cons**:
- Projections and their rebuilds are a second system to operate for one engineer.
- Every read (slate, ledger, paywall) goes through a projection, which adds latency or a cache to keep in sync.
- More machinery than the two guarantees actually need.

## Rationale

The product's value rests on the ledger being trustworthy and the pipeline being safe to rerun, so those guarantees belong in the one layer every write must pass through: the database. Option 1 puts them in code that later features will touch many times, and its overwrite in place throws away exactly the evidence the ledger needs. Option 3 gets the audit trail but makes a one person team run an event store with projections for every read. Option 2 keeps ordinary tables and reads, and adds only three things: a revision number with a hash, a kickoff lock trigger, and a grading trigger that writes its own trail.

The input hash is the smallest key that captures "nothing meaningful changed". A run id would make a new revision for every identical rerun. The fixture row lock makes concurrent workers queue instead of racing, which matters because a Render deploy can overlap two workers. Locking at kickoff, rather than freezing at first publish, keeps the pre kickoff refresh useful when line ups or injuries change, while still fixing what the ledger grades. The 72 hour regrade window with an automatic event log covers provider score corrections without letting history drift quietly.

Two roles instead of one follow from spec 0004's grant rule and from the paywall principle: the API is the process exposed to the internet, so it should be unable to write predictions at all. Denying every client role outright fits spec 0001 (the browser talks only to the API) and means a leaked anon key or a misconfigured Data API exposes nothing. Text with `CHECK` constraints beats native enums because spec 0002 already widens the status set, and a `CHECK` change is one ordinary transactional migration. Queued subscription windows with an exclusion constraint stop lost paid days and double access at the database, which is where a retried webhook would otherwise slip through.

### Smaller calls made while writing

- **Primary pick storage**: the primary is one of the section picks with `is_primary = true`, not a duplicate row. Runner up: a separate primary row, which would double count it in the "by market section" ledger.
- **`reasoning_bullets` as `text[]`**: a simple list with a length check. Runner up: `jsonb`, which allows shapes the schema can't check.
- **Expired subscriptions are worked out from `expires_at`**: no job has to flip a status, so it can never be stale. Runner up: the PRD's stored `EXPIRED`, which needs a scheduled job and can lag.
- **No raw Paystack body stored**: it holds the customer's email, which would survive account erasure. Runner up: store it redacted, which needs a redaction rule to maintain.
- **Repositories for the invariants only** (`save_revision`, `grade`): they prove the "done when" without guessing the read shapes the slate API and ledger specs will want.
- **A stored `locks_at` per report**: the provider can move a kickoff later, and locking only on the fixture's current kickoff would reopen a published report. Runner up: forbid ingest from moving a kickoff later, which would leave the fixture's real kickoff wrong.
- **`ft_*` scores mean normal time**: every PRD §3.2 market settles on 90 minutes plus stoppage, so extra time must never leak into them.
