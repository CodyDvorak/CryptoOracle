# Crypto Oracle - AI-Powered Trading Recommendation System

## 🎯 Application Overview

**Crypto Oracle** is an intelligent cryptocurrency trading recommendation engine that leverages 54 specialized trading bots to analyze market conditions and provide actionable trading insights. The system combines technical analysis, market regime detection, and multi-timeframe analysis to generate high-confidence trading recommendations.

### Core Use Case

The application serves crypto traders by:
- **Analyzing 100+ cryptocurrencies** in real-time using 54 different trading strategies
- **Providing directional recommendations** (long/short) with confidence scores (1-10)
- **Tracking bot performance** across different market conditions (bull, bear, sideways, high volatility)
- **Offering multi-timeframe analysis** (daily + 4-hour candles) for enhanced prediction accuracy
- **Monitoring futures/derivatives data** (open interest, funding rates, long/short ratios)

### Key Differentiators

1. **Multi-Bot Consensus**: 54 specialized bots vote on each coin, reducing single-strategy bias
2. **Market Regime Adaptation**: Bot predictions are weighted based on current market conditions
3. **Resilient Data Architecture**: Triple-layer API fallback ensures 99%+ data availability
4. **Performance Tracking**: Historical bot accuracy tracking enables continuous improvement
5. **Multi-Timeframe Confirmation**: Daily + 4h candle alignment increases prediction reliability

---

## 🏗️ Architecture

### Technology Stack

**Backend:**
- FastAPI (Python 3.11)
- MongoDB (Motor async driver)
- Pydantic for data validation
- AsyncIO for non-blocking operations

**Frontend:**
- React 18
- Axios for API communication
- React Router for navigation
- Lucide React for icons

**Data Providers:**
- **OHLCV Data**: CoinMarketCap → CoinGecko → CryptoCompare (fallback chain)
- **Futures Data**: OKX → Coinalyze → Bybit → Binance (fallback chain)

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
│  - Dashboard UI                                              │
│  - Bot Performance Analytics                                 │
│  - Recommendation Cards                                      │
│  - History & Details Views                                   │
└─────────────────────────────────────────────────────────────┘
                            ▼ HTTP/REST
┌─────────────────────────────────────────────────────────────┐
│                    Backend API (FastAPI)                     │
│  - Scan Orchestrator                                         │
│  - Bot Performance Service                                   │
│  - Aggregation Engine                                        │
│  - Market Regime Classifier                                  │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Data Layer (MongoDB)                       │
│  Collections:                                                │
│  - users, scan_runs, recommendations                         │
│  - bot_predictions, bot_results, bot_performance             │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              External Data Providers (Multi-Fallback)        │
│  OHLCV: CMC → CoinGecko → CryptoCompare                     │
│  Futures: OKX → Coinalyze → Bybit → Binance                 │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Implemented Features

### Complete Scan System Overview

The Crypto Oracle system offers **15 different scan types**, each optimized for specific use cases, time constraints, and market coverage needs. All scans follow a similar architecture but differ in:
- Number of coins analyzed
- Number of bots used
- Parallel processing (concurrent batches)
- AI/LLM integration
- Price filters
- Time to completion

---

## 📊 All Available Scan Types

### ⚡ Speed-Optimized Scans (4-10 minutes)

#### 1. Speed Run
**Duration**: 4-5 minutes  
**API**: `POST /api/scan/run` with `{"scan_type": "speed_run"}`  
**Configuration**:
- Coins: 75 top coins by market cap
- Bots: 25 best-performing bots only
- AI: None
- Parallel: No
- Use Case: Ultra-fast market snapshot

**Perfect For**: Quick decision-making, fast market checks, mobile trading

---

#### 2. Quick Scan
**Duration**: 7-10 minutes  
**API**: `POST /api/scan/run` with `{"scan_type": "quick_scan"}`  
**Configuration**:
- Coins: 100 top coins
- Bots: 48 bots (excludes AIAnalystBot)
- AI: None
- Parallel: Yes (3 concurrent batches)
- Use Case: Standard quick analysis

**Perfect For**: Pre-trading session check, hourly monitoring

---

