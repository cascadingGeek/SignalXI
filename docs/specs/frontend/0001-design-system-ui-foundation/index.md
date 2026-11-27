# 0001. Design system and UI foundation for the SignalXI PWA

**Date**: 2026-11-25
**Status**: In Progress

## Summary

This spec turns the "SignalXI Web & Mobile" design canvas into code that every later screen can share. That means colour tokens (named colours) for Midnight and Light, three self hosted fonts, a theme switch that opens in Midnight, and a small set of shared parts. The parts are buttons, inputs, tabs, a drawer, skeletons, error and empty states, ad slots, the classification badge and the app shell. It covers no real pages: landing, sign in and the slate are built later in their own features, using these parts. A dev only preview page shows every part in both themes and every state, and an automated accessibility check runs against it.

## Requirements

**User stories**:
- As a bettor on a mid range Android phone, I want the app to open fast in a dark theme that's easy on the eyes, with clear risk labels, so I can scan picks quickly at night.
- As a bettor who prefers light screens, I want to switch to Light once and have the app remember it on this phone.
- As a bettor on a bad connection, I want loading and error screens that tell me plainly what happened and what to do next.
- As a builder of later features, I want ready made, accessible parts and tokens, so every screen looks the same without copying styles.

**Acceptance criteria**:
- **AC-1**: On a first visit with no saved choice, the app renders in Midnight whatever the phone's own setting is. The next-themes inline script puts the `dark` class on `<html>` before first paint (it is already present at `domcontentloaded`), so there is no flash of the light theme.
- **AC-2**: The theme toggle switches between Midnight and Light. Once mounted, its accessible name says which mode it switches to. Before mount it is labelled "Switch theme". The choice is saved on the device (key `sx-theme`), survives reloads, syncs across open tabs, and works for guests.
- **AC-3**: Bricolage Grotesque (display), Geist (interface text) and Geist Mono (odds, times, reference codes) are served from our own origin. No runtime request goes to `fonts.googleapis.com` or `fonts.gstatic.com`. Text stays visible while fonts load (`display: swap`).
- **AC-4**: Every colour on the canvas Foundations board exists as a CSS variable for both themes and is exposed as a Tailwind utility. Files under `src/components/` (except `src/components/ui/`) and `src/features/` contain no colour literals: no hex, `rgb(`, `hsl(`, `oklch(`, or arbitrary colour classes such as `bg-[#…]`.
- **AC-5**: `ClassificationBadge` renders the four PRD classes with these exact labels: `STRONG` as "Strong Candidate", `MODERATE` as "Moderate Candidate", `HIGH_RISK_AVOID` as "High Risk (Avoid)", and `INSUFFICIENT_DATA` as "Insufficient Data". Each has its token colours and leading signal bars hidden from screen readers (3 lit for `STRONG`, 2 for `MODERATE`, 1 for `HIGH_RISK_AVOID`, none with dashed outlines for `INSUFFICIENT_DATA`), carries its meaning in text and not colour alone, and its text meets AA (4.5:1) on `card` and `background` in both themes.
- **AC-6**: These shared parts exist and render correctly in both themes:
  - Button, Input, Label, Checkbox, Tabs, Sheet (drawer), Card, Skeleton
  - ThemeToggle, ErrorState, EmptyState, AdSlot, ResponsibleGamblingNote
  - AppHeader (with the BrandMark logo), BottomNav (below 1024px only), SiteFooter
  - BrandMark, BrandLoader, and Sheet in its `bottom` and `responsive` sides
- **AC-7**: Skeletons pulse once every 1.4s (`animate-skeleton-pulse`), and stop pulsing under `prefers-reduced-motion: reduce`. The page that renders a skeleton puts `aria-busy="true"` on the loading region, and `/dev/ui` shows that pattern.
- **AC-8**: `ErrorState`, given a kind from `toErrorKind(error)`, shows a title, a one line cause, one action and, when a request id exists, a reference line.
  - The copy comes from one map covering every backend `ErrorKind` plus `offline`.
  - An unknown kind falls back to the `internal` copy.
  - Each action is either a callback or a link, as set in the copy map.
- **AC-9**: Next.js error pages exist:
  - `not-found.tsx` shows "This page is offside" with a link to `/`.
  - `error.tsx` shows the `internal` copy with no reference line, and its Try again button calls `retry()` (the Next.js 16 name for the old `reset`).
  - `global-error.tsx` renders the `internal` wording in plain HTML with inline styles and a Reload button, and still works when the root layout fails.
- **AC-10**: `AdSlot` renders nothing when `NEXT_PUBLIC_ADS_ENABLED` is not true, or when the viewer tier is `premium`.
  - Otherwise it reserves the exact size of one inventory slot, with an "Advertisement" label, so nothing shifts when an ad loads.
  - Each size shows only from its minimum breakpoint up, and is capped at `max-w-full`, so it never overflows a 360px screen.
  - Sizes outside the inventory are a type error, and an unknown size at runtime renders `null`.
