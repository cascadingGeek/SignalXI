# Review, feat/design-system, 2026-11-26

**Reviewed by**: Sonnet 5.5 (author on a different model)
**Scope**: about 60 files, branch vs main (mostly untracked)
**Verdict**: Approve with nits

## Summary
The change adds the design tokens, theme switch, fonts, shared parts, error pages, ad slot, dev preview page and the tests that guard them. It follows the spec closely and the project rules (named exports, `@/` imports, no colour literals in components, env read in one place). I found no blockers or majors. The issues are small gaps between the spec and the code, plus one browser support risk.

## Minor
### 🟡 Body padding relies on `:has()`, `frontend/src/app/layout.tsx:27`
**Problem**: `has-data-bottom-nav:pb-[...]` uses the CSS `:has()` selector, which needs Chrome 105 or newer.
**Why it matters**: The target is mid range Android, where older WebViews exist. There the padding is dropped and the fixed BottomNav covers the footer and the 18+ note.
**Suggested fix**: Add the padding in the shell below `lg` without `:has()`, or have the page that renders BottomNav add the spacer. Or accept the browser floor and write it in the spec.

### 🟡 Fonts differ from the spec, `frontend/src/app/fonts.ts:1`
**Problem**: Spec AC-3 and the Type section say Geist and Geist Mono come from the `geist` package and Bricolage is a variable font with the `opsz` axis. The code loads all three from `next/font/google` and Bricolage with fixed weights 600 and 800. `geist` is not in `package.json`.
**Why it matters**: The build now needs Google for all three fonts, which the spec said to avoid. Runtime is still self hosted, and the budget test passes, so this is drift and not a bug.
**Suggested fix**: Either follow the spec, or update the spec and rationale to match what shipped.

### 🟡 AdSlot is not an `aside` with a label, `frontend/src/components/ad-slot.tsx:30`
**Problem**: The spec says `<aside aria-label="Advertisement">`. The code renders a plain `div`.
**Why it matters**: Screen reader users get no landmark for the ad region.
**Suggested fix**: Use `aside` with `aria-label="Advertisement"`, and add a unit test line for it.

### 🟡 Global error page has no 18+ note, `frontend/src/app/global-error.tsx:24`
**Problem**: It replaces the whole document, so the footer from the layout is gone.
**Why it matters**: The project rule says to show the 18+ and responsible gambling disclosure. The page is rare but is a full page.
**Suggested fix**: Add one plain line with the same wording, using inline styles.

### 🟡 Theme colour is fixed to Midnight, `frontend/src/app/layout.tsx:20`
**Problem**: `themeColor: "#070b12"` is set for every visitor, including those on Light.
**Why it matters**: The browser bar stays dark on a light page. A hex literal also sits outside the colour guard.
**Suggested fix**: Give `themeColor` two entries with media queries, or update it from the theme toggle.

## Nits
- ⚪ `frontend/src/app/error.tsx:5`, uses `retry` (correct for this Next version, per its docs) but the spec says `reset`. Update the spec.
- ⚪ `frontend/tests/architecture/colour-literals.test.ts:5`, the hex pattern could flag a link like `#abc12`, and it does not scan `src/app`. Fine today, worth knowing.
- ⚪ `frontend/src/components/ui/button.tsx:25`, `xs`, `sm` and `icon-xs` sizes are under 44px. Spec allows only default, lg and icon, so the others invite target size failures. Consider removing them.

## Strengths
- Token table matches the spec for both themes, with a unit test that computes the contrast pairs.
- Server and client agree on the theme at first paint, and the toggle avoids a hydration mismatch.
- Error copy is one typed map with an exhaustive record, a safe fallback, and no invented reference codes.
- Good e2e coverage: theme before scripts, tab sync, axe in both themes, target sizes, font and size budget.

## Test coverage
Configured and adequate. Unit tests cover the badge, error copy and states, error pages, ad slot flag and premium rules, skeleton class, header, bottom nav, footer, theme toggle and env parsing. E2E covers theme, accessibility and budget. Small gaps: no test for the AdSlot landmark (not built yet), and the `:has()` padding is only checked in a modern browser.

## Follow up, 2026-11-26
All five minor findings and all three nits are resolved.
- `:has()` padding: kept. Next.js 16 and Tailwind 4 already require Chrome 111 or newer, so it adds no new browser limit. The floor is now written in the spec layout section.
- Fonts: the spec was updated to match the code. The `geist` package plus a variable Bricolage measured 218KB of fonts on `/` (no Latin subsetting), over the AC-14 limit of 150KB. The Latin subset setup from `next/font/google` stays at 71KB and is still self hosted at runtime.
- AdSlot: now an `aside` with `aria-label="Advertisement"`, plus an optional `placement` prop so several slots on one page stay unique landmarks (axe `landmark-unique`). A unit test covers both.
- Global error page: shows the 18+ line with inline styles.
- Theme colour: `ThemeColorSync` copies the active `--background` into the `theme-color` meta whenever the `<html>` class changes. An e2e test covers it.
- Nit, `error.tsx`: the spec now says `retry()`, the Next.js 16 name, matching the code.
- Nit, colour guard: the hex pattern only matches 3, 4, 6 or 8 digits, so `#abc12` no longer trips it. It now scans `src/app` too, allowing only `globals.css`, `global-error.tsx` and `layout.tsx`.
- Nit, Button: the `xs`, `sm`, `icon-xs`, `icon-sm` and `icon-lg` sizes are gone. Only `default`, `lg` and `icon` remain, as the spec allows.
Checks: lint, typecheck, 62 unit tests, `next build`, and 12 e2e tests (theme, axe in both themes, targets, budget) all pass.