#### 3. Fast Parallel
**Duration**: 8-10 minutes  
**API**: `POST /api/scan/run` with `{"scan_type": "fast_parallel"}`  
**Configuration**:
- Coins: 100 top coins
- Bots: 48 bots (excludes AIAnalystBot)
- AI: None
- Parallel: Yes (5 concurrent batches)
- Use Case: Faster version of quick scan

**Perfect For**: High-performance systems, time-sensitive analysis

---

#### 4. Heavy Speed Run
**Duration**: 8-10 minutes  
**API**: `POST /api/scan/run` with `{"scan_type": "heavy_speed_run"}`  
**Configuration**:
- Coins: 150 coins
- Bots: 25 best-performing bots
- AI: None
- Parallel: Yes (5 concurrent batches)
- Use Case: More coins, fewer bots, still fast

**Perfect For**: Broader market coverage with speed priority

---

### 🎯 Focused Scans (10-28 minutes)

#### 5. Focused Scan
**Duration**: 10-12 minutes  
**API**: `POST /api/scan/run` with `{"scan_type": "focused_scan"}`  
**Configuration**:
- Coins: 50 top coins
- Bots: 48 bots (excludes AIAnalystBot)
- AI: None
- Parallel: No
- Use Case: Deep analysis of market leaders

**Perfect For**: Blue-chip crypto analysis, top 50 focus

---

#### 6. Focused AI Scan
**Duration**: 25-28 minutes  
**API**: `POST /api/scan/run` with `{"scan_type": "focused_ai"}`  
**Configuration**:
- Coins: 20 top coins
- Bots: 49 bots (includes AIAnalystBot)
- AI: Full LLM analysis on ALL 20 coins
- Parallel: No
- Use Case: AI-powered deep dive on top performers

**Perfect For**: Major position research, comprehensive AI insights on top coins

---

### 📈 Medium Coverage Scans (15-20 minutes)

#### 7. Full Scan Lite
**Duration**: 15-18 minutes  
**API**: `POST /api/scan/run` with `{"scan_type": "full_scan_lite"}`  
**Configuration**:
- Coins: 200 coins
- Bots: 48 bots (excludes AIAnalystBot)
- AI: None
- Parallel: Yes (5 concurrent batches)
- Use Case: Comprehensive market scan without AI

**Perfect For**: Broader market exploration, mid-cap coin discovery

---

#### 8. All In Lite
**Duration**: 18-20 minutes  
**API**: `POST /api/scan/run` with `{"scan_type": "all_in_lite"}`  
**Configuration**:
- Coins: 250 coins
- Bots: 48 bots
- AI: None
- Parallel: Yes (8 concurrent batches)
- Use Case: Wide market coverage, optimized speed

**Perfect For**: Full market exploration, alt-coin hunting

---

#### 9. All In Under $5 Lite
**Duration**: 15-18 minutes  
**API**: `POST /api/scan/run` with `{"scan_type": "all_in_under_5_lite"}`  
**Configuration**:
- Coins: 250 coins filtered to price < $5
- Bots: 48 bots
- AI: None
- Parallel: Yes (8 concurrent batches)
- Use Case: Low-price coin screening

**Perfect For**: Finding moonshot candidates, small-cap gems under $5

---

#### 10. Complete Market Scan
**Duration**: 18-20 minutes  
**API**: `POST /api/scan/run` with `{"scan_type": "complete_market_scan"}`  
**Configuration**:
- Coins: 250 coins
- Bots: 48 bots
- AI: None
- Parallel: Yes (6 concurrent batches)
- Use Case: Comprehensive market snapshot

**Perfect For**: Daily comprehensive analysis, market overview

---

### 🌐 Large Coverage Scans (20-35 minutes)

#### 11. All In Under $5
**Duration**: 20-25 minutes  
**API**: `POST /api/scan/run` with `{"scan_type": "all_in_under_5"}`  
**Configuration**:
- Coins: 500 coins filtered to price < $5
- Bots: 48 bots
- AI: None
- Parallel: Yes (8 concurrent batches)
- Use Case: Extensive low-price screening

**Perfect For**: Aggressive alt-coin hunting, penny crypto research

---