- **AC-11**: `/dev/ui` renders every part from AC-6 in both themes and every state (ready, loading, error, empty, offline). When `NEXT_PUBLIC_APP_ENV` is `production` or unset, it returns a 404.
- **AC-12**: Running axe on `/dev/ui` reports zero violations, once with each saved theme. Interactive controls have a target of at least 44 × 44 px, with two exemptions:
  - Inline text links inside a sentence are exempt.
  - A checkbox meets the size through its wrapping label.

  Text and outlines meet the contrast table in *Tokens*: 4.5:1 for text, and 3:1 for form control outlines (WCAG 1.4.11).
- **AC-13**: `frontend/design.md` documents the type scale, both colour palettes, spacing and radius, the four classification badges, the slip audit verdict colours, the ad inventory and its rules, the five screen states, the logo and its exported files, the loader, the illustrations, the drawer rules, and a link to the design canvas.
- **AC-14**: A cold load of `/` (the current home route, measured against `next build && next start`, in a fresh browser context with service workers blocked) transfers under 2MB in total, counted as compressed body plus headers. The `.woff2` font files together transfer under 150KB.
- **AC-15**: `BrandLoader` shows the logo with its bars rising in turn and the ball bouncing off the top bar, as pure CSS with no animation library. Under `prefers-reduced-motion: reduce` it stands still. It announces its label as a polite `role="status"`, and the logo inside is decorative.
- **AC-16**: `Sheet` with `side="responsive"` is a bottom sheet (handle, 28px top corners, safe area padding) below 1024px and a right side panel up to 448px wide from 1024px up. `side="bottom"` is the bottom sheet at every width. Both close on Escape and on the close button, and trap focus while open.

## Decision

**Chosen option**: Option 1: shadcn themed by canvas tokens, next-themes, next/font, reserved ad slots

Map the canvas tokens onto shadcn's CSS variables in `globals.css` (Light in `:root`, Midnight in `.dark`). Let next-themes own the class with Midnight as the fixed default. Self host the fonts: all three through `next/font/google`, Latin subset only, so they are served from our own origin at runtime. Build the shared parts as shadcn primitives plus a few domain free composites. Reserve ad slots behind a flag, and pick the ad network in a later spec.

**Implementation skills**: `shadcn` (`shadcn-ui/ui`, `.claude/skills/shadcn/`) · `tailwind-design-system` (`wshobson/agents`, `.claude/skills/tailwind-design-system/`) · `nextjs-app-router-patterns` (`wshobson/agents`, `.claude/skills/nextjs-app-router-patterns/`) · `vercel-react-best-practices` (`vercel-labs/agent-skills`, `.claude/skills/vercel-react-best-practices/`) · `vitest` (`antfu/skills`, `.claude/skills/vitest/`) · `zod` (`pproenca/dot-skills`, `.claude/skills/zod/`)

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Design source**: the canvas "SignalXI Web & Mobile", https://claude.ai/artifact/Jtn9yosDQK2WZ1ztYMSpWN (37 boards, updated 2026-11-27; it replaces the first canvas, https://claude.ai/artifact/1t4J5GyAVk5ogSjz5iuEug).
- The Tokens board lists every token with its Midnight and Light value, plus type, spacing and layout rules. The States and EdgeStates boards hold the screen states.
- Every later page has its board: Landing, Slate (Midnight and Light), Fixture, Avoid, Live, Ledger, Audit and audit history, Pricing, Auth, Account, Legal. Each feature builds from its own board(s).
- If the canvas and this spec disagree, this spec wins, and the canvas gets updated.

**App navigation** (decided 2026-11-27):
- Mobile BottomNav (below `lg`) has five slots in the same order for everyone. Only the last slot changes:

  | Who | Slots |
  |---|---|
  | Member (free or paid) | Slate · Live · Audit · Ledger · Account |
  | Guest | Slate · Live · Audit · Ledger · Sign in |

  Icons (lucide): Slate `LayoutList`, Live `Radio`, Audit `ReceiptText`, Ledger `ChartColumn`, Account `CircleUser`, Sign in `LogIn`. The Ledger stays in the guest bar because it is the public proof of trust. The canvas's separate guest bar (Home · Slate · Live · Audit · Sign in) is not used. Guests reach the landing page through the wordmark in AppHeader.
- At `lg` and above, AppHeader shows the same destinations as text links. Its actions slot holds "Sign in" for guests and the account avatar for members, which opens the Account page.
- The caller picks the item set from the session. BottomNav itself stays unaware of auth.
- Account settings uses the same `ThemeToggle` and device only `sx-theme` value; no theme is stored on the profile. Notification switches are not shown until push notifications ship (scope Deferred).

**Data model sketch**: no database change. The only persisted value is the theme choice: `localStorage["sx-theme"]` holds `"dark"` (Midnight) or `"light"`, and next-themes owns it. No profile column, by decision. Nothing about the theme ever reaches the server.

