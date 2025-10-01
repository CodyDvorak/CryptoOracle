# CryptoTrendHunter — Development Plan

## Phase 1: Full MVP Implementation (Status: In Progress)
- Backend services for data ingestion (Coinalyze), 20-bot analysis engine, aggregation, scheduler, email + Sheets integrations
- Frontend dashboard with Top 5 recommendations, bot status grid, scheduler, filters, and integrations panel

## Phase 2: Testing & Polish (Status: Not Started)
- Unit tests for indicators and aggregation logic, API contract tests, Playwright UI flows, performance tuning

## Phase 3: Enhancements (Status: Not Started)
- Custom bot builder, per-coin deep-dive pages, export/reporting, user auth, role-based access, multi-email recipients

---

# 1) Executive Summary
CryptoTrendHunter is an AI-powered crypto analysis platform that orchestrates 20 diverse strategy bots over two years of historical data (via Coinalyze) to produce trade recommendations (long/short) with Take Profit (TP), Stop Loss (SL), and confidence scores (1–10). The system aggregates all bot outputs and surfaces the Top 5 coins by average confidence, with an option to run scans on a schedule (6h/12h/24h) starting at a user-chosen time. Results can be emailed and appended to a Google Sheet log. Users can filter scans for all coins or alt coins only.

Core stack: FastAPI + MongoDB + React (Shadcn UI). Data analysis combines deterministic indicators (pandas) and an LLM synthesis step using Claude 4.5 through the Emergent LLM key (no manual key entry required).

---

# 2) Objectives
- Implement reliable ingestion of 2-year OHLCV data for all tracked coins using Coinalyze API
- Implement 20 independent bot strategies that output direction (long/short), TP, SL, and confidence
- Aggregate bots’ confidence per coin and compute Top 5 coins with average TP/SL
- Provide scheduler with 6h/12h/24h intervals and user-selected start time
- Email the Top 5 results to a user-provided email (via SMTP) and append all recommendations to a Google Sheet
- Frontend dashboard adhering to premium fintech design and accessibility—fast, clear, testable

---

# 3) UI/UX Design Guidelines
Per design_guidelines.md (already created). Key mandates we will apply across the app:
- Color system (dark fintech):
  - Backgrounds: base #0B0F14, elevated #0E1218, panel #121722
  - Text: primary #E7EEF5, muted #C7D0D9; Accents: primary teal #16D3B0, aqua #22B8F0; Semantics: success #37D399, warning #FFD166, danger #FF6B6B
  - Per guidelines: no purple; gradients restricted to <20% viewport, used only for large sections
- Typography:
  - Headings: Space Grotesk; Body: Inter; Numeric: Roboto Mono
  - Implement semantic scale and generous spacing; avoid global center alignment
- Components & Patterns:
  - Use Shadcn components from /src/components/ui exclusively
  - Every interactive/info element includes data-testid for test stability
  - Sonner toasts for feedback (theme using teal/aqua accents, not default red/green)
  - Motion limited to transform/opacity; no transition: all
- Layout:
  - Sticky TopNav with Filter (All vs Alt), Scheduler (6h/12h/24h), Run Scan
  - Top 5 Recommendation cards with confidence gauge, TP/SL, direction chip
  - Bot Status Grid (20 tiles) with running/idle/error states
  - Integrations section (Email + Google Sheets)
  - Historical & Strategy section (candlestick chart + indicators breakdown)

Design tokens will be injected into index.css; fonts loaded via public/index.html. Primary CTAs use var(--primary) for fill; focus-visible ring uses var(--ring). Per guidelines: gradients only in allowed regions.

---

# 4) Implementation Steps

## 4.1 Backend (FastAPI)
1) Data ingestion & Coinalyze client
- Create a lightweight Coinalyze client: fetch available coins, fetch OHLCV (2 years, suitable interval, e.g., 4h or 6h for performance), handle pagination and rate limits (retry/backoff)
- Alt-coin filter: all coins minus BTC, ETH, stables (e.g., USDT, USDC, DAI, TUSD, BUSD, etc.) — configurable list in DB

2) Indicator engine (pandas)
- Implement core TA primitives with pandas (no external TA lib): SMA/EMA, RSI, MACD, Bollinger Bands, Stoch, ATR, OBV/Volume metrics, VWAP approximation
- Feature computation returns a standardized DataFrame with the most recent window and indicator values for each coin

3) 20 Bot strategies
- Each bot is a pure function/class operating on the standardized features for a coin and outputs: {direction: long|short, entry/TP/SL, confidence(1–10), rationale}
- Diversity coverage examples:
  - Trend-following: SMA cross, EMA ribbon, MACD momentum, Supertrend-approx (ATR-based), ADX trend strength
  - Mean-reversion: Bollinger band reversion, RSI oversold/overbought with divergence checks
  - Volatility: ATR squeeze/expansion, BB width regimes
  - Volume/Flow: OBV breakouts, volume spikes, VWAP deviations
  - Pattern heuristics: range breakout, higher-highs/higher-lows, support/resistance proximity, simple fib retracement contexts
  - Regime filters: trending vs ranging gates for different bots

4) LLM synthesis (Claude 4.5 via Emergent LLM key)
- Use emergentintegrations library to prompt Claude with consolidated indicator snapshots per coin
- Outputs refined rationale and confidence calibration per coin (bound to 1–10). We do NOT expose keys; load from environment

5) Aggregation & ranking
- For each coin: average confidence across 20 bots; compute consensus direction (majority) and average TP/SL (median to reduce outliers)
- Sort by average confidence, return Top 5