#### 12. All In
**Duration**: 30-35 minutes  
**API**: `POST /api/scan/run` with `{"scan_type": "all_in"}`  
**Configuration**:
- Coins: 500 coins
- Bots: 48 bots
- AI: None
- Parallel: Yes (8 concurrent batches)
- Use Case: Maximum market coverage

**Perfect For**: Weekly comprehensive scans, full market analysis

---

### 🤖 AI-Enhanced Scans (35-50 minutes)

#### 13. All In Under $5 + AI
**Duration**: 35-40 minutes  
**API**: `POST /api/scan/run` with `{"scan_type": "all_in_under_5_ai"}`  
**Configuration**:
- Coins: 500 coins filtered to price < $5
- Bots: 48 bots (49 with AI on top 25)
- AI: Full LLM analysis on top 25 candidates
- Parallel: Yes (8 concurrent batches)
- Use Case: AI-powered low-price discovery

**Perfect For**: Finding AI-validated moonshots under $5

---

#### 14. Full Scan (Smart AI)
**Duration**: 40-45 minutes  
**API**: `POST /api/scan/run` with `{"scan_type": "full_scan"}`  
**Configuration**:
- Coins: 200 coins
- Bots: 48 bots (49 with AI on top 20)
- AI: Full LLM analysis on top 20 candidates
- Parallel: No
- Use Case: Comprehensive analysis with AI insights

**Perfect For**: Weekly deep research, AI-enhanced recommendations

---

#### 15. All In + AI
**Duration**: 45-50 minutes  
**API**: `POST /api/scan/run` with `{"scan_type": "all_in_ai"}`  
**Configuration**:
- Coins: 500 coins
- Bots: 48 bots (49 with AI on top 25)
- AI: Full LLM analysis on top 25 candidates
- Parallel: Yes (8 concurrent batches)
- Use Case: Maximum coverage + AI insights

**Perfect For**: Weekly comprehensive AI-powered market research

---

## 📊 Scan Type Comparison Table

| Scan Type | Duration | Coins | Bots | AI | Parallel | Use Case |
|-----------|----------|-------|------|----|---------|---------
|
| **Speed Run** | 4-5 min | 75 | 25 | ❌ | ❌ | Ultra-fast snapshot |
| **Quick Scan** | 7-10 min | 100 | 48 | ❌ | ✅ (3x) | Standard quick check |
| **Fast Parallel** | 8-10 min | 100 | 48 | ❌ | ✅ (5x) | Faster quick check |
| **Heavy Speed Run** | 8-10 min | 150 | 25 | ❌ | ✅ (5x) | More coins, fast |
| **Focused Scan** | 10-12 min | 50 | 48 | ❌ | ❌ | Top 50 deep dive |
| **Full Scan Lite** | 15-18 min | 200 | 48 | ❌ | ✅ (5x) | Broad coverage |
| **All In Under $5 Lite** | 15-18 min | 250 <$5 | 48 | ❌ | ✅ (8x) | Low-price gems |
| **Complete Market** | 18-20 min | 250 | 48 | ❌ | ✅ (6x) | Market overview |
| **All In Lite** | 18-20 min | 250 | 48 | ❌ | ✅ (8x) | Wide coverage |
| **All In Under $5** | 20-25 min | 500 <$5 | 48 | ❌ | ✅ (8x) | Max low-price scan |
| **Focused AI** | 25-28 min | 20 | 49 | ✅ All | ❌ | AI deep dive top 20 |
| **All In** | 30-35 min | 500 | 48 | ❌ | ✅ (8x) | Maximum coverage |
| **All In Under $5 + AI** | 35-40 min | 500 <$5 | 49 | ✅ Top 25 | ✅ (8x) | AI moonshot finder |
| **Full Scan (Smart AI)** | 40-45 min | 200 | 49 | ✅ Top 20 | ❌ | Comprehensive + AI |
| **All In + AI** | 45-50 min | 500 | 49 | ✅ Top 25 | ✅ (8x) | Max + AI insights |

---

## 🎯 Which Scan Should You Use?

### By Time Available

**< 10 minutes**:
- Speed Run (4-5 min) - Fastest
- Quick Scan (7-10 min) - Standard
- Fast Parallel (8-10 min) - Balanced