**Tokens** (CSS variables in `src/app/globals.css`; Light in `:root`, Midnight in `.dark`; Tailwind names come from `@theme inline`):

| Token (Tailwind name) | shadcn variable it backs | Midnight | Light |
|---|---|---|---|
| `background` | `--background` | `#070B12` | `#F3F5F8` |
| `card` | `--card` | `#0F1520` | `#FFFFFF` |
| `raised` | `--popover`, `--secondary` | `#151D2A` | `#F3F5F8` |
| `border` | `--border` (decorative dividers, card edges) | `#212C3C` | `#DDE3EB` |
| `control` | `--input` (input, checkbox and select outlines) | `#5E6E85` | `#7D899B` |
| `foreground` | `--foreground` | `#EDF1F7` | `#0B1220` |
| `muted-foreground` | `--muted-foreground` | `#97A4B6` | `#536173` |
| `primary` | `--primary`, `--ring` | `#6E9BFF` | `#2C5BDB` |
| `primary-foreground` | `--primary-foreground` | `#06101F` | `#FFFFFF` |
| `accent` | `--accent` (soft tint) | `rgba(110,155,255,0.14)` | `rgba(44,91,219,0.09)` |
| `pill` | new | `#1A2332` | `#E9EDF2` |
| `skeleton` | new | `#1B2533` | `#E3E8EF` |
| `ad` / `ad-line` | new | `#0B111A` / `#33415A` | `#EEF1F5` / `#B9C3D0` |
| `strong` / `strong-bg` | new | `#3DD68C` / `rgba(61,214,140,0.13)` | `#11774A` / `#DDF3E8` |
| `moderate` / `moderate-bg` | new | `#F5B841` / `rgba(245,184,65,0.13)` | `#7A4D00` / `#FBEFD3` |
| `avoid` / `avoid-bg` | `--destructive` = `avoid` | `#FF6B5E` / `rgba(255,107,94,0.13)` | `#B02E24` / `#FBE3E0` |
| `insufficient` / `insufficient-bg` | new | `#A3AEBA` / `rgba(163,174,186,0.13)` | `#4F5866` / `#E8EBEF` |

Theme independent tokens (the same in both themes, defined once in `:root`):
- Paper ticket: `paper` `#F3EEE2`, `ink` `#1B1F24`.
- Verdict pairs (background / text):
  - `keep`: `#D5EEDF` / `#136B3E`
  - `keep-value`: `#CDEBEC` / `#0B5E61`
  - `cautious`: `#F5E2B5` / `#6E4A00`
  - `drop`: `#F6D3CF` / `#9E241C`
  - `drop-no-value`: `#8E1C26` / `#FFFFFF`
- The verdict badge component belongs to Slip audit (feature 27). Only its tokens land here.

Unused shadcn variables, mapped so shadcn components that read them still look right (no chart library in v1.0):
- `sidebar` = `card`, `sidebar-foreground` = `foreground`, `sidebar-primary` = `primary`, `sidebar-primary-foreground` = `primary-foreground`
- `sidebar-accent` = `accent`, `sidebar-accent-foreground` = `foreground`, `sidebar-border` = `border`, `sidebar-ring` = `primary`
- `chart-1..5` = `primary`, `strong`, `moderate`, `avoid`, `insufficient`
- `muted` = `raised`, `secondary-foreground` = `foreground`, `accent-foreground` = `foreground`

Animation: `@theme` defines `--animate-skeleton-pulse: pulse 1.4s cubic-bezier(0.4, 0, 0.6, 1) infinite`. Skeletons use `motion-safe:animate-skeleton-pulse`.

**Contrast rules** (checked; the build adds a unit test that computes these pairs from the token table):
- Badge text on its `*-bg` tint, measured with the tint composited over `card`, is 4.5:1 or more in both themes. The lowest pairs are Light `strong` at 4.8:1 and Light `avoid` (`#B02E24`) at 5.26:1.
- `muted-foreground` on `background`, `card` and `raised` is 5.4:1 or more in both themes.
- `control` on `card` and `background` is 3:1 or more (form control outlines, WCAG 1.4.11).
- `border` and `ad-line` are decorative and exempt from the 3:1 rule. Nothing relies on them to show where a control is.
- Badges and muted text are placed only on `background`, `card` or `raised`, never on `accent`, an ad box, or the paper ticket.

