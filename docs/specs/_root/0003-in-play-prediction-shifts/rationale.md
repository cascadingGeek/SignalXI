# 0003. In play prediction shifts: rationale

## Context

> ⚠️ Premise note: PRD §1 says slates are batch served and live traffic never triggers LLM calls, and its picks are made once, before kickoff. "In play prediction shifts" sounds like it breaks that. The right framing is not "re predict during the match" but "show how the published pick's outlook has moved", computed by the worker and read by visitors like any other cached data. The published pick stays the only thing graded. This spec takes that framing.

SignalXI's value is risk filtering before kickoff, graded in public afterwards. Once a match starts, users only see a score (spec 0002), and they can't tell whether the pick they followed is still in good shape. The engineer asked for shifts so users can follow how predicted games are going and how reliable the predictions have been.

Three forces constrain the design. First, PRD §1: the LLM never invents statistics, live traffic never triggers LLM calls, and the statistical engine is pure Python with no network access. Second, trust: the public ledger grades only the pre match primary pick (anti cherry picking rule, PRD §5.4), so anything live must never blur that record. Third, responsible gambling: live numbers can push users to chase bets mid match, and SignalXI is legally informational analytics only (PRD §2.3).

The engine already models goals with Poisson rates, but today the PRD stores only each pick's label, not the chance behind it. Without the pre match chance and goal rates there is no baseline to measure a shift against. Not deciding leaves the request unanswered, or invites an LLM based shortcut that would break both cost control and the grounded explanations rule.

## Options considered

### Option 1: Deterministic minute by minute model in the worker, labels relative to the published pick

On every live poll, the worker reruns a pure goal model from the live score, minute and red cards, compares the result with the published chance, and moves the published label up or down in fixed steps.

**Pros**:
- No LLM: keeps PRD §1, costs nothing per poll, and is fully testable.
- Starting from the published label means no confusing jump at kickoff when the LLM's label and a threshold disagree.
- Handles every PRD market, including path dependent ones (1UP, both halves), exactly.

**Cons**:
- Constant rates and fixed red card factors are a simplification that needs tuning.
- Needs two new stored values from the slate pipeline.

### Option 2: Same model plus templated notes

Option 1, plus short rule picked notes ("Red card for the home side at 54'").

**Pros**:
- Gives a reason with each shift, without an LLM.

**Cons**:
- More copy to maintain and translate into every market's terms; the engineer chose labels only.

### Option 3: Deterministic numbers plus an LLM note on big swings

The worker calls the LLM only when a chance moves sharply, to write a grounded explanation.

**Pros**:
- Richer explanations at the moments that matter.

**Cons**:
- LLM cost and latency during matches, at the moments of heaviest traffic.
- Pushes the LLM into the live path the PRD keeps it out of.

### Option 4: Fixed thresholds on the live chance

The live label comes straight from the live chance (for example 75% or more is Strong).

**Pros**:
- Simple and independent of the LLM's label.

**Cons**:
- Often disagrees with the published label from the first minute, which reads as the app contradicting itself.

## Rationale

Option 1 fits every force in Context. It keeps the LLM out of the live path (PRD §1), reuses the engine's own goal model so the live chance at minute 0 equals the published chance by construction, and keeps the ledger's anti cherry picking rule intact because shifts are stored apart from picks and never graded. Anchoring the live label to the published label, and comparing the arrow with it too, means "↓" always means "worse than when we published it". That is honest and stable, and it doesn't flicker minute to minute.

A minute by minute Markov chain was chosen over closed form Poisson sums because several PRD markets depend on the path of the match, not just the final count: 1UP needs "led by one at any point", and both halves markets need goals per half. A step table over 90 minutes handles all of them exactly and stays deterministic, which the engine's ban on unseeded randomness requires. Simulation would also work, but it adds seeds and noise to a value users see move.

The engineer chose labels with arrows over percentages, which also lowers the chasing risk: a raw live chance reads like odds. The live chance is still stored in snapshots, so the model can be checked and tuned later without ever showing it. Hysteresis of 3 points and a cap of two steps were added so the label doesn't bounce around a boundary or swing from Strong to a phantom label beyond the ladder. Decided picks freeze with neutral wording because the engineer turned down live win or loss status in spec 0002; settlement stays the only place a result is declared.

Changes after the cross check (2026-11-27): the engineer chose to show the real chance now, so time running out moves Over picks down and Under picks up; comparing against an "expected path" was rejected because a pick could read Strong while nearly lost. A pick is now decided only by the score path or the end of its period, never by the model's clock, and expected stoppage minutes keep 90+3 from reading as "no time left". A market rules table covers every PRD §3.2 market, including Draw No Bet (chance of winning given no draw) and 1UP (led by one at any point). The model rebuilds its path state from the stored events on every poll, so a restart loses nothing, and it is vectorised with numpy, which the engine already allows. The production flag is gated on the legal review rather than left as a follow up, because a "Strong Candidate" label moving during a match reads like a signal whatever the disclaimer says.