**10-20 minutes**:
- Focused Scan (10-12 min) - Top 50 deep
- Full Scan Lite (15-18 min) - 200 coins
- Complete Market (18-20 min) - 250 coins

**20-30 minutes**:
- All In Under $5 (20-25 min) - 500 low-price
- Focused AI (25-28 min) - AI on top 20

**30+ minutes**:
- All In (30-35 min) - 500 coins no AI
- Full Scan (40-45 min) - 200 with AI
- All In + AI (45-50 min) - Maximum everything

### By Use Case

**Intraday Trading**:
- Speed Run or Quick Scan (every 2-4 hours)

**Daily Routine**:
- Fast Parallel or Focused Scan (once per day)

**Weekly Research**:
- Full Scan or All In + AI (once per week)

**Moonshot Hunting**:
- All In Under $5 or All In Under $5 + AI

**Blue-Chip Focus**:
- Focused Scan or Focused AI

**Maximum Coverage**:
- All In or All In + AI

### By Bot Count Preference

**25 Bots (Speed Priority)**:
- Speed Run
- Heavy Speed Run

**48 Bots (Standard)**:
- All non-AI scans

**49 Bots (With AI)**:
- Focused AI
- Full Scan
- All In + AI variations

---

## 🔄 Common Scan Request Format

```bash
POST /api/scan/run
Content-Type: application/json

{
  "scan_type": "quick_scan",  // Choose from 15 types above
  "scope": "all",              // "all", "watchlist", "custom"
  "min_price": 0.01,           // Optional: minimum price filter
  "max_price": null,           // Optional: maximum price filter (auto $5 for under_5 scans)
  "custom_symbols": []         // Optional: specific coins to scan
}
```

**Response**:
```json
{
  "scan_run": {
    "id": "uuid",
    "scan_type": "quick_scan",
    "status": "completed",
    "duration_seconds": 450,
    "total_coins": 100,
    "coins_analyzed": 98
  },
  "recommendations": {
    "top_confidence": [...],
    "top_percent_movers": [...],
    "top_dollar_movers": [...]
  }
}
```

**What It Does**:
1. Fetches top 100 coins by market capitalization
2. Analyzes each coin with 53 bots (excludes AIAnalystBot)
3. Fetches daily OHLCV data (365 days)
4. Fetches 4-hour candles (168 periods = 7 days)
5. Fetches futures/derivatives data (open interest, funding rates)
6. Computes 50+ technical indicators for both timeframes
7. Classifies market regime per coin
8. Applies regime weights to bot predictions
9. Applies timeframe alignment modifiers
10. Aggregates results (no LLM sentiment)
11. Generates 16-20 top recommendations

**Bots Excluded**:
- AIAnalystBot (LLM-powered, too slow for quick scans)

**Data Sources**:
- OHLCV: CoinMarketCap → CoinGecko → CryptoCompare
- Futures: OKX → Coinalyze
- 4h Candles: CoinMarketCap → CoinGecko → CryptoCompare

**Output**:
- Top 8 recommendations by confidence
- Top 8 recommendations by predicted % gain
- Top 1 recommendation by predicted $ gain
- Scan metadata (time, coins analyzed, total bots)

**Recommendation Format** (Quick Scan):
```json
{
  "ticker": "BTC",
  "coin": "Bitcoin",
  "current_price": 50000.0,
  "consensus_direction": "long",
  "avg_confidence": 7.5,
  "bot_count": 52,
  "long_bots": 45,
  "short_bots": 7,
  "predicted_24h": 52000.0,
  "predicted_48h": 53000.0,
  "predicted_7d": 55000.0,
  "market_regime": "BULL",
  "rationale": "52 bots analyzed: LONG consensus (confidence: 7.5/10)"
}
```

**Performance Metrics**:
- Average duration: 45 seconds
- Coins analyzed: 100
- Bot predictions generated: ~4,900 (49 bots × 100 coins)
- API calls: ~400-500 total
- Memory usage: ~250MB

**When to Use**:
- ✅ Quick market check before trading session
- ✅ Routine monitoring every few hours
- ✅ When you need fast signals
- ❌ Not for deep research or major position sizing

---

### 🔬 Scan Type 2: Complete Scan