**Type**:
- **Display**, `font-display` (`--font-display`), Bricolage Grotesque. Loaded as `Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "800"], variable: "--font-bricolage", display: "swap" })` from `next/font/google`. Components use weights 600 and 800 only. Used for headlines and big numbers.
- **Interface**, `font-sans` (`--font-sans`), Geist, from `next/font/google` (`Geist`, Latin subset, `--font-geist-sans`). Components use weights 400 to 700. Used for all other text. The base size is 16px on inputs, so iOS doesn't zoom in on focus.
- **Mono**, `font-mono` (`--font-mono`), Geist Mono, from `next/font/google` (`Geist_Mono`, Latin subset, `--font-geist-mono`, `preload: false` so it loads only on pages that use it), with `tabular-nums`. Weights 500 and 600. Used for odds, kickoff times and reference codes.
- All three need Google only during `next build`; Vercel and CI have network. The `geist` package and a variable Bricolage with the `opsz` axis were tried and measured at 218KB of fonts on `/` (no Latin subsetting), over the AC-14 limit. The subset setup measures 71KB on `/` and 95KB on a page using all three.
- Type scale, in Tailwind classes:
  - `text-xs` (12px) is the smallest size allowed. 10px and 11px only for the uppercase "ADVERTISEMENT" and "AD" labels.
  - `text-sm` (14px) is the body size on dense rows.
  - `text-base` (16px) is the default.
  - Display sizes: 24px, 32px, 52px, 76px, with tight leading and negative tracking from 32px up.

**Spacing, radius, layout**:
- The Tailwind 4px scale, unchanged.
- `--radius: 0.75rem` (12px) for controls. Cards use `rounded-2xl` (16px); badges and chips use `rounded-full`.
- Mobile first:
  - Below `lg` (1024px): a single column with BottomNav, and a 16px side gutter.
  - At `lg` and above: header navigation and no BottomNav. Pages may use the three column layout from the canvas: 240px filter rail, fluid centre, 300px ad rail. The ad rail only appears at `xl` (1280px) and above.
- Every interactive control has a target of at least 44 × 44 px (exemptions in AC-12).
- `layout.tsx`:
  - Sets `suppressHydrationWarning` on `<html>`, because next-themes changes its class before hydration.
  - Adds `viewportFit: "cover"` to `viewport`.
  - Below `lg`, the shell adds bottom padding equal to the BottomNav height plus `env(safe-area-inset-bottom)`, so the fixed nav never covers content.
    The padding uses the CSS `:has()` selector on `<body>`. That needs Chrome 105 or newer, which sits below the floor Next.js 16 and Tailwind 4 already set (Chrome 111, Safari 16.4, Firefox 128), so it adds no new browser limit.
  - Sets a Midnight `themeColor` for first paint. `ThemeColorSync` (in `Providers`) then copies the active theme's `--background` into the `theme-color` meta, so the browser bar follows the toggle.

**Component surface** (this feature has no HTTP endpoints; its "API" is these component contracts):

