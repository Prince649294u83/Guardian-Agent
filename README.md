---
title: Guardian OpenEnv
emoji: 🛡️
colorFrom: blue
colorTo: green
sdk: docker
app_port: 8000
tags:
  - openenv
  - compliance
  - evaluation
short_description: OpenEnv benchmark for checkout dark-pattern defense.
---

# Guardian OpenEnv

Guardian OpenEnv turns the existing Guardian Agent domain into a real-world agent benchmark: an agent acts as a consumer-side "manipulation blocker" during checkout. It inspects sections of a shopping flow, strips unnecessary upsells, decides whether countdown timers are fake, calculates the true final price before the shopper clicks buy, and recommends whether the shopper should proceed.

This is not a toy task. It simulates work that real shoppers, trust-and-safety teams, and consumer-protection tools need to do: remove FOMO, stop unnecessary purchases, and surface the real price before sunk-cost pressure takes over.

## Environment Summary

- Domain: manipulation-blocking for e-commerce checkout flows
- Interface: typed Pydantic `Observation`, `Action`, `Reward`, `state()`, `reset()`, `step()`
- Tasks: 3 seeded investigations with easy, medium, and hard difficulty
- Rewarding: dense partial-progress shaping plus deterministic final grading
- Deployment target: Hugging Face Docker Space tagged `openenv`

## Action Space

The environment accepts a typed `GuardianAction` with one of these `action_type` values:

- `inspect_section`
- `remove_addon`
- `keep_addon`
- `flag_pattern`
- `unflag_pattern`
- `verify_timer`
- `set_true_total`
- `set_recommendation`
- `write_summary`
- `submit_decision`

Typed labels are also part of the contract:

- Patterns: `false_urgency`, `false_scarcity`, `confirm_shaming`, `hidden_fees`, `prechecked_addons`, `misdirection`
- Recommendations: `buy`, `buy_with_caution`, `avoid`

## Observation Space

`GuardianObservation` returns:

- task metadata and shopper objective
- shopper budget and listed price
- visible cart lines and optional add-ons
- urgency timers and pressure-copy signals
- indexed checkout sections
- full content for the most recently inspected section
- the current draft shopper decision
- remaining step budget
- the latest environment message
- action history
- done flag

`GuardianState` exposes the underlying trajectory state: task id, step count, opened section ids, current decision, completion state, and cumulative reward.

## Tasks

1. `value-hotel-budget-guard` (`easy`)
   Protect a hotel shopper from hidden fees, fake scarcity, fake urgency, and pre-selected extras before a one-night stay goes over budget.
2. `airline-seat-upsell-gauntlet` (`medium`)
   Navigate a seat-selection upsell funnel, remove unnecessary extras, and decide whether the trip still fits the shopper's budget.
3. `marketplace-ghost-checkout` (`hard`)
   Use ghost-checkout evidence to uncover late marketplace fees, fake stock pressure, and a stacked upsell flow before the shopper commits.

Each task includes a deterministic grader with a 0.0 to 1.0 score based on:

- pattern detection quality
- addon stripping quality
- fake-timer verification quality
- true-total accuracy
- final recommendation quality
- section coverage
- summary keyword coverage

## Reward Design

The reward function is meaningful over the full trajectory:

- positive signal for inspecting relevant checkout sections
- positive signal for stripping manipulative add-ons
- positive signal for correctly flagging patterns and fake timers
- positive signal for accurate total estimation and shopper recommendation
- negative signal for repeated, invalid, or low-value actions
- per-step cost to discourage loops
- extra penalty for submitting before core checkout sections are inspected
- deterministic final score from the grader in the 0.0 to 1.0 range

This gives agents partial progress signals instead of only terminal binary feedback.

## Project Layout

```text
guardian_openenv/
  models.py
  tasks.py
  graders.py
  environment.py
  client.py
  inference_runtime.py
  baseline.py
server/
  app.py
openenv.yaml
Dockerfile
inference.py
validate_submission.py
```

## Setup

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

Windows PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Run Locally

```bash
uvicorn server.app:app --host 0.0.0.0 --port 8000
```

Useful endpoints:

- `POST /reset`
- `POST /step`
- `GET /state`
- `GET /health`

Example reset:

```bash
# Reset to the easy hotel task
curl -X POST http://127.0.0.1:8000/reset -H "content-type: application/json" -d '{"task_id": "value-hotel-budget-guard"}'

# Reset to the medium airline task
curl -X POST http://127.0.0.1:8000/reset -H "content-type: application/json" -d '{"task_id": "airline-seat-upsell-gauntlet"}'

# Reset to the hard marketplace task
curl -X POST http://127.0.0.1:8000/reset -H "content-type: application/json" -d '{"task_id": "marketplace-ghost-checkout"}'
```

## Docker

Build and run:

```bash
docker build -t guardian-openenv .
docker run --rm -p 8000:8000 guardian-openenv
```

For the full Guardian website stack (frontend + backend together), use Docker Compose from the repo root:

```bash
docker compose up --build
```

This starts:

- frontend at `http://localhost:3000`
- backend API at `http://localhost:3001`

The backend defaults to local mock mode in the compose setup so the site boots without Anthropic or Postgres provisioning.

## Agentic Website Experience

The website is no longer just a passive scanner. It now includes a dedicated Mission Control flow at `/agent` that turns Guardian into a supervised shopping copilot.

