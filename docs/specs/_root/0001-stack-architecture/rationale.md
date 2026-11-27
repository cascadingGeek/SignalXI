# 0001. Stack & architecture: rationale

## Context

SignalXI is a mobile first PWA for Nigerian football bettors. Its users are on mid range Android phones over 3G and 4G, so the initial load must stay under 2MB, and every network hop from Lagos counts. No major hosting platform has an Africa region, so latency is set by where the API, database, and cache sit relative to each other and to West Africa.

The product has two very different workloads. Live traffic only reads: slates and reports served from cache behind a server side paywall, with rate limits and device session caps checked on every request. Batch work is heavy and scheduled: a 06:00 WAT pipeline that pulls football data, runs pure statistical math, makes one LLM call per fixture, saves, and warms the cache, plus a pre kickoff refresh and a settlement job every two hours. The PRD forbids live traffic from ever triggering an LLM or football API call.

PRD §6 and backend spec 0001 already fix most technologies: Next.js, Tailwind, shadcn/ui, Zustand, TanStack Query, FastAPI with `uv`, SQLAlchemy async, Supabase, Redis, OpenRouter, LangGraph, and LangFuse. Still open were the runtime versions, where each piece is hosted, how the pieces connect, how the frontend learns the API's shape, how local development and environments work, and which of the PRD's "or" providers (football data, payments) to commit to.

The project is built by one engineer with AI help, with no hard deadline, at the GA workflow tier. Money (Paystack) and personal data (accounts) are involved, so the stack must be operable at 2am by one person.

## Options considered

### Option 1: Vercel PWA + Render FastAPI monolith, all backend pieces in Frankfurt

Next.js on Vercel; one FastAPI image deployed to Render Frankfurt as a web service and a background worker; Supabase in `eu-central-1`; Render Key Value as Redis on the private network. The browser calls the API subdomain directly. (basis: your PRD §6 and §7.1, backend spec 0001)

**Pros**:
- API, database, and cache are in one city, so backend round trips are a few milliseconds.
- Render has a native background worker type, which matches backend spec 0001's separate scheduler process.
- Predictable per instance pricing.
- One Docker image everywhere.

**Cons**:
- Two compute vendors (Vercel and Render).
- An always on worker costs money between jobs.
- Frankfurt is slightly farther from Lagos than London.

### Option 2: Everything on Railway, Amsterdam

The Next.js app, API, worker, and Redis all as Railway services in Amsterdam, with Supabase in a nearby EU region.

**Pros**:
- One vendor for all compute and Redis.
- Usage based pricing and cheaper egress can be cheaper at low traffic.

**Cons**:
- Next.js off Vercel loses zero config previews and the image and edge pipeline.
- Usage based pricing is harder to predict.
- No Supabase region in Amsterdam, so the database hop crosses cities.

### Option 3: Next.js full stack on Vercel, no FastAPI

Route handlers and server actions serve the API on Vercel; batch jobs run as Vercel Cron triggered functions; the statistical engine is ported to TypeScript.

**Pros**:
- One codebase, one vendor, one language.
- No CORS, no separate API deploy.

**Cons**:
- Discards backend spec 0001 and the Python ecosystem the engine relies on (numpy, scipy, LangGraph Python).
- Serverless time limits and no persistent connections fight a multi minute batch pipeline and pooled Postgres connections.
- Rate limiting and session checks on every request in serverless functions means cold starts on the hot path.

### Option 4: Fly.io for the backend, Frankfurt

The FastAPI image as two Fly process groups (API, worker) in `fra`, with Upstash or Fly hosted Redis.

**Pros**:
- The widest region footprint; a possible Johannesburg region later.
- Per second billing for machines.

**Cons**:
- More operational work for one engineer (machines, volumes, process groups, health checks).
- Redis is an add on rather than a first party service on the private network.

## Rationale

