# Guardian Agent Production Roadmap

This document turns the product-direction guidance into an execution backlog mapped to the current codebase.

The intended production shape is:

- the browser extension is the primary product surface
- the website supports onboarding, trust history, demo flows, and operator visibility
- Guardian uses a shared staged detection pipeline instead of separate demo logic
- risky actions stay behind explicit user approval gates

## Product Focus

The first production use case should be travel checkout protection:

- hotels
- airlines
- vacation rentals

Why this focus:

- hidden fees are common and expensive
- urgency and scarcity patterns are frequent
- users understand the pain immediately
- the extension can deliver value without needing full autonomous purchase behavior

## P0: Trustworthy Core

These items should happen before broad rollout.

### P0.1 Shared Detection Pipeline

Goal:
- make `Quick scan`, `Mission`, and extension analysis use one production detection pipeline

Current files:
- [artifacts/api-server/src/routes/demo/index.ts](/d:/Projects/Guardian-Agent/Guardian-Agent/artifacts/api-server/src/routes/demo/index.ts)
- [artifacts/api-server/src/routes/agent/index.ts](/d:/Projects/Guardian-Agent/Guardian-Agent/artifacts/api-server/src/routes/agent/index.ts)
- [artifacts/api-server/src/routes/mock.ts](/d:/Projects/Guardian-Agent/Guardian-Agent/artifacts/api-server/src/routes/mock.ts)
- [artifacts/api-server/src/lib/agentic-mission.ts](/d:/Projects/Guardian-Agent/Guardian-Agent/artifacts/api-server/src/lib/agentic-mission.ts)
- [artifacts/api-server/src/lib/ai-copilot.ts](/d:/Projects/Guardian-Agent/Guardian-Agent/artifacts/api-server/src/lib/ai-copilot.ts)

Tasks:
- extract a shared `analyzeCheckoutContext()` service
- separate the pipeline into stages:
  - page classification
  - signal extraction
  - risk reasoning
  - recommendation
- make demo and mission endpoints thin wrappers around that shared service

Definition of done:
- one source of truth for manipulation detection
- one source of truth for confidence scoring
- one source of truth for non-commerce gating

### P0.2 Non-Commerce and Page-Type Detection

Goal:
- reduce false positives before any model or trust score is shown

Current files:
- [artifacts/api-server/src/lib/agentic-mission.ts](/d:/Projects/Guardian-Agent/Guardian-Agent/artifacts/api-server/src/lib/agentic-mission.ts)
- [artifacts/guardian-extension/content-script.js](/d:/Projects/Guardian-Agent/Guardian-Agent/artifacts/guardian-extension/content-script.js)

Tasks:
- add page types:
  - non-commerce
  - product
  - cart
  - checkout
  - post-purchase
- require stronger evidence before running full detection on unknown domains
- make extension auto-activation depend on page type, not just heuristics

Definition of done:
- GitHub, docs, blogs, and normal browsing do not trigger shopping analysis
- cart and checkout pages activate reliably

### P0.3 PII Redaction

Goal:
- never ship sensitive checkout data to the backend unintentionally

Current files:
- [artifacts/guardian-extension/content-script.js](/d:/Projects/Guardian-Agent/Guardian-Agent/artifacts/guardian-extension/content-script.js)
- [artifacts/api-server/src/app.ts](/d:/Projects/Guardian-Agent/Guardian-Agent/artifacts/api-server/src/app.ts)
- [artifacts/api-server/src/lib/logger.ts](/d:/Projects/Guardian-Agent/Guardian-Agent/artifacts/api-server/src/lib/logger.ts)

Tasks:
- strip or mask:
  - emails
  - phone numbers
  - addresses
  - payment details
  - loyalty numbers
  - traveler names
- add a browser-side sanitizer before payload submission
- add backend log redaction for request bodies

Definition of done:
- extension only sends checkout-relevant snippets
- backend logs are safe by default

### P0.4 Deterministic Rules Before Model Calls

Goal:
- use AI where judgment is needed, not where rules are enough

Current files:
- [artifacts/api-server/src/routes/demo/index.ts](/d:/Projects/Guardian-Agent/Guardian-Agent/artifacts/api-server/src/routes/demo/index.ts)
- [artifacts/api-server/src/lib/ai-copilot.ts](/d:/Projects/Guardian-Agent/Guardian-Agent/artifacts/api-server/src/lib/ai-copilot.ts)