The current website can:

- accept a target merchant, buying goal, budget, and shopper preferences
- estimate the true final total before the shopper commits
- score the merchant's trust and manipulation risk
- compare likely outcomes across alternative merchants
- recommend whether to proceed, proceed cautiously, or switch
- prepare guarded browser actions such as account creation or upsell stripping behind explicit approval gates

This keeps the original manipulation-blocker goal intact while moving the product toward a real agent workflow.

### Production Architecture Direction

The intended production shape is:

1. Chrome extension captures the current checkout context and visible DOM signals.
2. A supervised browser worker performs ghost checkout, price comparison, and trust verification.
3. Guardian returns a mission plan with alternatives, true-total estimates, and approval-gated actions.
4. The user approves any risky step such as creating an account, storing credentials, switching merchants, or buying.

This is intentionally supervised rather than fully autonomous. Guardian should help the user beat dark patterns, not become another opaque black box.

For the execution backlog that turns this into a production-grade product, see [docs/production-roadmap.md](/d:/Projects/Guardian-Agent/Guardian-Agent/docs/production-roadmap.md).

## Required Inference Entry Point

The submission-ready inference script is `inference.py` in the repo root.

It uses the OpenAI Python client for all LLM calls. Credentials are read in this priority order:

| Priority | Variables | Provider |
|----------|-----------|----------|
| 1 | `API_BASE_URL` + `API_KEY` + `MODEL_NAME` | HF router / any OpenAI-compat API |
| 2 | `OPENAI_API_KEY` (+ optional `OPENAI_MODEL`) | Direct OpenAI |
| 3 | `GROQ_API_KEY` (+ optional `GROQ_MODEL`) | Groq (Llama 3.3 70B by default) |
| 4 | *(none)* | Rule-based fallback — lower scores |

Example for HF submission:

```env
API_BASE_URL=https://router.huggingface.co/v1
MODEL_NAME=openai/gpt-oss-120b
API_KEY=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Example for local Groq testing:

```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GROQ_MODEL=llama-3.3-70b-versatile
```

Run it with:

```bash
python inference.py
```

The script writes scores to `outputs/inference_scores.json` and emits structured stdout logs using `[START]`, `[STEP]`, and `[END]`.

For local developer baselines, the repo also keeps [guardian_openenv/baseline.py](d:/Projects/Guardian-Agent/Guardian-Agent/guardian_openenv/baseline.py):

```bash
python -m guardian_openenv.baseline
```

## Baseline Scores

Scores are written to `outputs/inference_scores.json`. Two baseline agents are provided:

### Rule-based fallback (no API key)

The built-in heuristic agent inspects all sections then submits — no decisions made:

| Task | Difficulty | Score |
|------|------------|-------|
| `value-hotel-budget-guard` | Easy | ~0.08 |
| `airline-seat-upsell-gauntlet` | Medium | ~0.08 |
| `marketplace-ghost-checkout` | Hard | ~0.08 |
| **Mean** | | **~0.08** |

### Groq Llama 3.3 70B (measured)

| Task | Difficulty | Score | Steps |
|------|------------|-------|-------|
| `value-hotel-budget-guard` | Easy | **0.261** | 9 |
| `airline-seat-upsell-gauntlet` | Medium | **0.430** | 8 |
| `marketplace-ghost-checkout` | Hard | **0.244** | 9 |
| **Mean** | | **0.312** | |

Key grader sub-scores for the medium airline task (best performance):
- addon_score: 0.50 — removed 1 of 3 manipulative add-ons
- total_score: 0.999 — perfect true-total estimate ($276.98)
- evidence_score: 0.999 — all required sections inspected
- timer_score: 0.001 — missed the fake fare-lock timer (common LLM output format issue)

Scores improve significantly with GPT-4.1 or a prompted agent that includes `timer_is_fake: true` in verify_timer actions.

To regenerate:

```bash
python inference.py
```


## Hugging Face Spaces Deployment

This repo is ready for a Docker Space:

1. Create a new Hugging Face Space with SDK set to `Docker`.
2. Push this repository to the Space.
3. Confirm the Space exposes port `8000`.
4. Keep the `openenv` tag in the README metadata.

## Validation

The environment manifest is in [openenv.yaml](/d:/Projects/Guardian-Agent/Guardian-Agent/openenv.yaml).

If you have the OpenEnv CLI available, validate with:

```bash
openenv validate
```

Run the local submission checks with:

```bash
python validate_submission.py
```

This checks for:

- required submission files
- at least 3 tasks
- `reset()` / `state()` / `step()` working locally
- reward score range sanity

## Motivation

Guardian Agent already models a real product-safety problem: helping people avoid manipulative checkout experiences. This environment packages that into a benchmark where the agent has to actively protect the shopper, not just classify the page. It must reveal the true price, remove FOMO pressure, avoid unnecessary products, and help the shopper decide whether to buy.

## Chrome Extension

A real Chrome extension scaffold is included in [artifacts/guardian-extension](d:/Projects/Guardian-Agent/Guardian-Agent/artifacts/guardian-extension).

Load it in Chrome via `chrome://extensions` using `Load unpacked`, then select:

```text
artifacts/guardian-extension
```

The extension popup lets you configure the API base URL and analyze the current tab, while the content script renders a floating Guardian overlay directly on the page.
