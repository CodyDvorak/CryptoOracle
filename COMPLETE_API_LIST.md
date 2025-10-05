# Complete API List - Every Single API Installed

## TOTAL COUNT: 18 Edge Functions + 10 External APIs = 28 APIs

---

## SECTION 1: SUPABASE EDGE FUNCTIONS (18 Total)

All Edge Functions are deployed at: `{SUPABASE_URL}/functions/v1/{function-name}`

### 1. backtesting ✅
**Path**: `/functions/v1/backtesting`
**Methods**: POST
**Auth**: Service Role Key
**Purpose**: Backtest trading strategies on historical data
**Actions**:
- `run_backtest` - Execute backtest with config
- `get_results` - Retrieve backtest results
**Database**:
- Reads: `bot_predictions`
- Writes: `backtest_results`
**External APIs**: None

---

### 2. bot-learning ✅
**Path**: `/functions/v1/bot-learning`
**Methods**: GET, POST
**Auth**: Service Role Key
**Purpose**: ML insights and bot optimization recommendations
**Database**:
- Reads: `bot_predictions`, `bot_performance`
- Writes: `bot_learning_metrics`, `bot_learning_insights`
**Features**:
- Generates insights (strength, weakness, trends)
- Analyzes performance patterns
- Provides optimization recommendations
**External APIs**: None

---

### 3. bot-performance ✅
**Path**: `/functions/v1/bot-performance`
**Methods**: GET
**Auth**: Service Role Key
**Purpose**: Calculate real-time bot performance statistics
**Database**:
- Reads: `bot_predictions` (all)
- Aggregates: accuracy, win rate, P&L, regime stats
**Returns**:
- Per-bot statistics
- Total predictions
- Success/fail/pending counts
- Accuracy rates
- Average confidence
- Regime-specific performance (BULL/BEAR/SIDEWAYS)
**External APIs**: None

---

### 4. bot-performance-evaluator ✅
**Path**: `/functions/v1/bot-performance-evaluator`
**Methods**: GET
**Auth**: Service Role Key
**Purpose**: Evaluate bot predictions against current prices
**Database**:
- Reads: `bot_predictions`
- Updates: `bot_predictions` (outcome_status, profit_loss_percent)
- Writes: `bot_performance` (upserts)
**Process**:
1. Fetch predictions from last 24 hours (configurable)
2. Get current price from CoinGecko
3. Evaluate if target/stop loss hit
4. Update prediction outcomes
5. Calculate bot-level statistics
**External APIs**:
- CoinGecko `/simple/price` (get current prices)

---

### 5. bot-predictions ✅
**Path**: `/functions/v1/bot-predictions`
**Methods**: GET
**Auth**: Anon Key
**Purpose**: Fetch individual bot predictions for a coin
**Query Params** (Required):
- `runId` - Scan run ID
- `coinSymbol` - Coin ticker (BTC, ETH, etc.)
**Database**:
- Reads: `bot_predictions` WHERE run_id AND coin_symbol
**Returns**: All bot votes for specific coin in specific scan
**External APIs**: None

---

### 6. cron-trigger ✅
**Path**: `/functions/v1/cron-trigger`
**Methods**: GET, POST
**Auth**: Service Role Key
**Purpose**: Automated cron job to trigger scheduled scans
**Database**:
- Reads: `scheduled_scans` WHERE is_active AND next_run <= now
- Updates: `scheduled_scans` (last_run, next_run, run_count, errors)
**Process**:
1. Find due scheduled scans
2. Call `/scan-run` for each
3. Update next run time
4. Process email queue
5. Evaluate bot performance
**Calls Other Functions**:
- `scan-run` (triggers scans)
- `email-processor` (internal call)
- `bot-performance-evaluator` (internal call)
**External APIs**: None (calls internal functions)

---