| Part | Location | Key props | Renders | Notes |
|---|---|---|---|---|
| shadcn primitives: `button`, `input`, `label`, `checkbox`, `tabs`, `sheet`, `card`, `skeleton` | `src/components/ui/` | shadcn defaults; `Button` sizes `default` (h-11), `lg` (h-12), `icon` (size-11) | themed primitives | added with the shadcn CLI, then restyled through tokens only |
| `ThemeToggle` | `src/components/theme-toggle.tsx` | none | sun icon in Midnight, moon in Light; `aria-label` names the target mode | client component; until mounted, renders the same 44px button with `aria-label="Switch theme"` and no icon, to avoid a hydration mismatch |
| `ThemeProvider` | `src/app/providers.tsx` (wraps the existing `QueryClientProvider`) | none | next-themes provider | `next-themes` at version 0.4.6 or later; `attribute="class"`, `defaultTheme="dark"`, `enableSystem={false}`, `themes={["light","dark"]}`, `storageKey="sx-theme"`, `disableTransitionOnChange` |
| `ClassificationBadge`, `SignalBars` | `src/features/predictions/classification-badge.tsx` | `classification: Classification`, `size?: "sm" \| "md"` (`sm` for dense slate rows, `md` for the drawer); `SignalBars` takes `lit: 0 \| 1 \| 2 \| 3` | pill with the label from the PRD map and leading `SignalBars` (`aria-hidden`, `data-lit`): lit bars use `currentColor`, unlit bars the same colour at 25% opacity, and `0` draws three dashed outlines | not interactive, so not a target. `Classification` is the union `STRONG \| MODERATE \| HIGH_RISK_AVOID \| INSUFFICIENT_DATA`; once the slate API exists, it is replaced by the generated type in `api.gen.ts` |
| `ErrorState` | `src/components/error-state.tsx` | `kind: ErrorKind \| "offline"`, `requestId?: string \| null`, `onAction?: () => void`, `title?`, `body?` (overrides) | icon, title, cause line, one action, and "Error reference {requestId}" in mono | `role="alert"`; copy from `errorCopy`. A `callback` action calls `onAction` (the button is hidden if none is given). A `link` action renders `<a href>` from the map |
| `errorCopy`, `isErrorKind`, `toErrorKind` | `src/lib/error-copy.ts` | `errorCopy: Record<ErrorKind \| "offline", { title, body, action: { label, type: "callback" \| "link", href?: string } }>`; `isErrorKind(k: string): k is ErrorKind`; `toErrorKind(error: unknown): ErrorKind \| "offline"` | data and helpers | `ErrorKind` is a string union mirroring `backend/app/core/errors.py`: `invalid`, `unauthorized`, `forbidden`, `not_found`, `conflict`, `rate_limited`, `unavailable`, `internal`. `toErrorKind` returns, in order: `"offline"` for a `TypeError` while `typeof navigator !== "undefined" && navigator.onLine === false`; `ApiError.kind` if `isErrorKind`; otherwise `"internal"` |
| `EmptyState` | `src/components/empty-state.tsx` | `title`, `body`, `icon?`, `illustration?: string` (a `public/illustrations/` path), `action?: { label, onClick \| href }` | centred icon tile, or the illustration through `next/image` with `alt=""`, then title, body, optional action | no `role="alert"` |
| `AdSlot` | `src/components/ad-slot.tsx` | `size: AdSize`, `viewerTier: "guest" \| "free" \| "premium"`, `placement?`, `className?` | `null`, or an `<aside aria-label="Advertisement">` (`"Advertisement, <placement>"` when `placement` is set, so several slots on one page stay unique landmarks) with a fixed size box (`max-w-full overflow-hidden`) and an "ADVERTISEMENT" label | `AdSize` and the smallest breakpoint each one shows at: `320x50`, `320x100`, `300x250` and `native` (fluid width, 110px tall) show at every width; `728x90` and `970x90` from `md` (768px) up; `300x600` from `xl` (1280px) up. Below its breakpoint a slot renders `hidden` |
| `ResponsibleGamblingNote` | `src/components/responsible-gambling-note.tsx` | `variant: "inline" \| "footer"` | "18+ only. Statistical analysis, not guaranteed outcomes. Bet responsibly." | replaces the hard coded footer text in `layout.tsx` |
| `AppHeader` | `src/components/app-header.tsx` | `nav?: { href, label }[]`, `activeHref?: string`, `actions?: ReactNode` | `BrandMark` plus the wordmark "SignalXI" in `font-display` (the "XI" uses `text-primary`) in one home link named "SignalXI"; nav (lg and up) with `aria-current="page"` and the `raised` surface on the active item; ThemeToggle; actions slot | the "Sign in" button is passed in by the auth feature, not built here |
| `BottomNav` | `src/components/bottom-nav.tsx` | `items: { href, label, icon }[]` | fixed bar, `lg:hidden`, `pb-[env(safe-area-inset-bottom)]`, `aria-current="page"` on the active item | the items come from the caller. `/dev/ui` renders both sets from *App navigation* (member and guest) with `#` links |
| `BrandMark` | `src/components/brand-mark.tsx` | `className?` | the logo from the canvas Logo board: three bars on one rising cut in `primary`, the ball in `foreground`, `aria-hidden` | geometry copied point for point from the canvas; token fills so it follows the theme |
| `BrandLoader` | `src/components/brand-loader.tsx` | `label?` (default "Loading"), `className?` | the mark with `motion-safe:animate-signal-bar` on each bar (0, 120, 240ms delays) and `motion-safe:animate-signal-ball` on the ball, plus the label | `role="status"`, `aria-live="polite"`; keyframes `signal-bar` and `signal-ball` live in `globals.css` `@theme` (1.2s loop) |
| `Sheet` sides | `src/components/ui/sheet.tsx` | `side?: "top" \| "right" \| "bottom" \| "left" \| "responsive"` | `bottom` and `responsive` add a decorative handle (`bg-control`), `rounded-t-[28px]`, `border-control` top edge and safe area padding; `responsive` switches to a right panel (`lg:max-w-md`, no handle) from `lg`; scrim `bg-black/60`; title in `font-display` | Radix Dialog underneath, so focus trap and Escape come for free |
| `SiteFooter` | `src/components/site-footer.tsx` | none | ResponsibleGamblingNote (footer variant) only | no links ship yet (Terms and Privacy come with their pages); rendered by the root layout |
| Error routes | `src/app/not-found.tsx`, `src/app/error.tsx`, `src/app/global-error.tsx` | Next.js conventions | not found copy, `ErrorState` with `kind="internal"`, and plain HTML | `error.tsx` ignores `digest` and shows no reference line. `global-error.tsx` uses inline styles and system fonts only (the root layout may have failed), and its button calls `location.reload()` |
| Preview route | `src/app/dev/ui/page.tsx` | none | every part, every state, Midnight and Light panels side by side | calls `notFound()` when `env.NEXT_PUBLIC_APP_ENV === "production"`. Each panel is a wrapper (one with `className="dark"`, one with `className="light"` scoped to override `.dark`) that sets its own `bg-background text-foreground` |

**Error copy** (the `errorCopy` map; feature specific messages such as device limit, payment or slip audit pass `title` and `body` overrides in their own features):