Tasks:
- add deterministic detectors for:
  - pre-checked add-ons
  - countdown text
  - low-stock phrasing
  - hidden fee labels
  - decline button prominence issues
- only call the model for higher-level synthesis and ambiguous cases

Definition of done:
- obvious issues do not depend on LLM output
- model usage becomes cheaper and more stable

### P0.5 Confidence and Uncertainty

Goal:
- never fake certainty

Current files:
- [artifacts/api-server/src/lib/ai-copilot.ts](/d:/Projects/Guardian-Agent/Guardian-Agent/artifacts/api-server/src/lib/ai-copilot.ts)
- [artifacts/guardian-agent/src/components/ai-copilot-card.tsx](/d:/Projects/Guardian-Agent/Guardian-Agent/artifacts/guardian-agent/src/components/ai-copilot-card.tsx)
- [artifacts/guardian-extension/popup.js](/d:/Projects/Guardian-Agent/Guardian-Agent/artifacts/guardian-extension/popup.js)

Tasks:
- add field-level confidence to major findings
- add an explicit `uncertain` state when evidence is weak
- distinguish:
  - deterministic findings
  - AI-inferred findings
  - estimated totals

Definition of done:
- user can tell what Guardian knows vs. what it estimates

## P1: Make the Extension Real

These items make the extension feel production-ready.

### P1.1 SPA Handling and Dynamic Checkout Updates

Current files:
- [artifacts/guardian-extension/content-script.js](/d:/Projects/Guardian-Agent/Guardian-Agent/artifacts/guardian-extension/content-script.js)

Tasks:
- listen for SPA route changes
- reset stale overlay state when the page context changes
- add mutation observers for dynamic checkouts

Definition of done:
- Guardian reacts correctly on Amazon, airline flows, and React/Next/Vue sites

### P1.2 Stronger DOM Targeting

Current files:
- [artifacts/guardian-extension/content-script.js](/d:/Projects/Guardian-Agent/Guardian-Agent/artifacts/guardian-extension/content-script.js)

Tasks:
- build element scoring from:
  - role
  - label
  - position
  - visibility
  - clickability
  - checked state
- improve DOM highlighting with evidence labels
- prefer visible actionable controls over generic text nodes

Definition of done:
- highlights land on the actual suspicious controls, not just nearby text

### P1.3 Supervised Browser Workflow

Current files:
- [artifacts/guardian-extension/background.js](/d:/Projects/Guardian-Agent/Guardian-Agent/artifacts/guardian-extension/background.js)
- [artifacts/api-server/src/lib/agentic-mission.ts](/d:/Projects/Guardian-Agent/Guardian-Agent/artifacts/api-server/src/lib/agentic-mission.ts)

Tasks:
- model the browser workflow explicitly:
  - inspect
  - compare
  - strip upsells
  - ask for approval
- keep approval gates for:
  - account creation
  - credential submission
  - merchant switching
  - purchases

Definition of done:
- Guardian acts like a supervised assistant, not an unsafe autobuyer

## P1: Backend Hardening

### P1.4 Auth, Rate Limits, and Timeouts

Current files:
- [artifacts/api-server/src/app.ts](/d:/Projects/Guardian-Agent/Guardian-Agent/artifacts/api-server/src/app.ts)
- [artifacts/api-server/src/index.ts](/d:/Projects/Guardian-Agent/Guardian-Agent/artifacts/api-server/src/index.ts)

Tasks:
- add auth for non-local mode
- add per-IP or per-user rate limits
- add request timeouts
- add retries and circuit breakers for model dependencies

Definition of done:
- backend remains stable under failure and misuse

### P1.5 Observability

Current files:
- [artifacts/api-server/src/lib/logger.ts](/d:/Projects/Guardian-Agent/Guardian-Agent/artifacts/api-server/src/lib/logger.ts)
- [artifacts/api-server/src/app.ts](/d:/Projects/Guardian-Agent/Guardian-Agent/artifacts/api-server/src/app.ts)

Tasks:
- add request ids across frontend, extension, and backend
- log model latency and failure rates
- log false-positive feedback events
- log extension activation success