**Duration**: 3-5 minutes  
**API Endpoint**: `POST /api/scan/complete`  
**Use Case**: Deep analysis, major position planning, comprehensive research

**What It Does**:
1. Fetches top 100 coins by market capitalization
2. Analyzes each coin with ALL 54 bots (includes AIAnalystBot)
3. Fetches daily OHLCV data (365 days)
4. Fetches 4-hour candles (168 periods = 7 days)
5. Fetches futures/derivatives data (open interest, funding rates)
6. Computes 50+ technical indicators for both timeframes
7. Classifies market regime per coin
8. Applies regime weights to bot predictions
9. Applies timeframe alignment modifiers
10. Aggregates results for all coins
11. **Identifies top 20 candidates**
12. **Runs LLM sentiment analysis on top candidates**
13. **Synthesizes detailed rationale with AIAnalystBot**
14. Generates 16-20 top recommendations with enhanced insights

**All 54 Bots Included**:
- 53 technical analysis bots
- 1 AIAnalystBot (LLM-powered sentiment + news analysis)

**AIAnalystBot Capabilities**:
- Analyzes market sentiment from multiple sources
- Considers recent news and social media trends
- Evaluates fundamental factors
- Provides narrative-driven rationale
- Adds confidence modifier based on sentiment

**Data Sources**:
- OHLCV: CoinMarketCap → CoinGecko → CryptoCompare
- Futures: OKX → Coinalyze
- 4h Candles: CoinMarketCap → CoinGecko → CryptoCompare
- Sentiment: AIAnalystBot (LLM-powered)

**Output**:
- Top 8 recommendations by confidence (with AI insights)
- Top 8 recommendations by predicted % gain
- Top 1 recommendation by predicted $ gain
- Detailed rationale for each recommendation
- Scan metadata (time, coins analyzed, total bots)

**Recommendation Format** (Complete Scan):
```json
{
  "ticker": "BTC",
  "coin": "Bitcoin",
  "current_price": 50000.0,
  "consensus_direction": "long",
  "avg_confidence": 8.2,
  "bot_count": 54,
  "long_bots": 48,
  "short_bots": 6,
  "predicted_24h": 52000.0,
  "predicted_48h": 53500.0,
  "predicted_7d": 56000.0,
  "market_regime": "BULL",
  "regime_confidence": 0.87,
  "rationale": "Strong bullish consensus with 88.9% of bots recommending LONG. Technical indicators show strong upward momentum with RSI at 65, MACD bullish crossover, and price trading above all major moving averages. On-chain metrics indicate accumulation by large holders. Recent institutional adoption news and positive regulatory developments support the uptrend. 4-hour timeframe confirms daily trend with aligned bullish signals. Current market regime (BULL) favors trend-following strategies which show high agreement."
}
```

**Performance Metrics**:
- Average duration: 4 minutes
- Coins analyzed: 100
- Bot predictions generated: ~5,400 (54 bots × 100 coins)
- LLM calls: 20 (top candidates only)
- API calls: ~420-550 total
- Memory usage: ~300MB

**When to Use**:
- ✅ Planning major positions
- ✅ Comprehensive research before big trades
- ✅ Weekly or daily deep analysis
- ✅ When you need AI-powered insights
- ❌ Not for quick checks or time-sensitive situations

---

### 🎯 Scan Type 3: Smart Scan (Hybrid Approach)

**Duration**: 2-3 minutes  
**API Endpoint**: `POST /api/scan/smart`  
**Use Case**: Balanced speed + accuracy, best of both worlds

**What It Does**:

**PASS 1 - Quick Analysis (30-60 seconds)**:
1. Fetches top 100 coins by market capitalization
2. Analyzes each coin with 53 bots (excludes AIAnalystBot)
3. Fetches daily OHLCV + 4h candles + futures data
4. Computes technical indicators
5. Classifies market regime
6. Applies regime weights and timeframe modifiers
7. Aggregates results for all 100 coins
8. **Identifies top 20 candidates based on confidence**

**PASS 2 - Deep Analysis (1-2 minutes)**:
1. Takes top 20 candidates from Pass 1
2. Re-analyzes with ALL 54 bots (adds AIAnalystBot)
3. Runs LLM sentiment synthesis
4. Generates detailed rationale
5. Refines predictions with AI insights
6. Final aggregation with enhanced data

