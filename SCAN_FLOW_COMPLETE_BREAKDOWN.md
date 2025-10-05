# Complete Scan Flow Breakdown

This document explains exactly what happens when you click "Start Scan" in the Crypto Oracle application, from start to finish.

---

## 🎯 **Phase 1: User Initiates Scan (Frontend)**

### Location: `src/pages/Dashboard.jsx`

**When you click "Start Scan":**

1. **`startScan()` function executes** (line 235-268)
   - Clears any previous errors
   - Sets `isScanning = true` (shows loading UI)
   - Starts timer: `setScanStartTime(Date.now())`
   - Resets elapsed time counter

2. **Gathers scan configuration:**
   - Reads selected scan type (quick_scan, deep_analysis, etc.)
   - Gets coin limit (50, 100, 200, or 500)
   - Checks if AI should be enabled

3. **Makes HTTP POST request to Edge Function:**
   ```javascript
   POST /functions/v1/scan-run
   Headers: {
     Authorization: Bearer <SUPABASE_ANON_KEY>
     Content-Type: application/json
     apikey: <SUPABASE_ANON_KEY>
   }
   Body: {
     scanType: "quick_scan",
     filterScope: "all",
     interval: "4h",
     coinLimit: 100,
     useDeepAI: false
   }
   ```

---

## 🚀 **Phase 2: Scan Initialization (Backend - Edge Function)**

### Location: `supabase/functions/scan-run/index.ts`

**The scan-run Edge Function receives the request:**

1. **Creates database record** (lines 35-48)
   - Inserts into `scan_runs` table:
     ```sql
     INSERT INTO scan_runs (
       interval, filter_scope, min_price, max_price,
       scan_type, status, total_bots, total_coins
     ) VALUES (
       '4h', 'all', null, null,
       'quick_scan', 'running', 59, 100
     )
     ```
   - Gets back `scan_run.id` for tracking

2. **Initializes services:**
   - Creates `CryptoDataService` instance
   - Loads all 59 trading bots from `trading-bots.ts`

---

## 📊 **Phase 3: Fetch Market Data (Multiple APIs)**

### Location: `supabase/functions/scan-run/crypto-data-service.ts`

### **Step 3A: Get Top Coins List**

**Method: `getTopCoins()` (lines 62-87)**

Tries 3 providers in sequence (stops when one succeeds):

1. **CoinMarketCap API** (Primary)
   - **API:** `https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest`
   - **Headers:** `X-CMC_PRO_API_KEY: <COINMARKETCAP_API_KEY>`
   - **Params:** `limit=100&convert=USD`
   - **Returns:** Top 100 coins by market cap with:
     - Symbol (BTC, ETH, etc.)
     - Name (Bitcoin, Ethereum)
     - Price in USD
     - 24h volume
     - Market cap
   - **Purpose:** Get the universe of coins to analyze