6) Persistence (MongoDB)
- Models (UUID identifiers, timezone-aware datetimes):
  - ScanRun {id, started_at, interval, filter_scope, status, stats}
  - BotResult {id, run_id, coin, bot_name, direction, entry, tp, sl, confidence, rationale}
  - Recommendation {id, run_id, coin, consensus_direction, avg_confidence, avg_tp, avg_sl}
  - IntegrationsConfig {id, email_enabled, email_to, smtp_host, smtp_port, smtp_user, smtp_pass_masked, sheets_enabled, sheet_url, sheet_id, worksheet}
  - Settings {id, alt_exclusions[], schedule {interval, start_at}}
- Indexes on run_id, coin, created_at

7) Scheduler / jobs
- Use APScheduler (Async) within FastAPI process for 6h/12h/24h jobs, aligned to a user-set start time; store schedule in DB
- Job function triggers a full scan (all/alt based on config). Ensure long-running work runs in background tasks and streams logs to stdout

8) Email notifications (SMTP)
- Implement email sending with Python’s smtplib (TLS) or a small helper lib if available in requirements
- Behavior: if email_enabled and email_to set (and SMTP creds present), send Top 5 summary after each scan. Otherwise, skip gracefully

9) Google Sheets logging
- Parse pasted Sheet URL to extract sheetId and optional gid; append a row for every coin recommendation with metadata (run_id, coin, tp, sl, confidence, bot_name)
- Requires Google credentials (service account or OAuth). If not configured, fallback to saving a CSV per run and include its link in the email. We will call the integration playbook before implementation and request credentials if needed

10) API design (all prefixed with /api)
- GET /api/health
- POST /api/scan/run  {scope: "all"|"alt"}
- GET /api/scan/runs   (list recent runs)
- GET /api/recommendations/top5?run_id=...
- GET /api/bots/status
- GET/PUT /api/config/schedule
- GET/PUT /api/config/integrations  (email/sheets)
- GET /api/coins (list; respects filter)

## 4.2 Frontend (React + Shadcn UI)
- Apply tokens in index.css; load Space Grotesk/Inter/Roboto Mono; remove global center alignment
- TopNav: filter (All/Alt), scheduler (6h/12h/24h), Run Scan button
- BotStatusGrid: 20 tiles showing status and last latency
- Top5Recommendations: cards show symbol, direction chip, confidence gauge (1–10), TP/SL, brief rationale, copy buttons
- IntegrationsPanel: email toggle + input; Google Sheet toggle + paste URL; save via /api/config/integrations
- Historical & Strategy: lightweight-charts candle view for a selected coin + indicator tabs
- Testing IDs: data-testid for all interactive/info elements; Sonner toasts for feedback

## 4.3 Testing & Verification
- Backend: unit tests for indicators; API tests for /scan/run and /recommendations/top5; property tests for aggregation
- Frontend: compile check (esbuild bundling), Playwright flows (set schedule, run scan, view Top 5, save integrations)
- Logs: Supervisor logs for runtime errors; ensure graceful degradation when integrations are unconfigured

---

# 5) Technical Details
- Environment & infra
  - Backend binds 0.0.0.0:8001; use MONGO_URL env; never modify .env values in repo
  - Use UUIDs for IDs; datetime in timezone.utc
  - Routes must start with /api

- Coinalyze API
  - Use provided API key via env var; implement client to fetch symbols list and OHLCV (2 years). Cache responses where possible
  - Define error handling + retry/backoff for rate limits

- LLM Integration
  - Libraries: emergentintegrations.llm.chat (Claude model: claude-sonnet-4-20250514) via Emergent LLM key loaded from environment
  - LLM usage scope: rationale + confidence calibration + risk note — deterministic signals remain source of truth

- Email via SMTP
  - Config stored in DB; redact password in responses/logs. Validate connectivity on save. If missing creds, feature disabled with clear UI state

- Google Sheets
  - Expect a paste-in sheet link; extract sheetId. Use service account credentials (to be provided) to append rows; otherwise CSV fallback

- Data schema (illustrative)
  - BotResult: {id, run_id, coin, bot_name, direction, entry, tp, sl, confidence, rationale, created_at}
  - Recommendation: {id, run_id, coin, consensus_direction, avg_confidence, avg_tp, avg_sl, created_at}

- Aggregation math
  - avg_confidence = mean(confidences);
  - consensus_direction = majority(long vs short); ties resolved by higher avg_confidence among agreeing bots
  - avg_tp/sl = median of TP/SL among bots matching consensus direction; if none, use overall median

- Performance & safety
  - Batch coins; parallelize by symbol groups; limit concurrent requests to respect rate limits
  - Guardrails: if insufficient recent data, bot abstains; confidence scaled down
  - Input validation light for MVP; robust validation later

---

# 6) Next Actions
- Confirm Coinalyze endpoints for 2-year OHLCV and any rate limits; define preferred base interval (e.g., 4h)
- Choose SMTP host (e.g., Gmail SMTP with app password) or alternative; provide credentials when ready
- For Google Sheets: provide a service account JSON or approve a fallback CSV-only mode for the MVP
- Approve bot strategy list (we will implement a named set of 20 as listed)
- Approve API contract above

---

# 7) Success Criteria
- User can run an ad-hoc scan and view Top 5 with confidence, TP, SL within the dashboard
- Scheduler triggers scans at 6h/12h/24h cadence starting at chosen time, storing results
- Email sent post-scan when SMTP configured; otherwise clear UI notice of disabled state
- Google Sheets appends recommendations when credentials provided; otherwise CSV fallback works and link is sent via email
- Frontend meets design tokens, accessible focus rings, data-testid coverage, and compiles without errors
- Backend handles timezones, UUIDs, error cases gracefully; APIs respond within acceptable latency
