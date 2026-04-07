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