2. **CoinGecko API** (Fallback #1)
   - **API:** `https://api.coingecko.com/api/v3/coins/markets`
   - **Headers:** `x-cg-pro-api-key: <COINGECKO_API_KEY>` (if available)
   - **Params:** `vs_currency=usd&order=market_cap_desc&per_page=100&page=1`
   - **Returns:** Same data structure as CMC

3. **CryptoCompare API** (Fallback #2)
   - **API:** `https://min-api.cryptocompare.com/data/top/mktcapfull`
   - **Headers:** `authorization: Apikey <CRYPTOCOMPARE_API_KEY>`
   - **Params:** `limit=100&tsym=USD`
   - **Returns:** Same data structure

**Result:** List of 100 coins to analyze

---

### **Step 3B: For EACH Coin - Fetch OHLCV Data**

**Method: `getOHLCVData(symbol)` (lines 211-234)**

For every coin (BTC, ETH, SOL, etc.), tries 3 providers:

1. **CoinMarketCap OHLCV** (Primary)
   - **API 1:** `https://pro-api.coinmarketcap.com/v1/cryptocurrency/map?symbol=BTC`
   - **Purpose:** Get CMC internal ID for the symbol
   - **API 2:** `https://pro-api.coinmarketcap.com/v2/cryptocurrency/ohlcv/historical`
   - **Params:** `id=1&time_start=<30 days ago>&time_end=<now>&interval=4h`
   - **Returns:**
     - 180 candles (30 days × 6 candles/day for 4h timeframe)
     - Each candle: timestamp, open, high, low, close, volume

2. **CoinGecko OHLCV** (Fallback #1)
   - **API:** `https://api.coingecko.com/api/v3/coins/bitcoin/ohlc`
   - **Params:** `vs_currency=usd&days=30`

3. **CryptoCompare OHLCV** (Fallback #2)
   - **API:** `https://min-api.cryptocompare.com/data/v2/histohour`
   - **Params:** `fsym=BTC&tsym=USD&limit=720`

**Result:** Raw price candles (180 data points)

---

### **Step 3C: Calculate Technical Indicators**

**Method: `processOHLCVData()` in crypto-data-service.ts**

From the 180 candles, calculates:

- **RSI** (Relative Strength Index)
- **MACD** (Moving Average Convergence Divergence)
- **Bollinger Bands** (upper, middle, lower)
- **EMAs** (20, 50, 200 periods)
- **SMAs** (20 period)
- **ATR** (Average True Range - volatility)
- **ADX** (Average Directional Index - trend strength)
- **Stochastic Oscillator** (%K, %D)
- **CCI** (Commodity Channel Index)
- **Williams %R**
- **VWAP** (Volume Weighted Average Price)
- **OBV** (On-Balance Volume trend)
- **Ichimoku Cloud** (tenkan, kijun, span A, span B)
- **Parabolic SAR**
- **Market Regime Classification** (BULL, BEAR, SIDEWAYS, VOLATILE)
- **Regime Confidence Score** (0.0 - 1.0)

**Result:** Complete technical analysis package for the coin

---

### **Step 3D: Fetch Derivatives Data** (Optional)

**Location:** `supabase/functions/scan-run/derivatives-data-service.ts`

Tries 4 providers:

1. **OKX Exchange API** (Primary)
   - **API Calls (3 parallel requests):**
     - `https://www.okx.com/api/v5/public/funding-rate?instId=BTC-USDT-SWAP`
     - `https://www.okx.com/api/v5/public/open-interest?instId=BTC-USDT-SWAP`
     - `https://www.okx.com/api/v5/rubik/stat/contracts/long-short-account-ratio?instId=BTC-USDT-SWAP&period=5m`
   - **Returns:**
     - Funding rate (hourly fee for perpetual contracts)
     - Open Interest (total value of open positions)
     - Long/Short ratio (sentiment indicator)

2. **Coinalyze** (Fallback #1)
3. **Bybit** (Fallback #2)
4. **Binance** (Fallback #3)

**Purpose:** Futures market sentiment and institutional positioning

---

### **Step 3E: Fetch Options Data** (Optional)

**Location:** `supabase/functions/scan-run/options-data-service.ts`

Tries 3 providers:

1. **Deribit API** (Primary - only supports BTC/ETH)
   - **API:** `https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=BTC&kind=option`
   - **Returns:**
     - Put/Call ratio
     - Implied volatility
     - Options volume
   - **Purpose:** Options market positioning (bullish/bearish sentiment)

2. **Bybit Options** (Fallback #1)
3. **OKX Options** (Fallback #2)

---

### **Step 3F: Fetch TokenMetrics AI Data** (Optional)

**Location:** `supabase/functions/scan-run/tokenmetrics-service.ts`

1. **TokenMetrics API** (If API key available)
   - **API:** `https://api.tokenmetrics.com/v2/tokens?symbol=BTC`
   - **Returns:**
     - AI-generated rating (0-100)
     - Recommendation (STRONG_BUY, BUY, HOLD, SELL, STRONG_SELL)
     - Trader score (0-100)
     - Investor grade
   - **Purpose:** AI-powered fundamental + technical analysis

**Result:** AI recommendation that can boost/reduce bot confidence

---

## 🤖 **Phase 4: Bot Analysis (59 Bots Per Coin)**

### Location: `supabase/functions/scan-run/trading-bots.ts`

**For each coin, all 59 bots analyze the data:**

### **Bot Categories:**

1. **Momentum Bots** (8 bots)
   - RSI Oversold/Overbought
   - RSI Divergence
   - MACD Crossover
   - MACD Histogram
   - Stochastic Oscillator
   - CCI Commodity Channel
   - Williams %R
   - ADX Trend Strength

2. **Trend Following Bots** (6 bots)
   - EMA Golden Cross
   - EMA Death Cross
   - Trend Following
   - Ichimoku Cloud
   - Parabolic SAR
   - Multi-Timeframe Confluence

3. **Mean Reversion Bots** (4 bots)
   - Bollinger Squeeze
   - Bollinger Breakout
   - Mean Reversion
   - Support/Resistance

4. **Volume Bots** (4 bots)
   - Volume Spike
   - Volume Breakout
   - OBV On-Balance Volume
   - Volume Profile Analysis

5. **Pattern Recognition Bots** (8 bots)
   - Fibonacci Retracement
   - Elliott Wave Pattern
   - Harmonic Patterns
   - Chart Patterns
   - Candlestick Patterns
   - Price Action
   - Breakout Hunter
   - Pivot Points

6. **Market Structure Bots** (7 bots)
   - Wyckoff Method
   - Market Profile
   - Smart Money Concepts
   - Liquidity Zones
   - Fair Value Gaps
   - Market Structure
   - Supply/Demand Zones

7. **Derivatives Bots** (4 bots)
   - Funding Rate Arbitrage
   - Open Interest Momentum
   - Long/Short Ratio Tracker
   - Options Flow Detector

8. **Sentiment & Flow Bots** (6 bots)
   - Order Flow Analysis
   - Whale Activity Tracker
   - Social Sentiment Analysis
   - Exchange Flow
   - Market Sentiment
   - Fear & Greed Index

9. **On-Chain Bots** (4 bots)
   - Network Activity
   - Hash Rate Analysis
   - Miner Behavior
   - Accumulation/Distribution

10. **Multi-Asset Bots** (4 bots)
    - Correlation Analysis
    - Intermarket Analysis
    - Seasonality Patterns
    - CMF Money Flow

11. **Technical Oscillators** (4 bots)
    - VWAP Trader
    - ATR Volatility
    - 4H Trend Analyzer
    - Market Regime Detector

**Each bot:**
1. Analyzes the OHLCV data + derivatives + options
2. Applies its strategy logic
3. Returns a prediction IF conditions are met:
   ```javascript
   {
     botName: "RSI Oversold",
     direction: "LONG" or "SHORT",
     confidence: 0.75, // 0.0 to 1.0
     entry: 45000,
     takeProfit: 48000,
     stopLoss: 43500,
     leverage: 3
   }
   ```
4. Returns `null` if no signal

**Result:** 0-59 predictions per coin (typically 10-30 bots vote)

---

## 🎲 **Phase 5: Consensus Generation**

### Location: `supabase/functions/scan-run/index.ts` (lines 104-213)

**For each coin that has ≥3 bot votes:**

1. **Count votes:**
   - `longVotes = 15`
   - `shortVotes = 8`
   - Total voting: 23 bots

2. **Determine consensus:**
   - Consensus direction: `LONG` (more long votes)

3. **Calculate average confidence:**
   - Sum all bot confidence scores / number of voting bots
   - `avgConfidence = 0.68`

4. **Calculate average targets:**
   - Average entry price
   - Average take profit
   - Average stop loss

5. **Apply TokenMetrics AI boost/penalty:**
   - If TokenMetrics says `STRONG_BUY` and bots say `LONG`:
     - Boost confidence: `0.68 × 1.15 = 0.78`
     - AI Reasoning: "TokenMetrics STRONG_BUY confirms bot consensus"
   - If TokenMetrics conflicts:
     - Reduce confidence: `0.68 × 0.85 = 0.58`
     - AI Reasoning: "TokenMetrics conflicts with bot consensus"

6. **Predict future prices:**
   - 24h prediction: current price × 1.02 (for LONG)
   - 48h prediction: current price × 1.04
   - 7d prediction: current price × 1.08

7. **Calculate percentage changes:**
   - `predicted_change_24h = ((predicted24h - current_price) / current_price) × 100`

**Result:** One consensus recommendation per coin

---

## 💾 **Phase 6: Database Storage**

### Location: `supabase/functions/scan-run/index.ts`

**Every 10 coins processed, batch insert:**

### **6A: Insert into `recommendations` table:**
```sql
INSERT INTO recommendations (
  run_id, coin, ticker, current_price,
  consensus_direction, avg_confidence,
  avg_entry, avg_take_profit, avg_stop_loss,
  avg_predicted_24h, avg_predicted_48h, avg_predicted_7d,
  predicted_change_24h, predicted_change_48h, predicted_change_7d,
  bot_count, bot_votes_long, bot_votes_short,
  market_regime, regime_confidence, ai_reasoning
) VALUES (
  'a1b2c3', 'Bitcoin', 'BTC', 45000,
  'LONG', 0.78,
  45000, 48000, 43500,
  45900, 46800, 48600,
  2.0, 4.0, 8.0,
  23, 15, 8,
  'BULL', 0.82, 'TokenMetrics STRONG_BUY confirms bot consensus'
)
```

### **6B: Insert into `bot_predictions` table:**
```sql
INSERT INTO bot_predictions (
  run_id, bot_name, coin_symbol, coin_name,
  entry_price, target_price, stop_loss,
  position_direction, confidence_score,
  leverage, market_regime
) VALUES
('a1b2c3', 'RSI Oversold', 'BTC', 'Bitcoin', 45000, 48000, 43500, 'LONG', 0.75, 3, 'BULL'),
('a1b2c3', 'MACD Crossover', 'BTC', 'Bitcoin', 45100, 48200, 43600, 'LONG', 0.82, 3, 'BULL'),
... (one row per bot that voted)
```

**Purpose:**
- `recommendations`: User-facing consensus signals
- `bot_predictions`: Individual bot votes for performance tracking

---

## ✅ **Phase 7: Scan Completion**

### Location: `supabase/functions/scan-run/index.ts` (lines 254-263)

**After all coins processed:**

1. **Update scan_runs table:**
   ```sql
   UPDATE scan_runs
   SET
     status = 'completed',
     completed_at = NOW(),
     total_available_coins = 100,
     total_coins = 100,
     total_bots = 59
   WHERE id = 'a1b2c3'
   ```

2. **Return response to frontend:**
   ```json
   {
     "success": true,
     "runId": "a1b2c3",
     "message": "Scan completed successfully",
     "totalSignals": 47,
     "coinsAnalyzed": 100
   }
   ```

---

## 🔄 **Phase 8: Frontend Detects Completion**

### Location: `src/pages/Dashboard.jsx`

**Three mechanisms detect completion:**

### **8A: Realtime Subscription** (Primary)
```javascript
supabase.channel('scan-runs-changes')
  .on('postgres_changes', { event: 'UPDATE', table: 'scan_runs' })
  .subscribe((payload) => {
    if (payload.new.status === 'completed') {
      setIsScanning(false)
      setTimeout(() => fetchLatestRecommendations(), 1000)
    }
  })
```
- **Trigger:** Database UPDATE event on `scan_runs`
- **Latency:** <1 second

### **8B: Polling** (Fallback)
```javascript
setInterval(() => {
  checkScanStatus() // Calls /scan-status endpoint
}, 5000)
```
- **Trigger:** Status API returns `isRunning: false`
- **Latency:** 0-5 seconds

### **8C: Recommendations Realtime** (Progressive Loading)
```javascript
supabase.channel('recommendations-changes')
  .on('postgres_changes', { event: 'INSERT', table: 'recommendations' })
  .subscribe((payload) => {
    setRecommendations(prev => [payload.new, ...prev])
  })
```
- **Trigger:** Each recommendation INSERT
- **Result:** UI updates in real-time as signals are found

---

## 📥 **Phase 9: Fetch Final Results**

### **Method: `fetchLatestRecommendations()`**

1. **Calls Edge Function:**
   ```
   GET /functions/v1/scan-latest
   ```

2. **Edge Function queries database:**
   ```sql
   SELECT * FROM scan_runs
   WHERE status = 'completed'
   ORDER BY completed_at DESC
   LIMIT 1
   ```

3. **Then fetches recommendations:**
   ```sql
   SELECT * FROM recommendations
   WHERE run_id = 'a1b2c3'
   ORDER BY avg_confidence DESC
   ```

4. **Returns to frontend:**
   ```json
   {
     "scan": { id: "a1b2c3", completed_at: "...", ... },
     "recommendations": [
       { coin: "Bitcoin", ticker: "BTC", consensus_direction: "LONG", ... },
       { coin: "Ethereum", ticker: "ETH", consensus_direction: "SHORT", ... },
       ...
     ]
   }
   ```

5. **Frontend displays results:**
   - Updates recommendation cards
   - Stops loading spinner
   - Resets timer

---

## 📊 **Summary: External APIs Used**

### **Market Data APIs:**
1. **CoinMarketCap** - Coin listings + OHLCV (Primary)
2. **CoinGecko** - Coin listings + OHLCV (Fallback)
3. **CryptoCompare** - Coin listings + OHLCV (Fallback)

### **Derivatives APIs:**
4. **OKX** - Funding rates, Open Interest, Long/Short ratios (Primary)
5. **Coinalyze** - Derivatives data (Fallback)
6. **Bybit** - Derivatives data (Fallback)
7. **Binance** - Derivatives data (Fallback)

### **Options APIs:**
8. **Deribit** - Options data (BTC/ETH only)
9. **Bybit Options** - Options data (Fallback)
10. **OKX Options** - Options data (Fallback)

### **AI/Fundamental APIs:**
11. **TokenMetrics** - AI ratings and recommendations

### **Total API Calls Per Coin:**
- 1 call for OHLCV (with 2 fallbacks)
- 1-3 calls for derivatives (parallel)
- 1 call for options (optional)
- 1 call for TokenMetrics (optional)

**Average: ~4-5 API calls per coin**

For 100 coins: **~400-500 total API calls**

---

## ⏱️ **Performance Breakdown**

**Quick Scan (100 coins):**
- Initial coin list: ~2 seconds
- Per coin processing: ~4.5 seconds
  - OHLCV fetch: 1 second
  - Derivatives fetch: 1 second
  - Options fetch: 0.5 seconds
  - TokenMetrics: 0.5 seconds
  - Bot analysis: 1 second
  - DB insert: 0.5 seconds
- **Total: 7-8 minutes**

**Why so slow?**
- Sequential processing (1 coin at a time)
- API rate limits
- Network latency
- Retry logic on failures

---

## 🗄️ **Database Tables Updated**

1. **`scan_runs`** - Scan metadata and status
2. **`recommendations`** - Consensus signals for users
3. **`bot_predictions`** - Individual bot votes for tracking
4. **`notifications`** - (Optional) If alerts triggered

---

## 🔍 **Error Handling**

**If APIs fail:**
- Tries fallback providers (up to 3 attempts)
- Skips coin if all providers fail
- Continues with next coin
- Logs warnings but doesn't fail entire scan

**If scan crashes:**
- Updates `scan_runs.status = 'failed'`
- Records error message
- Frontend shows error state

---

## 🎬 **End Result**

**You see:**
- List of 30-50 high-confidence trading signals
- Direction (LONG/SHORT)
- Entry/Target/Stop prices
- Confidence score
- Bot consensus (15 LONG, 8 SHORT)
- Market regime (BULL/BEAR/SIDEWAYS/VOLATILE)
- AI reasoning (if applicable)
- Price predictions (24h, 48h, 7d)

**All data is stored in database for:**
- Historical analysis
- Bot performance tracking
- Learning/optimization
- Alert triggers
