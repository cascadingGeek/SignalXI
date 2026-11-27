# 0001. Design system and UI foundation: rationale

## Context

SignalXI is a mobile first PWA for Nigerian bettors, mostly on mid range Android phones over 3G or 4G, often late at night. The whole product is about filtering risk, so the four classification labels (Strong Candidate, Moderate Candidate, High Risk (Avoid), Insufficient Data) have to read instantly and unambiguously. They must never rely on colour alone, and must meet WCAG AA in every theme. The PRD and `AGENTS.md` set a hard 2MB initial load budget and rule out heavy chart libraries in v1.0.

The visual direction is already settled in the "SignalXI Web & Mobile" design canvas:
- A Midnight theme, set as the default, plus a Light theme.
- Bricolage Grotesque, Geist and Geist Mono.
- LiveScore style plain error messages with a reference code.
- Skeleton loading that copies the real layout.
- Labelled ad slots in fixed IAB sizes.

The frontend scaffold (Next.js 16, Tailwind v4, shadcn `radix-vega`) still ships shadcn's neutral greys and Inter, with no theme switch and no shared parts.

Each later feature (landing, sign in, slate, drawer, ledger, slip audit) needs these pieces. Without a shared foundation, each one would invent its own colours, skeletons and error copy, and the two themes would drift apart screen by screen. Ads raise their own forces:
- Revenue comes from guests and free members.
- Premium being ad free is part of the upgrade pitch.
- Any real ad script brings cookie consent and age appropriate ad rules, which belong to features that don't exist yet.

The project builds Tracer Bullet slices at the GA workflow tier. That means automated checks (unit, e2e, accessibility), not manual review, are how this foundation stays correct as later features land.

## Options considered

### Option 1: shadcn themed by canvas tokens, next-themes, next/font, reserved ad slots

Keep shadcn and Tailwind v4. Replace their CSS variable values with the canvas tokens (Light in `:root`, Midnight in `.dark`), and add the extra tokens (risk colours, skeleton, ad, verdict). next-themes sets the class before paint with Midnight as the fixed default. `next/font/google` self hosts the three fonts. Shared parts are shadcn primitives plus a few domain free composites, previewed on a dev only route checked by axe. `AdSlot` only reserves space behind a flag.

**Pros**:
- It builds on what the scaffold already installed. shadcn components and the `dark:` variant work unchanged.
- No theme flash, no layout shift, and no third party font request.
- The ad network decision is deferred without blocking page work.

**Cons**:
- It adds a runtime dependency (`next-themes`) and a mounted check in the toggle.
- shadcn's variable names (`popover`, `secondary`, `accent`) don't match the canvas names one to one, so the mapping table must be maintained.

### Option 2: hand written theme script and Zustand store

Same tokens and fonts, but the theme switch is a small inline script in `<head>` plus a Zustand store, with no next-themes.

**Pros**:
- One less dependency, and full control over the storage key and behaviour.

**Cons**:
- We own the edge cases that next-themes already solves: the script running before paint, cross tab sync, the hydration mismatch, and turning off transitions while switching.
- Zustand would hold a value that really lives in the DOM class, so there would be two sources of truth.

### Option 3: Storybook as the component catalogue

Build the parts in Storybook, with its accessibility addon, instead of a dev route.

**Pros**:
- An industry standard catalogue, with addons for accessibility, viewports and themes.

**Cons**:
- A second build pipeline, configuration and dependencies to keep green, for a small team.
- It previews parts outside the real Next.js runtime (fonts, providers, server components), so it can miss real bugs.

### Option 4: pick and wire an ad network now

Choose AdSense or Ad Manager in this spec and load real ads.

**Pros**:
- Revenue starts as soon as pages ship.

**Cons**:
- It pulls cookie consent (feature 22), an 18+ ad category policy and third party script performance into the foundation, before any page exists to carry an ad.
- Third party ad scripts are the largest single risk to the 2MB budget and to layout stability.

## Rationale

Option 1 fits the forces best:
- **It reuses the scaffold.** shadcn and Tailwind v4 are already installed. Themeing them through CSS variables means every primitive picks up both themes for free.
- **It adds no runtime cost.** The `dark` class strategy needs no JavaScript to render colours, and `next/font` removes both the Google round trip and the font swap shift. Both matter on 3G against the 2MB budget.
- **next-themes is the boring, proven answer** for the only tricky part: setting the class before paint, with a remembered choice. Writing that by hand (Option 2) saves one small dependency and costs us the edge cases.

Midnight is fixed as the default and the phone's setting is ignored. That was the engineer's explicit choice, and it matches the canvas: the brand reads as a night time, focused tool. The choice is stored only on the device, because guests are most of the traffic and have no profile row, and because adding a profile column for a cosmetic preference isn't worth an API call on every theme change.

A dev only route checked by axe (rather than Storybook, Option 3) previews parts in the real runtime, at no extra build cost. It also gives the GA tier an automated contrast and target size gate.

Ads are reserved rather than wired (rather than Option 4), so every later page can place its slots now with no layout shift. The network choice then becomes its own decision, together with consent and ad policy, where those forces actually live. Ads show only to guests and free members, as the engineer chose, keeping premium ad free as part of what people pay for.

### Update 2026-11-27: new canvas and app navigation

The designer rebuilt the canvas (37 boards) and asked two questions. The engineer's answers:
- **Guest bottom bar**: the member bar with Sign in in the last slot, over the designer's Home · Slate · Live · Audit · Sign in. One shape for everyone means signing in never moves a tab, and the public Ledger is the strongest conversion argument a guest can see, so hiding it from guests worked against the success metric. Runner up: the designer's guest bar.
- **Pause account**: deferred. It has no PRD basis and touches sign in, sessions and paid plan time (whether a paused plan keeps running), so it needs its own spec after launch. Runner up: build it under feature 22.
- **Notification switches**: hidden in v1, because push notifications are deferred and a switch that does nothing costs trust. Runner up: show them disabled.

### Update 2026-11-27: logo, signal bar badges, drawers, loader

Built from the v3 canvas, then recorded here at the engineer's request.
- **Signal bar badges over distinct icons.** The canvas makes the bar count the brand's one idea (the logo is three bars), so the badge repeats it: 3, 2, 1, none. Accessibility holds because the text label still carries the meaning and the bar count differs, not only the colour. Runner up: keep the lucide icons, which differ by shape.
- **Logo as a component, files as exports.** The mark's geometry is copied from the canvas, with token fills so it follows Light and Midnight. The raw SVG exports (logo variants, the nine Floodlight illustrations) live in `public/` for manifests, social cards and empty states. Runner up: load the exported SVG with `<img>`, which can't change colour with the theme.
- **Responsive sheet.** A bottom sheet suits thumbs on phones; on desktop a bottom sheet over a three column layout wastes width, so the same component becomes a right panel from 1024px. Prompts (install, alerts, limits) stay bottom sheets everywhere. Runner up: full pages for match detail, as drawn on the canvas, which lose the user's place in the slate.
- **CSS loader, no animation library.** The bounce is two keyframes, costs no bytes against the 2MB budget and honours reduced motion with one class. GSAP was suggested; it stays open as a later decision if a screen needs timeline or physics work CSS can't do.