**Smart Selection Logic**:
```python
# Pass 1 results
all_100_coins_analyzed_by_53_bots()

# Rank by confidence
top_20_candidates = sorted(results, key='avg_confidence', reverse=True)[:20]

# Pass 2 - Deep dive on top 20
for coin in top_20_candidates:
    add_AIAnalystBot_prediction()
    run_LLM_sentiment_synthesis()
    enhance_rationale()
```

**Data Sources**:
- Pass 1: Same as Quick Scan (fast providers)
- Pass 2: Enhanced with AIAnalystBot + LLM synthesis

**Output**:
- Top 8 recommendations by confidence (AI-enhanced)
- Top 8 recommendations by predicted % gain
- Top 1 recommendation by predicted $ gain
- Mix of quick + deep analysis
- Best recommendations get full AI treatment

**Recommendation Format** (Smart Scan):
```json
{
  "ticker": "ETH",
  "coin": "Ethereum",
  "current_price": 3000.0,
  "consensus_direction": "long",
  "avg_confidence": 8.5,
  "bot_count": 54,
  "long_bots": 50,
  "short_bots": 4,
  "predicted_24h": 3100.0,
  "predicted_48h": 3180.0,
  "predicted_7d": 3350.0,
  "market_regime": "BULL",
  "regime_confidence": 0.91,
  "rationale": "Overwhelming bullish consensus (92.6% agreement) across all 54 bots. ETH showing strong momentum with bullish MACD crossover, RSI at 68 (strong but not overbought), and price action respecting ascending channel. Layer 2 scaling solutions driving increased network activity. Shanghai upgrade aftermath showing continued staking growth. AIAnalystBot notes positive sentiment around upcoming EIP implementations. Both daily and 4h timeframes aligned bullish. High regime confidence (0.91) in bull market conditions.",
  "pass_2_enhanced": true
}
```

**Performance Metrics**:
- Average duration: 2.5 minutes
- Coins in Pass 1: 100 (53 bots)
- Coins in Pass 2: 20 (54 bots with LLM)
- Total bot predictions: ~4,900 + 1,080 = ~6,000
- LLM calls: 20 (Pass 2 only)
- API calls: ~450-600 total
- Memory usage: ~280MB

**Advantages**:
- ✅ 50% faster than Complete Scan
- ✅ AI insights for top recommendations
- ✅ Efficient resource usage
- ✅ Best recommendations get full treatment
- ✅ Lower-confidence signals filtered early

**When to Use**:
- ✅ Daily trading routine
- ✅ When you want AI insights but limited time
- ✅ Balanced research approach
- ✅ Most common scan type for active traders

---

### 📊 Scan Type Comparison Table

| Feature | Quick Scan | Complete Scan | Smart Scan |
|---------|-----------|---------------|------------|
| **Duration** | 30-60s | 3-5min | 2-3min |
| **Coins Analyzed** | 100 | 100 | 100 + 20 deep |
| **Bots Used** | 53 | 54 | 53 + 54 for top 20 |
| **AIAnalystBot** | ❌ No | ✅ Yes (all) | ✅ Yes (top 20) |
| **LLM Synthesis** | ❌ No | ✅ Yes (all) | ✅ Yes (top 20) |
| **Predictions** | ~4,900 | ~5,400 | ~6,000 |
| **API Calls** | 400-500 | 420-550 | 450-600 |
| **Memory Usage** | 250MB | 300MB | 280MB |
| **Best For** | Quick checks | Deep research | Daily routine |
| **Rationale Quality** | Basic | Detailed | Mixed |
| **Recommendation Count** | 16-20 | 16-20 | 16-20 |

---

### 🔄 Common Scan Flow (All Types)

**Step 1: Initialization**
```
- Check if scan already running (prevent duplicates)
- Create scan_run document in database
- Initialize scan monitor
- Set scan type and parameters
```

**Step 2: Coin Selection**
```
- Fetch top 100 coins by market cap
- Apply price filters (if specified)
- Filter by user watchlist (if applicable)
- Validate coin symbols
```

