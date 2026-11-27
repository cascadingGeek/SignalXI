# 0004. Competition coverage and phased rollout: rationale

## Context

> ⚠️ Premise note: "cover more competitions" is easy to read as "add rows to a list". For SignalXI, though, every competition is a public promise: its picks go into a ledger that grades everything in the open, and the product's whole pitch is honest accuracy. The decision is really about how a competition earns a place on the slate, not just which ones are on it.

The PRD (§5.1) lists nine competitions. Nigerian bettors bet far more widely: the EFL Championship on Saturday afternoons, the Europa League midweek, Scandinavian and Brazilian leagues in the European summer, the Saudi Pro League for its star players, and African football, the NPFL and CAF club cups above all. A short list leaves the slate empty on many days and sends users elsewhere.

Three forces push against simply adding everything. First, cost: the pipeline makes one LLM call per fixture per day, and a busy Saturday across 50 competitions can exceed 100 fixtures. Second, data quality: the statistical engine needs reliable stats, events, line ups and history, and API-Football's coverage varies a lot by league, with African and lower leagues often thin. Third, trust: weaker picks from a thin data league go straight into the public ledger, where they lower the headline accuracy rate that the product sells.

Cup competitions add their own problem, since early rounds feature rotated squads that break team strength models. National team tournaments have the opposite problem: teams play too few matches for "two seasons of history" to mean anything. Leaving this undecided means either a thin slate or a ledger quietly diluted by guesswork.

## Options considered

### Option 1: A competitions table with a data gate, shadow mode and migration only state changes

Every competition is a row with a state. A weekly job checks its data, it runs privately in shadow for four weeks while settlement grades it, and a reviewed migration switches it live once it performs close to the core leagues.

**Pros**:
- The public ledger only ever contains competitions that proved themselves under real conditions.
- Every coverage change is reviewed and recorded in git.
- Phases set the order, but a competition can move as soon as it's ready.

**Cons**:
- Slow: at least four weeks per competition.
- Shadow picks cost LLM calls and API requests that no user sees.

### Option 2: Date based phases with no per competition checks

Switch each phase on at a planned date, as the original suggestion laid out.

**Pros**:
- Simple to plan and explain.
- Fast to add many competitions.

**Cons**:
- A league with missing line ups or stats goes public anyway, and its weak picks hit the ledger.
- No signal for when a league should be switched off.

### Option 3: Everything at launch

Enable every listed competition from day one.

**Pros**:
- The fullest slate from the start.

**Cons**:
- The highest LLM and API cost, and the slate becomes too long to scan.
- The most thin data leagues in the public record, at the moment trust matters most.

### Option 4: Back test only, then go live

Run the statistical engine over last season and switch a competition on if the back test is good.

**Pros**:
- Fast, with no ongoing shadow cost.

**Cons**:
- Skips the LLM step and today's data quality, which is where real problems show up.

## Rationale

Option 1 matches the product's core promise. SignalXI sells honest, graded accuracy, so the question for any new competition is "will its picks hold up in public?", and only real, graded picks answer that. Four weeks of shadow at the core leagues' standard (within 5 points) is the cheapest way to answer it without risking the public record. A back test (Option 4) misses the LLM and live data quality, where failures actually happen. Date based phases (Option 2) would let a weak league into the ledger simply because its date arrived.

Migration only state changes were chosen over an admin screen because what goes into the public ledger is a load bearing decision. A reviewed SQL change with a git history fits a small team now, and an admin screen with audit logging can come later. The engineer chose alerts rather than automatic demotion for underperforming leagues, which keeps a human in the loop for a decision that removes content users may rely on.

The 40 fixture cap with competition priority keeps both the LLM bill and the slate's length bounded on busy Saturdays, without dropping the leagues Nigerian users care about most. National team tournaments get their own gate (15 competitive matches per team in three years) and a shorter 14 day shadow, because tournaments last only weeks and the normal rule would rule them out entirely. Domestic cups join from the round of 32, per the engineer's choice. Data quality still protects against the weakest early ties, because the gate and shadow apply to cups too.

### Inventory: where the seed list came from

The seed list merges the engineer's expansion research with three changes. The Phase 1 core was trimmed to about 15 competitions with the strongest data and Nigerian demand. The Belgian, Swiss and Austrian leagues moved to Phase 2. And all eight African candidates are listed, letting the data gate decide which can actually run. Priorities rank Nigerian demand first (Big Five, Champions League and AFCON at the top, NPFL and the CAF club cups high within Phase 3) so the slate cap drops the least wanted fixtures first.

Changes after the cross check (2026-11-27): the benchmark is now defined at every stage (the pooled Big Five shadow rate before launch, the live core leagues after, and no promotion when neither has enough picks), because "core average" meant nothing before launch. Small tournaments get a lower bar (10 picks) plus a replay of their previous edition, since 30 picks in 14 days is impossible for a 32 match event. Shadow fixtures get no live polling, to save API budget on data nobody sees. Migration only state is now enforced by database grants, not just convention. The pipeline order, the frozen morning slate, per season cup rounds, per fixture national team eligibility and stored weekly checks remove choices the builder would otherwise invent. Demotion keeps published history in the ledger, because hiding graded picks would be the kind of cherry picking the ledger exists to prevent.