| Kind | Title | Cause line | Action (type, target) |
|---|---|---|---|
| `offline` | You're offline | Check your data or WiFi. We'll show the last saved slate where we can. | Retry (callback) |
| `internal` | Something went wrong | This is on our side, not yours. Try again in a moment. | Try again (callback) |
| `unavailable` | We're having trouble right now | A service we rely on isn't responding. This is on our side, not yours. | Try again (callback) |
| `rate_limited` | Slow down a little | Too many requests in a short time. Wait about 30 seconds, then try again. | Try again (callback) |
| `unauthorized` | You've been signed out | Your session ended. Sign in again to carry on. | Sign in (link, `/`) |
| `forbidden` | This isn't available on your plan | Upgrade to see it, or go back to today's free picks. | See plans (link, `/`) |
| `not_found` | We couldn't find that | It may have moved or expired. | Go to today's slate (link, `/`) |
| `invalid` | Something in that request wasn't right | Check what you entered and try again. | Try again (callback) |
| `conflict` | That changed while you were looking | Refresh to see the latest. | Refresh (callback) |

The `/` links are placeholders. The auth and billing features change the `unauthorized` and `forbidden` targets to their sign in and pricing routes when those exist.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| First paint | Active theme | `localStorage["sx-theme"]`; if missing, `defaultTheme="dark"` (decided: Midnight first, OS setting ignored) |
| ThemeToggle | Icon and accessible name | derived from `resolvedTheme` (next-themes) |
| ClassificationBadge | Label text and colours | the `classification` prop (later the API's `classification` field) through the fixed PRD label map and the tokens above |
| ErrorState | Title, cause, action label, action target | `errorCopy[kind]`; `kind` comes from `toErrorKind(error)` (offline check is client only, then `ApiError.kind` if it is a known kind, else `internal`) |
| ErrorState | Reference code | `ApiError.requestId` (the `request_id` body field, or the `x-request-id` header). The line is hidden when it is null. No code is invented on the client |
| AdSlot | Whether it renders | `env.NEXT_PUBLIC_ADS_ENABLED` and the `viewerTier` prop. Until the auth and entitlement features exist, callers pass `"guest"`; after that, the tier comes from the session's entitlement |
| AdSlot | Box size and smallest breakpoint | the `size` prop through the fixed `AdSize` map (pixels plus breakpoint) |
| `/dev/ui` | Whether it is served | `env.NEXT_PUBLIC_APP_ENV` (`local`, `preview` or `production`; unset counts as `production`) |
| SiteFooter | 18+ text | the constant in `ResponsibleGamblingNote` |

**Key invariants**:
- Components never hold colour literals; colour comes only from tokens (AC-4). Theme switching is a class change, never a prop drilled through.
- Midnight is the default for everyone who hasn't chosen otherwise. The phone's colour setting is never read.
- An `AdSlot` never renders for a `premium` viewer. One never appears inside a pick card, the fixture drawer, sign in, checkout, a slip audit, or an error or empty state. Callers own placement, and `design.md` states the rule.
- Skeletons copy the real layout's shape and size, and stay the default for lists. `BrandLoader` is only for a first app load or a whole screen with no layout yet. Spinners are only allowed inside buttons.
- `src/components/` and `src/lib/` stay domain free. The only domain part, `ClassificationBadge`, lives in `src/features/predictions/`.

**Security model**: the theme is a public preference held on the device; nothing sensitive is stored. The `/dev/ui` preview shows only sample data and is 404 in production. `AdSlot` loads no third party script in this feature, so no consent is needed yet. The network spec must add consent (feature 22) before any ad script ships. `ErrorState` shows only the request id, never the raw server message, so no internal detail leaks.

**Configuration required** (added to `src/lib/env.ts`, the single env reader):
- `NEXT_PUBLIC_ADS_ENABLED`: optional, `"true"` or `"false"`, default `false`. Parsed as `z.preprocess(blankAsUndefined, z.enum(["true","false"]).default("false")).transform(v => v === "true")`, so the app sees a boolean. Turns ad slot reservations on. Keep it off in production until the ad network spec lands.
- `NEXT_PUBLIC_APP_ENV`: optional enum, `local`, `preview` or `production`. Parsed with the same blank preprocess, and the default is `production`. Set it to `local` in `.env.local` and to `preview` on Vercel Preview, so `/dev/ui` is served there.
- Both keys are passed to `parsePublicEnv` by literal `process.env.NEXT_PUBLIC_…` name, so Next.js inlines them into the browser bundle.
- New dependencies:
  - `next-themes` (0.4.6 or later), at runtime.
  - `@axe-core/playwright`, as a dev dependency.

**Critical test scenarios**:
- Happy path, theme:
  - A fresh browser context with `colorScheme: "light"` loads `/`.
  - At `domcontentloaded`, before hydration, `document.documentElement.classList` contains `dark`.
  - Clicking the toggle switches to `light`, and after a reload it is still `light`.
  - A second page in the same context switches when the first one toggles.

  Verifies **AC-1**, **AC-2**.
- Accessibility:
  - Playwright runs axe on `/dev/ui` once with `sx-theme=dark` and once with `sx-theme=light`, and finds zero violations.
  - Every `button` and every non-inline `a` measures at least 44 × 44 px.
  - A unit test computes every pair in *Contrast rules* from the token values.

  Verifies **AC-5**, **AC-11**, **AC-12**.
- Failure case:
  - `toErrorKind` returns `internal` for an `ApiError` with an unknown kind, and `offline` for a `TypeError` with `navigator.onLine` stubbed to false.
  - A null `requestId` hides the reference line.
  - `errorCopy` has a key for every `ErrorKind`; this is a type level exhaustive `Record`.
  - `error.tsx` Try again calls `retry`.

  Verifies **AC-8**, **AC-9**.
- Permission: `AdSlot` with `viewerTier="premium"` renders `null` even when the flag is on, and with the flag off it renders `null` for everyone. `/dev/ui` returns 404 when `NEXT_PUBLIC_APP_ENV=production`. Verifies **AC-10**, **AC-11**.
- Budget:
  - An e2e project runs against `next build && next start` in a fresh context, with `serviceWorkers: "block"`, and sums `request.sizes()` (`responseBodySize` plus `responseHeadersSize`) over a cold load of `/`.
  - It asserts no request reaches a Google Fonts host, that the `.woff2` bytes total under 150KB, and that all bytes total under 2MB.

  Verifies **AC-3**, **AC-14**.
- Guard: an architecture test fails if any file under `src/components/` (except `ui/`) or `src/features/` matches a hex, `rgb(`, `hsl(` or `oklch(` colour, or an arbitrary colour class. Verifies **AC-4**.
- Loader and drawers: unit tests check that `BrandLoader` is a polite status with a decorative logo and that its four animated parts use `motion-safe:` classes; that `ClassificationBadge` sets `data-lit` 3, 2, 1, 0; that `EmptyState` renders a given illustration with `alt=""`. `/dev/ui` screenshots at 390px and 1366px confirm the bottom sheet and the right panel. Verifies **AC-5**, **AC-15**, **AC-16**.
- Motion: a unit test checks that `Skeleton` uses `motion-safe:animate-skeleton-pulse`. jsdom can't evaluate CSS, so the 1.4s duration is checked on the `@theme` token. Verifies **AC-7**.

## Build plan

Tracer Bullet: first one thin thread through every layer (font loading, tokens, theme, one domain part, the preview route and the automated a11y check), then thicken one strand at a time.

1. **Thread.**
   - Add `next-themes`, and wrap `Providers` in `ThemeProvider` with the settings above.
   - Add `suppressHydrationWarning` and `viewportFit: "cover"` in `layout.tsx`.
   - Load Bricolage, Geist and Geist Mono with `next/font/google` (Latin only), replacing Inter. Map them to `--font-display`, `--font-sans` and `--font-mono` in `globals.css`.
   - Write the core tokens (background, card, border, foreground, muted, primary) for both themes.
   - Add `ThemeToggle`, a minimal `AppHeader`, and `ClassificationBadge` for `STRONG`.
   - Add `NEXT_PUBLIC_APP_ENV` to `env.ts`, and a bare `/dev/ui` showing the header and the badge.
   - Add Playwright tests for the theme default and persistence, and the axe check on `/dev/ui`.

   Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-11**, **AC-12**.
2. Complete the token table in `globals.css`: all rows for both themes (including `control`), the theme independent tokens, the `chart-*` and `sidebar-*` mapping, and `--animate-skeleton-pulse`. Add the architecture test that bans colour literals, and the unit test that computes contrast pairs. Satisfies **AC-4**, **AC-5**, **AC-12**.
3. Add and restyle the shadcn primitives (`button`, `input`, `label`, `checkbox`, `tabs`, `sheet`, `card`, `skeleton`): 44px targets, 16px input text, and a skeleton pulse with `motion-safe:` and a 1.4s duration. Satisfies **AC-6**, **AC-7**, **AC-12**.
4. Finish `ClassificationBadge` for all four classes, with unit tests for labels and glyphs. Satisfies **AC-5**.
5. Error handling:
   - Add the `ErrorKind` union, `errorCopy`, `isErrorKind`, `toErrorKind`, `ErrorState` and `EmptyState`.
   - Add `not-found.tsx`, `error.tsx` and `global-error.tsx`.
   - Add unit tests for the copy map coverage, the fallback, the reference line, and `retry`.

   Satisfies **AC-8**, **AC-9**.
6. Add `AdSlot` with the size map, and `NEXT_PUBLIC_ADS_ENABLED` in `env.ts`. Unit tests cover the flag and premium suppression. Satisfies **AC-10**.
7. Add the shell: `BottomNav` and `SiteFooter` with `ResponsibleGamblingNote`. Wire the footer into `layout.tsx`, replacing the inline footer. Satisfies **AC-6**.
8. Complete `/dev/ui`: every part in both themes side by side, and every state (ready, loading, error per kind, empty, offline), plus every ad size. Extend the axe and target size tests to the full page. Add the cold load budget e2e test. Satisfies **AC-6**, **AC-11**, **AC-12**, **AC-14**, **AC-3**.
9. Write `frontend/design.md` (type, palettes, contrast rules, spacing and radius, badges, verdict colours, ad inventory and rules, states). Link the canvas, and save PNG exports of its boards under `docs/design/` so teammates without canvas access can see them. Satisfies **AC-13**.
10. Adopt the 2026-11-27 canvas: `BrandMark` in `AppHeader` with `activeHref`; `SignalBars` in `ClassificationBadge`; the `bottom` and `responsive` Sheet sides; `BrandLoader` with its CSS keyframes; the canvas illustrations in `public/illustrations/` and logo files in `public/brand/`, extracted as is; `EmptyState` `illustration`; `/dev/ui` with member and guest tab bars, both drawers and the loader; unit tests for each. Satisfies **AC-5**, **AC-6**, **AC-13**, **AC-15**, **AC-16**. (Built 2026-11-27.)

## Consequences

**Positive**:
- Every later screen (landing, sign in, slate, drawer, ledger, slip audit) composes from one token set and one set of parts, so Midnight and Light stay consistent automatically.
- The fonts and theme add no layout shift and no flash, with no extra request to a third party at runtime.
- The ad network can be chosen later without touching any page: the slots already reserve space.
- Accessibility regressions in colours or targets fail CI through the axe test, instead of being found by users.

**Negative / tradeoffs**:
- Three font families, though small, still cost an estimated 100KB. A system font only build would be lighter.
- The Light avoid red (`#B02E24`) and the new `control` outline are slightly darker than the canvas, to pass AA. The canvas should be updated to match.
- `next-themes` is a new runtime dependency, and the toggle must render a placeholder until mounted (a small hydration cost).
- A theme choice doesn't follow the user to a second device, by decision.
- Ads are off in production until a later spec. Until then the slots, when enabled in preview, are labelled empty boxes.
- The extracted SVG files in `public/` keep the canvas colours, so they don't follow the theme. That is fine for icons, social cards and the illustrations (drawn on their own palette), but the in app logo must stay the `BrandMark` component.
- Animation stays in CSS for now. If a later screen needs timeline or physics animation that CSS can't do, adding a library such as GSAP is its own decision against the 2MB budget.
- `ClassificationBadge` starts with a hand written union, which must be swapped for the generated API type once the slate endpoint exists, or the two can drift.

**Neutral**:
- `layout.tsx` drops Inter and its inline footer.
- The scope's `design.md` requirement is satisfied by `frontend/design.md`. `/sync` should add a pointer to it in `frontend/AGENTS.md`.

## Follow-up

- [ ] Choose the ad network (AdSense, Ad Manager or a Nigerian network) in its own spec, with cookie consent (feature 22), an 18+ ad category policy, and turning `NEXT_PUBLIC_ADS_ENABLED` on.
- [x] Bring the remaining canvas boards (fixture drawer, slip audit, ledger, pricing) into the new fonts and both themes before their features are built. Done in the 2026-11-27 canvas.
- [ ] Update `ui-showcase.tsx` to the five slot member and guest sets from *App navigation* (it still shows the old four: Slate, Slip audit, Ledger, Account). Belongs to the open `/dev/ui` milestone.
- [ ] Click through the new canvas once in a browser before building pages; the designer could not render it, so layout glitches are unchecked.
- [ ] Canvas fix: SlateMobile shows the member bar to guests. Redraw the guest version with the *App navigation* guest set.
- [ ] Pause account (7, 30 or 90 days) on the responsible gambling board is deferred, not in v1 (scope Deferred). Mark it on the canvas as post launch.
- [ ] Hide the three notification switches on the Account boards in v1, or mark them post launch.
- [ ] Replace the hand written `Classification` union with the generated type from `api.gen.ts` when the slate endpoint lands (feature 5 or 6).
- [ ] Set `NEXT_PUBLIC_APP_ENV=preview` on Vercel Preview, and `local` in `frontend/.env.example`.
- [ ] Update the canvas to the AA fixes: Light avoid `#B02E24`, and the `control` outline token on inputs and checkboxes. Still open: the 2026-11-27 Tokens board lists colours such as `#9E241C` and `#F6D3CF` that are not the code's Light `avoid` (`#B02E24`) and `avoid-bg` (`#FBE3E0`), despite the "matched to code" note. Code wins; ask the designer to recheck the Light badge rows.
- [ ] Point the `unauthorized` and `forbidden` error links at the real sign in and pricing routes when those features land.