The deciding force is the split between a read only, latency sensitive request path and a heavy scheduled batch path, run by one engineer. A layered monolith deployed as two processes from one image handles both without distributed systems overhead, and Render gives each process a first class service type. That rules out Option 3, which would push a multi minute pipeline and per request Redis checks into serverless functions with time limits and cold starts. (basis: monolith first; serverless is a poor fit for long running, connection heavy work)

Colocation decides the region. Users reach the API, not the database, so the Lagos hop happens once per request whatever we choose; what we control is how many extra hops follow it. Putting the API, Supabase, and Redis in Frankfurt keeps every backend call inside one city. London would shave a few milliseconds off the browser's direct Supabase Auth calls, but it would add a cross city hop to every API query, which matters far more. Option 2 loses this, because Railway's EU region (Amsterdam) has no Supabase twin. (basis: colocate compute with its database)

Render over Fly is about operations, not capability. Fly can do everything here and may offer an African region later, but one engineer at GA rigor should not also run machines and process groups. Render's web and worker service types map one to one onto backend spec 0001. Render's own Redis over Upstash follows the same logic: rate limiting and session checks hit Redis on every request, so a private network hop at a flat price beats a per command bill over the public internet. (basis: boring, managed platforms for small teams)

Smaller calls follow from these. Supavisor session mode, because the transaction pooler breaks asyncpg prepared statements and the direct connection is IPv6 only. Generated OpenAPI types with `openapi-typescript`, because Pydantic already describes every response and the 2MB budget rewards zero runtime codegen. Python 3.13 over 3.14, because a missing wheel for numpy, scipy, or asyncpg would block the engine. Node 24 over 26, because 26 only became LTS a month ago. API-Football over Football-Data.org, because the engine and settlement need injuries, lineups, and half time scores. Paystack only, because one webhook format halves the riskiest test surface. (basis: your PRD §4.1, §8, §10.1)

## References

**Project sources**:
- `signalxi_PRD.md` §1, §4.1, §6, §7, §8, §10
- [Backend spec 0001: layering and dependency rules](../../backend/0001-backend-layering-dependency-rules/index.md)
- Root `AGENTS.md` (tooling, strict types, conventions)
- `docs/scope/scope.md` (Tracer Bullet, GA workflow)

**Practices & standards**:
- Monolith first; extract services only when a real bottleneck forces it
- Colocate compute with its database
- Serverless is a poor fit for long running or connection heavy work
- Boring, managed platforms for small teams

### Landscape check (2026-11-24)

- Next.js 16.4 is the latest stable release. Node 26 entered LTS on 28 Oct 2026; Node 24 and 22 are also LTS.
- Python 3.14 is the latest stable line. 3.13 was chosen for dependency safety (wheel support not confirmed by the check).
- shadcn/ui starts new projects on Tailwind v4 and React 19; the `default` style is deprecated in favor of `new-york`.
- Render regions: Oregon, Ohio, Virginia, Frankfurt, Singapore. Railway: California, Virginia, Amsterdam, Singapore. Neither has an Africa region.
- Supabase has no Africa region; the closest are London, Ireland, Paris, Frankfurt, Zurich, Stockholm.
- Upstash: free tier of 500K commands a month, then $0.20 per 100K commands.
- API-Football free plan: 100 requests a day, 30 a minute.

**Links** (web verified during the landscape check):
- Next.js 16.4 release: https://nextjs.org/blog/next-16-4
- Node.js release schedule: https://nodejs.org/en/about/previous-releases
- Python versions: https://devguide.python.org/versions/
- shadcn/ui and Tailwind v4: https://ui.shadcn.com/docs/tailwind-v4
- Render regions: https://render.com/docs/regions
- Railway regions: https://docs.railway.com/reference/regions
- Supabase regions: https://supabase.com/docs/guides/platform/regions
- Upstash Redis pricing: https://upstash.com/pricing/redis
- openapi-typescript: https://openapi-ts.dev/
