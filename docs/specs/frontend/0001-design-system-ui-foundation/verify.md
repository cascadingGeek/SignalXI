# Verify: design system & UI foundation · spec 0001 · updated 2026-11-25
_Steps derived from spec 0001 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Setup: in `frontend/`, set `NEXT_PUBLIC_APP_ENV=local` and `NEXT_PUBLIC_ADS_ENABLED=true` in `.env.local`, then `pnpm dev`.

## UI / manual
- [x] Set the phone or OS to light mode, clear site data, open `/` → page is Midnight with no light flash → AC-1
- [x] On `/dev/ui`, press the sun button → page turns Light, button now reads "Switch to midnight mode"; reload → still Light → AC-2
- [x] Open `/dev/ui` in a second tab, switch theme in the first → the second tab follows → AC-2
- [x] DevTools Network on `/dev/ui` → no request to `fonts.googleapis.com` or `fonts.gstatic.com`; headlines in Bricolage, odds in Geist Mono → AC-3
- [x] `/dev/ui` shows every part in the Midnight and Light panels: badges, buttons, input, checkbox, tabs, card, drawer, skeletons, all nine error kinds, empty state, every ad size, 18+ note → AC-6, AC-11
- [x] The four badges read "Strong Candidate", "Moderate Candidate", "High Risk (Avoid)", "Insufficient Data", each with an icon → AC-5
- [x] Turn on "reduce motion" in the OS → skeletons stop pulsing → AC-7
- [x] Error cards: "Something went wrong" shows "Error reference SX-500-7F3A"; others show none; "Sign in", "See plans" and "Go to today's slate" are links to `/`; "Try again" bumps the retry counter → AC-8
- [x] Open `/does-not-exist` → "This page is offside" with "Back to the slate" → AC-9
- [x] Set `NEXT_PUBLIC_ADS_ENABLED=false`, restart → no ad boxes on `/dev/ui` → AC-10
- [x] Narrow the window below 768px → 728 × 90 and 970 × 90 slots hide; below 1280px the 300 × 600 hides; nothing scrolls sideways at 360px → AC-10
- [x] Set `NEXT_PUBLIC_APP_ENV=production`, restart → `/dev/ui` is a 404 → AC-11
- [x] Below 1024px the bottom nav shows and never covers the last content; at 1024px and up it is gone and the header nav shows → AC-6
- [x] `frontend/design.md` covers type, both palettes, contrast rules, spacing, badges, verdict colours, ad inventory, states, and links the canvas → AC-13

## Commands
- [x] `pnpm typecheck && pnpm lint` → clean → all
- [x] `pnpm test` → 39 pass, including `contrast.test.ts` (AC-5, AC-12) and `tests/architecture/colour-literals.test.ts` (AC-4) → AC-4, AC-5, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12
- [x] `pnpm test:e2e theme ui-foundation` with `pnpm dev` running → 9 pass (Midnight before scripts, persistence, tab sync, axe in both themes, 44px targets, no Google font requests, bottom nav never covers the footer) → AC-1, AC-2, AC-3, AC-12
- [x] `pnpm build && pnpm start -p 3100`, then `E2E_BUDGET=1 E2E_WEB_URL=http://localhost:3100 pnpm test:e2e budget` → `/` and `/dev/ui` under 2MB, fonts under 150KB (last run: 262KB and 71KB on `/`, 355KB and 95KB on `/dev/ui`) → AC-14

## Value sourcing checks
- [x] Theme: set `localStorage.sx-theme = "light"` then reload → Light; delete the key → Midnight (default, OS ignored)
- [x] Badge: render each `Classification` → label and colours come from the fixed map
- [x] Error kind: an `ApiError` with kind `rate_limited` → "Slow down a little"; an unknown kind → "Something went wrong"; a `TypeError` while offline → "You're offline"
- [x] Reference code: only shown when `ApiError.requestId` is set; never invented on the client
- [x] Ad visibility: flag on plus guest → shows; flag on plus premium → hidden; flag off → hidden for everyone
- [x] Preview route: `NEXT_PUBLIC_APP_ENV` unset → treated as production → 404

## Acceptance criteria coverage
- AC-1 to AC-3: theme and font steps, `theme.spec.ts`, `ui-foundation.spec.ts`
- AC-4: colour literal architecture test
- AC-5, AC-12: badge steps, contrast unit test, axe in both themes, target size test
- AC-6, AC-11: preview page steps
- AC-7: reduced motion step, `skeleton.test.tsx`
- AC-8, AC-9: error card and 404 steps, `error-state.test.tsx`, `error-copy.test.ts`, `error-pages.test.tsx`
- AC-10: ad steps, `ad-slot.test.tsx`
- AC-13: design.md step
- AC-14: budget command

## Update 2026-11-27: new canvas (logo, signal bars, drawers, loader, nav sets)
- [ ] At 390px, `/dev/ui` → "Open match drawer" → a bottom sheet with a handle, 28px top corners, close button top right; Escape closes it → AC-6
- [ ] At 1366px, the same button → a right side panel (max 448px), no handle → AC-6
- [ ] "Open kickoff alert prompt" → a bottom sheet with "Turn on alerts" and "Not now", both 44px or taller → AC-6, AC-12
- [ ] Toggle "Navigation as" Member / Guest → the tab bar reads Slate · Live · Audit · Ledger · Account, then Sign in for guests → AC-6
- [ ] The header shows the logo mark beside "SignalXI"; the link's accessible name is "SignalXI" → AC-6
- [ ] Badges show 3, 2, 1 and 0 (dashed) signal bars for Strong, Moderate, Avoid, Insufficient, with the text label unchanged → AC-5
- [ ] The Loading section shows the logo loader bouncing; with reduced motion emulated it stands still → AC-7
- [ ] The Empty section shows the `no-results` illustration with `alt=""` → AC-6
- [ ] `pnpm test:e2e tests/e2e/ui-foundation.spec.ts` (with the cached Chromium config on macOS 12) → axe clean in both themes, every control 44px → AC-12