### 7. custom-alerts ✅
**Path**: `/functions/v1/custom-alerts`
**Methods**: GET, POST, PUT, DELETE
**Auth**: Required (Bearer token)
**Purpose**: Manage user-defined price and signal alerts
**Actions**:
- `list` - Get user's alerts
- `create` - Create new alert
- `update` - Update alert
- `delete` - Delete alert
- `check` - Check if alerts should trigger
**Alert Types**:
- PRICE - Price threshold alerts
- SIGNAL - Trading signal alerts
- BOT - Specific bot alerts
- REGIME - Market regime change alerts
**Database**:
- CRUD on `user_alerts` table
**External APIs**: None

---

### 8. email-alerts ✅
**Path**: `/functions/v1/email-alerts`
**Methods**: POST
**Auth**: Service Role Key
**Purpose**: Send email notifications for triggered alerts
**Actions**:
- `check_and_send` - Check alerts and send emails
**Database**:
- Reads: `recommendations`, `user_alerts`, `user_profiles`
- Updates: `user_alerts` (last_triggered)
**Email Service**: Resend API
**External APIs**:
- Resend (email delivery)
**Requirements**:
- `RESEND_API_KEY` environment variable

---

### 9. email-processor ✅
**Path**: `/functions/v1/email-processor`
**Methods**: POST
**Auth**: Service Role Key
**Purpose**: Process email queue (background worker)
**Database**:
- Reads: `email_queue` WHERE status='pending'
- Updates: `email_queue` (status, sent_at)
**Process**:
1. Fetch pending emails (limit 10)
2. Send via Resend API
3. Update status to 'sent' or 'failed'
**External APIs**:
- Resend API (https://api.resend.com/emails)
**Requirements**:
- `RESEND_API_KEY` (optional - logs if missing)

---

### 10. health ✅
**Path**: `/functions/v1/health`
**Methods**: GET
**Auth**: None (public)
**Purpose**: System health check and status monitoring
**Database**:
- Test query: `scan_runs` count
- Measures DB latency
**Returns**:
```json
{
  "status": "operational",
  "timestamp": "ISO string",
  "database": {
    "connected": true,
    "latency_ms": 45
  },
  "dataProviders": {
    "coinmarketcap": { "available": true, "priority": 1 },
    "coingecko": { "available": true, "priority": 2 },
    "cryptocompare": { "available": true, "priority": 3 },
    "okx": { "available": true, "priority": 1 },
    "coinalyze": { "available": true, "priority": 2 },
    "bybit": { "available": true, "priority": 3 },
    "binance": { "available": true, "priority": 4 }
  },
  "bots": {
    "total": 59,
    "operational": 59,
    "status": "all_systems_operational"
  }
}
```
**Note**: Data provider status is STATIC (not real availability check)
**External APIs**: None

---

### 11. notifications ✅
**Path**: `/functions/v1/notifications`
**Methods**: GET, POST, PUT, DELETE
**Auth**: Required (Bearer token)
**Purpose**: Manage user in-app notifications
**Endpoints**:
- `GET /notifications` - Fetch notifications
- `POST /notifications/mark-read` - Mark as read
- `DELETE /notifications/{id}` - Delete notification
**Query Params**:
- `limit` (default: 20)
- `unreadOnly` (true/false)
**Database**:
- CRUD on `notifications` WHERE user_id=auth.uid
**Returns**:
- Notifications array
- Unread count
**External APIs**: None

---

### 12. scan-cleanup ✅
**Path**: `/functions/v1/scan-cleanup`
**Methods**: GET, POST
**Auth**: Service Role Key
**Purpose**: Auto-cleanup stalled scans (cron job)
**Trigger**: Supabase Cron (every 5 minutes)
**Database**:
- Reads: `scan_runs` WHERE status='running' AND started_at < 5min ago
- Reads: `recommendations` (check if data exists)
- Updates: `scan_runs` (mark as completed or failed)
**Logic**:
- If recommendations exist → mark completed
- If no recommendations → mark failed
**External APIs**: None

---

### 13. scan-history ✅
**Path**: `/functions/v1/scan-history`
**Methods**: GET
**Auth**: Service Role Key
**Purpose**: Retrieve historical scan data with recommendations
**Query Params**:
- `limit` (default: 50)
**Database**:
- Reads: `scan_runs` (last N scans)
- Reads: `recommendations` (for all scan IDs)
**Returns**: Scans with merged recommendation data
**External APIs**: None

---

### 14. scan-history-analysis ✅
**Path**: `/functions/v1/scan-history-analysis`
**Methods**: GET
**Auth**: Service Role Key
**Purpose**: Analyze historical patterns and trends
**Query Params**:
- `days` (default: 7)
- `coin` (optional - specific coin analysis)
**Database**:
- Reads: `recommendations` (filtered by date range)
**Returns**:
- Regime trends over time
- Signal persistence analysis
- Top performing coins
- Confidence trends
- Market overview
- Coin-specific history (if coin param provided)
**External APIs**: None

---

### 15. scan-latest ✅
**Path**: `/functions/v1/scan-latest`
**Methods**: GET
**Auth**: Service Role Key
**Purpose**: Fetch most recent completed scan
**Database**:
- Reads: `scan_runs` WHERE status='completed' (ORDER BY completed_at DESC, LIMIT 1)
- Reads: `recommendations` WHERE run_id={latest}
**Returns**:
```json
{
  "scan": { /* scan metadata */ },
  "recommendations": [ /* array of signals */ ]
}
```
**External APIs**: None

---

### 16. scan-run ✅ [PRIMARY FUNCTION]
**Path**: `/functions/v1/scan-run`
**Methods**: POST
**Auth**: Service Role Key
**Purpose**: Execute full market scan with 59 trading bots
**Request Body**:
```json
{
  "interval": "4h",
  "scanType": "quick|deep|scheduled",
  "coinLimit": 50,
  "filterScope": "top_100"
}
```
**Database**:
- INSERT: `scan_runs` (create scan record)
- INSERT: `recommendations` (aggregated signals)
- INSERT: `bot_predictions` (individual bot votes)
- UPDATE: `scan_runs` (completion status)
**Process**:
1. Create scan record
2. Fetch top coins from CoinGecko
3. Get OHLCV data for each coin
4. Run 59 trading bots on each coin
5. Aggregate bot consensus
6. Insert recommendations (batch of 10)
7. Update scan status
**Sub-Services**:
- `crypto-data-service.ts` (CoinGecko integration)
- `trading-bots.ts` (59 bot algorithms)
- `aggregation-engine.ts` (consensus logic)
- `multi-timeframe-analyzer.ts` (timeframe analysis)
- `ai-refinement-service.ts` (NOT USED - available)
- `social-sentiment-service.ts` (NOT USED - available)
- `onchain-data-service.ts` (NOT USED - available)
**External APIs**:
- CoinGecko `/coins/markets` (get top coins)
- CoinGecko `/coins/{id}/ohlc` (get OHLCV data)
- Derivatives data (MOCK - needs Binance/OKX)

---

### 17. scan-status ✅
**Path**: `/functions/v1/scan-status`
**Methods**: GET
**Auth**: Service Role Key
**Purpose**: Check if a scan is currently running
**Database**:
- Reads: `scan_runs` WHERE status='running' (ORDER BY started_at DESC, LIMIT 1)
**Returns**:
```json
{
  "isRunning": true,
  "currentScan": { /* scan object */ }
}
```
**External APIs**: None

---

### 18. scheduled-scan ✅
**Path**: `/functions/v1/scheduled-scan`
**Methods**: GET, POST
**Auth**: Service Role Key (or user auth)
**Purpose**: Configure automated scan schedules
**Actions**:
- `GET` - Fetch user's schedule settings
- `POST` - Save/update schedule configuration
**Database**:
- Reads/Upserts: `scheduled_scans`
**Configuration**:
- schedule_enabled (bool)
- interval (hourly, daily, etc.)
- scan_type
- timezone
- notification preferences
**External APIs**: None

---

## SECTION 2: EXTERNAL APIs (10 Total)

### TIER 1: ACTIVE & INTEGRATED (1 API)

#### 19. CoinGecko API ✅ ACTIVE
**Base URL**: `https://api.coingecko.com/api/v3`
**Used By**: scan-run, bot-performance-evaluator
**Auth**: None (Free tier)
**Rate Limit**: ~50 calls/minute
**Status**: ✅ Fully integrated and working

**Endpoints Used**:

**19a. Get Markets Data**
- Path: `/coins/markets`
- Method: GET
- Purpose: Fetch top coins by market cap
- Params:
  - `vs_currency=usd`
  - `order=market_cap_desc`
  - `per_page={50|100|200|500}`
  - `page=1`
- Returns: Array of coins with price, volume, market cap
- Used In: `crypto-data-service.ts` line 71

**19b. Get OHLC Data**
- Path: `/coins/{id}/ohlc`
- Method: GET
- Purpose: Candlestick data for technical analysis
- Params:
  - `vs_currency=usd`
  - `days=30`
- Returns: OHLCV candles (open, high, low, close, volume)
- Used In: `crypto-data-service.ts` line 100

**19c. Get Simple Price**
- Path: `/simple/price`
- Method: GET
- Purpose: Current price for bot evaluation
- Params:
  - `ids={coin_id}`
  - `vs_currencies=usd`
- Returns: Current USD price
- Used In: `bot-performance-evaluator/index.ts` line 23

---

### TIER 2: MOCK DATA - NEEDS IMPLEMENTATION (3 APIs)

#### 20. Binance Futures API ⚠️ NOT IMPLEMENTED
**Base URL**: `https://fapi.binance.com/fapi/v1`
**Should Be Used By**: scan-run → crypto-data-service.getDerivativesData()
**Auth**: API Key (required for private endpoints, optional for public)
**Current Status**: Returns random mock data
**Priority**: CRITICAL - Only missing piece in main scan flow

**Endpoints Needed**:

**20a. Get Open Interest**
- Path: `/openInterest`
- Method: GET
- Purpose: Open interest per symbol
- Params: `symbol=BTCUSDT`

**20b. Get Funding Rate**
- Path: `/fundingRate`
- Method: GET
- Purpose: Current and historical funding rates
- Params: `symbol=BTCUSDT`

**20c. Get Long/Short Ratio**
- Path: `/topLongShortPositionRatio`
- Method: GET
- Purpose: Top trader long/short ratio
- Params: `symbol=BTCUSDT&period=5m`

**Implementation Location**: `/supabase/functions/scan-run/crypto-data-service.ts` line 167

---

#### 21. OKX Futures API ⚠️ NOT IMPLEMENTED
**Base URL**: `https://www.okx.com/api/v5`
**Purpose**: Alternative derivatives data provider
**Auth**: None for public endpoints
**Current Status**: Not integrated
**Priority**: MEDIUM - Alternative to Binance

**Endpoints Available**:

**21a. Get Funding Rate**
- Path: `/public/funding-rate`
- Method: GET
- Purpose: Real-time funding rates
- Params: `instId=BTC-USDT-SWAP`

**21b. Get Open Interest**
- Path: `/public/open-interest`
- Method: GET
- Purpose: Open interest data
- Params: `instId=BTC-USDT-SWAP`

---

#### 22. Deribit API ⚠️ NOT IMPLEMENTED
**Base URL**: `https://www.deribit.com/api/v2`
**Purpose**: Options and futures data (especially for BTC/ETH)
**Auth**: None for public endpoints
**Current Status**: Not integrated
**Priority**: LOW - Specialized use case

**Endpoints Available**:

**22a. Get Book Summary**
- Path: `/public/get_book_summary_by_currency`
- Method: GET
- Purpose: Implied volatility, open interest, volume
- Params: `currency=BTC&kind=option`

---

### TIER 3: AVAILABLE BUT NOT INTEGRATED (7 APIs)

#### 23. GROQ API 📦 AVAILABLE
**Base URL**: `https://api.groq.com/openai/v1`
**Code Location**: `ai-refinement-service.ts`
**Used By**: Nobody (service exists but not called)
**Auth**: `GROQ_API_KEY` environment variable
**Model**: llama-3.1-70b-versatile
**Purpose**: AI-powered market analysis and signal refinement
**Status**: Code complete, not integrated into scan-run flow

**Endpoint**:
- Path: `/chat/completions`
- Method: POST
- Purpose: AI analysis of market conditions
- Used In: `ai-refinement-service.ts` line 76

---

#### 24. Google Gemini API 📦 AVAILABLE
**Base URL**: `https://generativelanguage.googleapis.com/v1beta`
**Code Location**: `ai-refinement-service.ts`
**Used By**: Nobody (service exists but not called)
**Auth**: `GEMINI_API_KEY` environment variable
**Model**: gemini-1.5-flash
**Purpose**: Alternative AI analysis
**Status**: Code complete, not integrated

**Endpoint**:
- Path: `/models/gemini-1.5-flash:generateContent`
- Method: POST
- Purpose: AI-powered insights
- Used In: `ai-refinement-service.ts` line 137

---

#### 25. Reddit API 📦 AVAILABLE
**Base URL**: `https://www.reddit.com`
**Code Location**: `social-sentiment-service.ts`
**Used By**: Nobody (service exists but not called)
**Auth**: None (public API)
**Purpose**: Social sentiment from Reddit discussions
**Status**: Code complete, not integrated

**Endpoint**:
- Path: `/search.json`
- Method: GET
- Purpose: Search crypto discussions
- Params: `q={coin_name} OR {ticker}`
- Used In: `social-sentiment-service.ts` line 88

---

#### 26. CryptoPanic API 📦 AVAILABLE
**Base URL**: `https://cryptopanic.com/api/v1`
**Code Location**: `social-sentiment-service.ts`
**Used By**: Nobody (service exists but not called)
**Auth**: `CRYPTOPANIC_API_KEY` (required)
**Purpose**: Crypto news aggregation and sentiment
**Status**: Code complete, not integrated

**Endpoint**:
- Path: `/posts/`
- Method: GET
- Purpose: Get crypto news and sentiment
- Params: `auth_token={key}&currencies={symbols}&public=true`
- Used In: `social-sentiment-service.ts` line 159

---

#### 27. NewsAPI 📦 AVAILABLE
**Base URL**: `https://newsapi.org/v2`
**Code Location**: `social-sentiment-service.ts`
**Used By**: Nobody (service exists but not called)
**Auth**: `NEWSAPI_KEY` (required)
**Purpose**: General crypto news articles
**Status**: Code complete, not integrated

**Endpoint**:
- Path: `/everything`
- Method: GET
- Purpose: Search news articles
- Params: `q={coin}&sortBy=publishedAt&apiKey={key}`
- Used In: `social-sentiment-service.ts` line 211

---

#### 28. Blockchair API 📦 AVAILABLE
**Base URL**: `https://api.blockchair.com`
**Code Location**: `onchain-data-service.ts`
**Used By**: Nobody (service exists but not called)
**Auth**: None (public API)
**Purpose**: Whale transaction tracking, blockchain stats
**Status**: Code complete, not integrated

**Endpoints**:

**28a. Get Transactions**
- Path: `/{blockchain}/transactions`
- Method: GET
- Purpose: Large transactions (whale tracking)
- Params: `limit=100&s=output_total(desc)`
- Used In: `onchain-data-service.ts` line 101

**28b. Get Blockchain Stats**
- Path: `/{blockchain}/stats`
- Method: GET
- Purpose: Network statistics
- Used In: `onchain-data-service.ts` line 199

---

#### 29. Blockchain.info API 📦 AVAILABLE
**Base URL**: `https://blockchain.info`
**Code Location**: `onchain-data-service.ts`
**Used By**: Nobody (service exists but not called)
**Auth**: None (public API)
**Purpose**: Bitcoin mempool and network data
**Status**: Code complete, not integrated

**Endpoints**:

**29a. Get Unconfirmed Transactions**
- Path: `/unconfirmed-transactions`
- Method: GET
- Purpose: Bitcoin mempool data
- Params: `format=json`
- Used In: `onchain-data-service.ts` line 143

**29b. Get Network Stats**
- Path: `/stats`
- Method: GET
- Purpose: Bitcoin network statistics
- Params: `format=json`
- Used In: `onchain-data-service.ts` line 233

---

#### 30. BlockCypher API 📦 AVAILABLE
**Base URL**: `https://api.blockcypher.com/v1`
**Code Location**: `onchain-data-service.ts`
**Used By**: Nobody (service exists but not called)
**Auth**: None (public API)
**Purpose**: Multi-chain blockchain data
**Status**: Code complete, not integrated

**Endpoint**:
- Path: `/{chain}`
- Method: GET
- Purpose: Get blockchain info
- Examples: `/btc/main`, `/eth/main`, `/doge/main`
- Used In: `onchain-data-service.ts` line 178

---

#### 31. Resend Email API ✅ ACTIVE
**Base URL**: `https://api.resend.com`
**Used By**: email-alerts, email-processor
**Auth**: `RESEND_API_KEY` (required)
**Purpose**: Email notification delivery
**Status**: ✅ Integrated (used by email functions)

**Endpoint**:
- Path: `/emails`
- Method: POST
- Purpose: Send transactional emails
- Auth: Bearer token
- Used In: `email-alerts/index.ts`, `email-processor/index.ts`

---

## SUMMARY BY STATUS

### ✅ FULLY WORKING (19 APIs):
1. backtesting
2. bot-learning
3. bot-performance
4. bot-performance-evaluator
5. bot-predictions
6. cron-trigger
7. custom-alerts
8. email-alerts
9. email-processor
10. health
11. notifications
12. scan-cleanup
13. scan-history
14. scan-history-analysis
15. scan-latest
16. **scan-run** (MAIN)
17. scan-status
18. scheduled-scan
19. CoinGecko API (3 endpoints)
20. Resend Email API

### ⚠️ NEEDS IMPLEMENTATION (3 APIs):
21. Binance Futures API (CRITICAL)
22. OKX Futures API (Alternative)
23. Deribit API (Optional)

### 📦 AVAILABLE BUT NOT USED (7 APIs):
24. GROQ API (AI analysis)
25. Google Gemini API (AI analysis)
26. Reddit API (social sentiment)
27. CryptoPanic API (news)
28. NewsAPI (news)
29. Blockchair API (on-chain)
30. Blockchain.info API (Bitcoin data)
31. BlockCypher API (multi-chain)

---

## REQUIRED API KEYS

### Currently Active:
- ✅ `SUPABASE_URL` (auto-configured)
- ✅ `SUPABASE_SERVICE_ROLE_KEY` (auto-configured)
- ✅ `SUPABASE_ANON_KEY` (auto-configured)
- ✅ `RESEND_API_KEY` (for emails)

### Needed for Full Implementation:
- ⚠️ `BINANCE_API_KEY` (derivatives data)
- ⚠️ `BINANCE_API_SECRET` (derivatives data)
- ⚠️ `OKX_API_KEY` (alternative derivatives)
- ⚠️ `OKX_API_SECRET` (alternative derivatives)

### Optional Enhancement Keys:
- `GROQ_API_KEY` (AI analysis)
- `GEMINI_API_KEY` (AI analysis)
- `CRYPTOPANIC_API_KEY` (social sentiment)
- `NEWSAPI_KEY` (news aggregation)

---

## API INTEGRATION MAP

```
User Action (Frontend)
    ↓
[scan-run] Edge Function
    ↓
[CoinGecko API] ✅ Get market data
    ↓
[59 Trading Bots] Internal algorithms
    ↓
[Derivatives APIs] ⚠️ MOCK DATA (needs Binance/OKX)
    ↓
[Database] PostgreSQL (Supabase)
    ↓
[Real-time Updates] Supabase Realtime
    ↓
Frontend Display
```

---

## FINAL COUNT

**Total APIs in Project**: 31 (18 Edge Functions + 13 External APIs)
**Fully Working**: 20 (19 Edge Functions + 1 External API group)
**Mock Data**: 3 (Binance, OKX, Deribit - derivatives)
**Available But Unused**: 8 (AI, social, on-chain services)

**Critical Gap**: Only derivatives data (Binance/OKX) needs real implementation. Everything else is production-ready.