**Step 3: Data Fetching (Per Coin)**
```
For each coin:
  ├─ Fetch daily OHLCV (365 days)
  │  └─ Try: CMC → CoinGecko → CryptoCompare
  ├─ Fetch 4h candles (168 periods)
  │  └─ Try: CMC → CoinGecko → CryptoCompare
  └─ Fetch futures data
     └─ Try: OKX → Coinalyze
```

**Step 4: Indicator Computation**
```
For each coin:
  ├─ Compute daily indicators (50+ metrics)
  │  └─ SMA, EMA, RSI, MACD, Bollinger, etc.
  ├─ Compute 4h indicators
  │  └─ Same indicators for 4h timeframe
  └─ Check timeframe alignment
     └─ Calculate confidence modifier
```

**Step 5: Market Regime Classification**
```
For each coin:
  ├─ Analyze 30-day momentum
  ├─ Calculate volatility metrics
  ├─ Check volume trends
  └─ Classify: BULL/BEAR/SIDEWAYS/HIGH_VOLATILITY
     └─ Return confidence (0-1.0)
```

**Step 6: Bot Analysis**
```
For each coin:
  For each active bot (53 or 54):
    ├─ Bot analyzes indicators
    ├─ Returns: direction, confidence, prices
    ├─ Apply regime weight modifier
    │  └─ Example: Trend bot in bull = 1.3x
    ├─ Apply timeframe modifier
    │  └─ Example: Aligned timeframes = 1.15x
    ├─ Clamp confidence to 1-10
    ├─ Convert to integer
    └─ Save prediction to database
```

**Step 7: Aggregation**
```
For each coin:
  ├─ Count long vs. short votes
  ├─ Calculate weighted average confidence
  ├─ Determine consensus direction
  ├─ Compute predicted prices (24h, 48h, 7d)
  ├─ Calculate bot agreement percentage
  └─ Generate basic rationale
```

**Step 8: AI Enhancement (Complete/Smart Scans)**
```
For top candidates:
  ├─ Run AIAnalystBot
  │  └─ Sentiment analysis + news review
  ├─ Synthesize LLM rationale
  │  └─ Combine technical + fundamental + sentiment
  └─ Enhance recommendation quality
```

**Step 9: Recommendation Ranking**
```
Sort recommendations by:
  ├─ Top by Confidence (avg_confidence desc)
  ├─ Top by % Move (predicted_gain_pct desc)
  └─ Top by $ Move (predicted_gain_usd desc)

Return top 8 in each category
```

**Step 10: Database Storage**
```
Save to MongoDB:
  ├─ scan_runs (metadata)
  ├─ recommendations (aggregated results)
  ├─ bot_predictions (individual predictions)
  └─ bot_results (raw bot outputs)
```

**Step 11: Notification & Response**
```
- Mark scan as complete
- Send notification to frontend
- Return recommendations via API
- Log scan statistics
```

---

### 🎛️ Scan Configuration Options

**Filter Scope**:
```python
{
  "filter_scope": "all",        # all, watchlist, custom
  "min_price": 0.01,            # Minimum price filter
  "max_price": 100000,          # Maximum price filter
  "min_market_cap": 1000000,    # Minimum market cap
  "max_market_cap": None        # Maximum market cap
}
```

**Bot Selection**:
```python
{
  "exclude_bots": ["AIAnalystBot"],  # List of bots to exclude
  "include_only": None,               # Whitelist (overrides exclude)
  "min_bot_confidence": 1             # Minimum confidence threshold
}
```

**Data Fetching**:
```python
{
  "historical_days": 365,       # Days of daily candles
  "candles_4h_periods": 168,    # Number of 4h candles
  "include_futures": True,      # Fetch futures data
  "include_4h": True            # Fetch 4h candles
}
```

**Performance Options**:
```python
{
  "parallel_processing": True,  # Process coins in batches
  "batch_size": 10,            # Coins per batch
  "timeout_per_coin": 60       # Seconds before timeout
}
```

---

### 📈 Scan Performance Optimization

**Parallelization**:
- Coins processed in batches of 10
- Async HTTP requests for all data fetching
- Non-blocking bot analysis
- `asyncio.sleep(0)` every 5 bots to yield event loop

**Caching**:
- Coin list cached for 5 minutes
- Technical indicators cached per coin
- Bot performance weights cached for 1 hour