Definition of done:
- major failures can be debugged from logs and traces

## P2: Trust System and Data Layer

### P2.1 Domain Evidence History

Current files:
- [artifacts/api-server/src/routes/trust](/d:/Projects/Guardian-Agent/Guardian-Agent/artifacts/api-server/src/routes/trust)
- [artifacts/api-server/src/routes/reports](/d:/Projects/Guardian-Agent/Guardian-Agent/artifacts/api-server/src/routes/reports)
- [artifacts/guardian-agent/src/pages/trust](/d:/Projects/Guardian-Agent/Guardian-Agent/artifacts/guardian-agent/src/pages/trust)

Tasks:
- accumulate repeated evidence for each domain
- track:
  - pattern counts
  - fee estimates
  - user feedback
  - scan timestamps
- expose score explanations on trust pages

Definition of done:
- trust score becomes explainable and longitudinal

### P2.2 Score Versioning

Current files:
- [artifacts/api-server/src/lib/agentic-mission.ts](/d:/Projects/Guardian-Agent/Guardian-Agent/artifacts/api-server/src/lib/agentic-mission.ts)
- trust/report persistence layer once normalized

Tasks:
- assign a scoring version to every trust result
- explain why a domain score changed over time

Definition of done:
- users and operators can audit trust changes

## P2: Frontend and UX

### P2.3 Show Evidence, Why, and What To Do

Current files:
- [artifacts/guardian-agent/src/pages/demo.tsx](/d:/Projects/Guardian-Agent/Guardian-Agent/artifacts/guardian-agent/src/pages/demo.tsx)
- [artifacts/guardian-agent/src/pages/feecalc.tsx](/d:/Projects/Guardian-Agent/Guardian-Agent/artifacts/guardian-agent/src/pages/feecalc.tsx)
- [artifacts/guardian-agent/src/pages/agent.tsx](/d:/Projects/Guardian-Agent/Guardian-Agent/artifacts/guardian-agent/src/pages/agent.tsx)
- [artifacts/guardian-agent/src/components/ai-copilot-card.tsx](/d:/Projects/Guardian-Agent/Guardian-Agent/artifacts/guardian-agent/src/components/ai-copilot-card.tsx)

Tasks:
- label each output as:
  - deterministic
  - AI-inferred
  - estimated
- show user action guidance on every warning
- keep uncertainty visible

Definition of done:
- product feels honest, not overconfident

## P2: Testing

### P2.4 Extension and Backend Test Corpus

Current files:
- [tests](/d:/Projects/Guardian-Agent/Guardian-Agent/tests)
- new fixture directories should be added under `tests/fixtures`

Tasks:
- create a fixture corpus for:
  - hotel checkout
  - airline upsells
  - vacation rentals
  - non-commerce pages
- add regression cases for:
  - false positives
  - false negatives
  - non-commerce misclassification

Definition of done:
- the team can add a broken example and keep it fixed

### P2.5 Extension E2E

Suggested new folder:
- `artifacts/guardian-extension/tests`

Tasks:
- add end-to-end tests for:
  - popup -> content script -> backend flow
  - SPA route changes
  - non-commerce suppression
  - DOM highlighting

Definition of done:
- extension behavior can be validated automatically before release

## P2: Infra and Deployment

### P2.6 CI and Release Discipline

Current files:
- root workspace scripts in [package.json](/d:/Projects/Guardian-Agent/Guardian-Agent/package.json)

Tasks:
- add CI for:
  - lint
  - typecheck
  - backend tests
  - extension tests
  - Docker build
- version the extension and backend API intentionally together
- add environment separation:
  - local
  - staging
  - production

Definition of done:
- every release is reproducible and tested

## Compliance and Legal

This should be handled continuously, not as a late-stage task.

Requirements:

- present Guardian as user-side assistance, not bot abuse
- do not automate purchases without explicit approval
- do not silently create accounts or submit credentials
- publish clear privacy and retention rules

## Recommended Order of Execution

If only five items are started next, do these first:

1. P0.1 shared detection pipeline
2. P0.2 non-commerce and page-type detection
3. P0.3 PII redaction
4. P2.4 fixture corpus and regression tests
5. P1.4 backend hardening and observability
