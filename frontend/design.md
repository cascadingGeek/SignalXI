# SignalXI design system

source: spec [frontend 0001](../docs/specs/frontend/0001-design-system-ui-foundation/index.md) and the design canvas "SignalXI Web & Mobile" (https://claude.ai/artifact/1t4J5GyAVk5ogSjz5iuEug, private until shared)
tokens: `src/app/globals.css` is the source of truth for every value below. Change values there, not here.
preview: `/dev/ui` (served when `NEXT_PUBLIC_APP_ENV` is `local` or `preview`) shows every part in both themes and every state.

## Character

A calm, focused night time tool for people about to stake money. Dark first (Midnight), dense but readable, with one cool blue accent. Colour is reserved for risk: green, amber, red and grey mean something, so nothing decorative uses them. Big confident display type for headlines and numbers, quiet neutral text everywhere else. Honest about limits: locked picks show a count, never a fake blurred pick.

## Build mandate

- Midnight is the default for everyone. Light is a choice the user makes with the sun or moon button, and it is remembered on the device (`sx-theme`).
- Every screen ships its loading, error and empty states. Skeletons copy the real layout's shape; spinners live only inside buttons.
- Errors say what happened, whose side it is on, one next step, and a reference code when the server sent one (`ErrorState`, copy in `src/lib/error-copy.ts`).
- Every page shows the 18+ disclosure (`SiteFooter` does this in the root layout).
- Mobile first. Below 1024px a single column with `BottomNav`. At 1024px and up, header navigation and the three column layout from the canvas (240px filters, fluid centre, 300px ad rail from 1280px).
- Touch targets are at least 44 by 44 px. Inline text links inside a sentence are the only exception.
- No colour literals in `src/components/` or `src/features/`; a test enforces it. Use the token utilities.

## Type

| Role | Utility | Family | Use |
|---|---|---|---|
| Display | `font-display` | Bricolage Grotesque 600 and 800 | Headlines, big numbers. Tight tracking from 32px up |
| Interface | `font-sans` | Geist | All other text. Inputs stay at 16px so iOS does not zoom |
| Numbers | `font-mono` + `tabular-nums` | Geist Mono 500 and 600 | Odds, kickoff times, reference codes |

All three load Latin only through `next/font/google` and are served from our own domain. Geist Mono is not preloaded; it loads on pages that use it. Measured cost: 71KB of fonts on `/`, 95KB on a page using all three (budget 150KB).

Scale: `text-xs` (12px) is the smallest body size; 10px is allowed only for the uppercase ADVERTISEMENT label. `text-sm` (14px) for dense rows, `text-base` (16px) default. Display sizes 24, 32, 52 and 76px.

## Colour

Both palettes live in `globals.css`: Light under `:root, .light`, Midnight under `.dark`. Key roles:

| Token | Midnight | Light | Role |
|---|---|---|---|
| `background` | #070B12 | #F3F5F8 | Page |
| `card` | #0F1520 | #FFFFFF | Cards, header, footer |
| `raised` | #151D2A | #F3F5F8 | Pick bar, drawer, menus |
| `border` | #212C3C | #DDE3EB | Dividers and card edges (decorative) |
| `control` | #5E6E85 | #7D899B | Input and checkbox outlines (3:1) |
| `foreground` / `muted-foreground` | #EDF1F7 / #97A4B6 | #0B1220 / #536173 | Text |
| `primary` | #6E9BFF | #2C5BDB | Actions, focus ring, active nav |
| `skeleton` | #1B2533 | #E3E8EF | Loading shapes |
| `ad` / `ad-line` | #0B111A / #33415A | #EEF1F5 / #B9C3D0 | Ad slot fill and dashed edge |

Contrast rules (a unit test computes them from `globals.css`): text 4.5:1 or more on `background`, `card` and `raised`; badge text 4.5:1 on its tint; control outlines 3:1. Badges and muted text never sit on `accent`, an ad box or the paper ticket.

## Classification badges

`ClassificationBadge` in `src/features/predictions/`. The text carries the meaning; the icon is decorative.

| Class | Label | Tokens | Icon |
|---|---|---|---|
| `STRONG` | Strong Candidate | `strong` on `strong-bg` | CircleCheck |
| `MODERATE` | Moderate Candidate | `moderate` on `moderate-bg` | CircleMinus |
| `HIGH_RISK_AVOID` | High Risk (Avoid) | `avoid` on `avoid-bg` | TriangleAlert |
| `INSUFFICIENT_DATA` | Insufficient Data | `insufficient` on `insufficient-bg` | CircleHelp |

Size `sm` on dense slate rows, `md` in the fixture drawer.

## Slip audit verdicts and the paper ticket

The same in both themes, because they sit on the paper ticket (`paper` #F3EEE2, `ink` #1B1F24). Tokens are ready; the verdict badge is built with Slip audit (feature 27).

| Verdict | Background / text |
|---|---|
| Keep | `keep` / `keep-fg` |
| Keep (Value) | `keep-value` / `keep-value-fg` |
| Cautious | `cautious` / `cautious-fg` |
| Drop | `drop` / `drop-fg` |
| Drop (No Value) | `drop-no-value` / `drop-no-value-fg` |

## Spacing and shape

Tailwind's 4px scale. Controls `rounded-xl` (about 17px from `--radius` 12px), cards `rounded-2xl`, badges and chips `rounded-full`, the mobile drawer `rounded-t-3xl`. Depth comes from surface steps (`background` to `card` to `raised`), not shadows.

## States

Every data screen handles five: **ready**; **loading** (skeletons in a `role="status"` region with `aria-busy`, a 1.4s pulse that stops under reduced motion); **offline** (the last saved slate plus a banner, never a blank page); **error** (`ErrorState` with the kind from `toErrorKind`); **empty** (`EmptyState` with one way forward).

## Ad slots

`AdSlot` reserves the exact box so nothing jumps when an ad arrives. It renders nothing unless `NEXT_PUBLIC_ADS_ENABLED` is true, and never for premium viewers. No ad network is wired yet; that is its own decision.

| Size | Where | Shows from |
|---|---|---|
| 728 × 90 | Leaderboard under the nav (slate, ledger) | 768px |
| 970 × 90 | Landing page billboard | 768px |
| 300 × 250 | Desktop right rail top; mobile in feed after the second free pick | all widths |
| 300 × 600 | Desktop right rail below the ledger widget | 1280px |
| Native (fluid × 110) | After the competition groups | all widths |
| 320 × 50 | Mobile anchor above the bottom nav | all widths |
| 320 × 100 | Mobile landing page | all widths |

Never inside a pick card, the fixture drawer, sign in, checkout, a slip audit, or an error or empty state.