**Rate Limit Management**:
- Automatic provider switching on 429 errors
- Exponential backoff for retries
- Provider health monitoring

**Resource Management**:
- Connection pooling for HTTP clients
- Database connection pooling (Motor)
- Memory cleanup after each scan
- Garbage collection triggered post-scan

---

### 🚨 Scan Error Handling

**Timeout Protection**:
```python
try:
    result = await asyncio.wait_for(
        scan_coin(symbol),
        timeout=60  # 60 seconds per coin
    )
except asyncio.TimeoutError:
    logger.warning(f"Timeout analyzing {symbol}")
    continue  # Skip coin, continue with others
```

**Provider Fallback**:
```python
for provider in [primary, backup, tertiary]:
    try:
        data = await provider.fetch(symbol)
        if data:
            return data
    except RateLimitError:
        continue  # Try next provider
    except Exception as e:
        logger.error(f"{provider} error: {e}")
        continue
return []  # All providers failed
```

**Partial Success Handling**:
```python
# Even if some coins fail, scan continues
successful_coins = []
failed_coins = []

for coin in coins:
    try:
        result = await analyze_coin(coin)
        successful_coins.append(result)
    except Exception as e:
        logger.error(f"Failed {coin}: {e}")
        failed_coins.append(coin)

# Return results from successful coins
# Log failed coins for investigation
```

---

### 📝 Scan Output Format

**API Response**:
```json
{
  "scan_run": {
    "id": "uuid",
    "user_id": "user_uuid",
    "scan_type": "smart_scan",
    "status": "completed",
    "started_at": "2025-10-03T22:00:00Z",
    "completed_at": "2025-10-03T22:02:30Z",
    "duration_seconds": 150,
    "total_coins": 100,
    "coins_analyzed": 98,
    "coins_failed": 2,
    "total_bots": 54,
    "total_predictions": 5890
  },
  "recommendations": {
    "top_confidence": [
      {
        "rank": 1,
        "ticker": "ETH",
        "coin": "Ethereum",
        "current_price": 3000.0,
        "consensus_direction": "long",
        "avg_confidence": 8.5,
        "bot_count": 54,
        "long_bots": 50,
        "short_bots": 4,
        "consensus_percent": 92.6,
        "predicted_24h": 3100.0,
        "predicted_48h": 3180.0,
        "predicted_7d": 3350.0,
        "predicted_gain_pct": 11.7,
        "predicted_gain_usd": 350.0,
        "market_regime": "BULL",
        "regime_confidence": 0.91,
        "rationale": "Detailed analysis...",
        "timestamp": "2025-10-03T22:02:30Z"
      }
      // ... 7 more
    ],
    "top_percent_movers": [ /* 8 coins */ ],
    "top_dollar_movers": [ /* 1 coin */ ]
  },
  "metadata": {
    "api_calls": {
      "coinmarketcap": 120,
      "coingecko": 85,
      "cryptocompare": 195,
      "okx": 98,
      "coinalyze": 2
    },
    "provider_health": {
      "coinmarketcap_success_rate": 0.82,
      "coingecko_success_rate": 0.65,
      "cryptocompare_success_rate": 0.98,
      "okx_success_rate": 0.71
    }
  }
}
```

---

### 🔔 Scan Monitoring & Status

**Real-Time Status Endpoint**:
```bash
GET /api/scan/is-running

Response:
{
  "is_running": true,
  "scan_type": "smart_scan",
  "progress": {
    "coins_processed": 45,
    "total_coins": 100,
    "percent_complete": 45.0,
    "estimated_time_remaining": 65
  },
  "current_coin": "SOL",
  "started_at": "2025-10-03T22:00:00Z"
}
```

**Scan Health Check**:
```bash
GET /api/scan/health

Response:
{
  "status": "healthy",
  "services": {
    "database": "connected",
    "data_providers": "available",
    "bots": "54/54 active"
  },
  "last_successful_scan": "2025-10-03T22:02:30Z",
  "avg_scan_duration": 155.5,
  "success_rate": 98.5
}
```

---

This comprehensive scan documentation covers all scan types, their workflows, configurations, and outputs in detail.
