# Guardian Agent

## Overview

Guardian Agent is a manipulation blocker for the modern web — a Chrome extension companion web app that detects and visualizes dark patterns used by e-commerce sites to extract money from shoppers.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS (artifacts/guardian-agent)
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **AI**: Anthropic Claude (claude-haiku-4-5) via Replit AI Integrations
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Pages & Features

### Landing Page (`/`)
Full marketing page: hero, stats bar, interactive browser mock demo, "How It Works", dark patterns catalog, trust leaderboard, testimonials, dual CTA

### Live Scanner (`/demo`) — Hackathon Demo Key Page
- 4 preset scenarios (Booking.com, United Airlines, Amazon, Etsy clean) — one click runs real Claude AI analysis
- Custom input mode — paste any checkout text
- Real-time animated results: all 6 dark pattern categories with evidence
- Auto-saves to DB and updates domain trust rating after each scan

### Extension Preview (`/extension`)
- Interactive browser chrome mockup showing Guardian overlay UI
- 3 switchable demo states: Booking.com (5 patterns), Etsy (clean), United Airlines (upsell gauntlet)
- Shows every Guardian action: timer warnings, auto-unchecked add-ons, rewritten buttons

### Fee Calculator (`/fee-calculator`)
- 4 quick presets (booking.com, spirit.com, airbnb.com, enterprise.com)
- Custom domain + merchant type + listed price → Claude estimates true total
- Shows itemized fee breakdown, savings opportunity, confidence level

### Command Center (`/dashboard`)
- KPI cards with 30s auto-refresh
- Live detection feed with hidden fee amounts
- Pattern distribution pie chart
- Top offenders leaderboard
- Quick action shortcuts

### Intelligence Pages
- `/trust` — Domain trust ratings with filtering
- `/trust/:domain` — Per-domain detail with scan history
- `/reports` — Detection report feed
- `/reports/:id` — Full report detail with all 6 pattern breakdowns
- `/patterns` — Dark patterns encyclopedia
- `/stats` — Analytics with bar charts and offenders table

## API Endpoints

- `POST /api/analysis/detect` — Raw Claude dark pattern analysis
- `POST /api/analysis/classify-upsell` — Classify upsell pages
- `POST /api/demo/scan` — All-in-one: detect + save report + update trust rating
- `POST /api/demo/fee-estimate` — Claude estimates true price with fee breakdown
- `GET /api/trust` — List trust ratings
- `PATCH /api/trust/:domain` — Upsert trust rating
- `GET /api/trust/:domain` — Domain detail
- `GET /api/reports` — List detection reports
- `POST /api/reports` — Create report
- `GET /api/reports/:id` — Report detail
- `GET /api/stats/summary` — Total stats
- `GET /api/stats/pattern-breakdown` — Per-type counts
- `GET /api/stats/top-offenders` — Worst domains

## Features

### Dark Patterns Detected
1. **False Urgency** — Fake countdown timers and "deal expires soon" banners
2. **False Scarcity** — Fabricated "only 1 left" and "42 people viewing" claims
3. **Confirm Shaming** — Guilt-tripping decline button text
4. **Hidden Fees** — Resort fees, service fees, and surcharges hidden until checkout
5. **Pre-Checked Add-Ons** — Travel insurance, newsletters pre-selected by default
6. **Misdirection** — Visually hidden decline options and exit paths

### App Pages
- `/` — Marketing landing page
- `/dashboard` — Command center with live stats and recent detections
- `/trust` — Domain trust ratings table
- `/trust/:domain` — Domain-specific trust profile
- `/reports` — Detection reports feed with filtering
- `/reports/:id` — Individual report detail view
- `/patterns` — Dark patterns encyclopedia (educational)
- `/stats` — Analytics with charts and top offenders

### API Endpoints
- `POST /api/analysis/detect` — AI-powered dark pattern detection (Claude)
- `POST /api/analysis/classify-upsell` — Upsell page type classification (Claude)
- `GET/PUT /api/trust/:domain` — Domain trust ratings
- `GET/POST /api/reports` — Detection reports
- `GET /api/stats/summary` — Overall statistics
- `GET /api/stats/pattern-breakdown` — Pattern type counts
- `GET /api/stats/top-offenders` — Most manipulative domains

## DB Schema

- `trust_ratings` — Per-domain trust scores and manipulation history
- `detection_reports` — Individual dark pattern scan results

## Architecture Notes

- AI integration uses Replit AI Integrations proxy for Anthropic — no API key needed
- No PII sent to AI: only anonymized page text for classification
- Frontend imports hooks from `@workspace/api-client-react` (generated via Orval)
- Backend imports Zod validators from `@workspace/api-zod` (generated via Orval)
