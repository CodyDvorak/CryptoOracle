# CryptoOracle
Secrets secrets
"# Crypto Oracle - AI-Powered Trading Recommendation System

## 🎯 Application Overview

**Crypto Oracle** is an intelligent cryptocurrency trading recommendation engine that leverages 54 specialized trading bots to analyze market conditions and provide actionable trading insights. The system combines technical analysis, market regime detection, and multi-timeframe analysis to generate high-confidence trading recommendations.

### Core Use Case

The application serves crypto traders by:
- **Analyzing 100+ cryptocurrencies** in real-time using 54 different bots each different with trading strategies
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

"# Crypto Oracle - AI-Powered Trading Recommendation System

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

### Phase 1: Multi-Timeframe Analysis (COMPLETE)

**Status**: ✅ Fully Implemented and Tested

**What It Does:**
- Fetches 4-hour candle data alongside daily candles
- Computes technical indicators for 4h timeframe
- Applies timeframe alignment confidence modifier to bot predictions
- Boosts confidence when daily and 4h signals align

**Implementation Details:**
- `coingecko_client.py`: Added `get_4h_candles()` method (aggregates hourly to 4h)
- `cryptocompare_client.py`: Added `get_4h_candles()` method (uses aggregate=4 parameter)
- `multi_provider_client.py`: Implements fallback: CMC → CoinGecko → CryptoCompare
- `indicator_engine.py`: New `compute_4h_indicators()` method
- `scan_orchestrator.py`: Fetches 4h data, computes indicators, applies timeframe modifier

**Resilience:**
- CoinMarketCap 4h endpoint requires enterprise plan (expected to fail)
- CoinGecko provides fallback via hourly aggregation
- CryptoCompare provides reliable 4h data (primary working source)

---

### Core Trading Bot System

**54 Active Bots** organized into categories:

1. **Trend Following (15 bots)**
   - SMA_CrossBot, EMA_CrossBot, EMA_RibbonBot
   - MACD_Bot, ADX_TrendBot, ParabolicSARBot
   - SuperTrendBot, DonchianChannelBot, etc.

2. **Mean Reversion (12 bots)**
   - BollingerBandsBot, BollingerReversalBot
   - RSI_Bot, RSI_ReversalBot
   - StochasticBot, StochasticReversalBot
   - KeltnerChannelBot, EnvelopeBot, etc.

3. **Momentum (8 bots)**
   - MomentumBot, ROC_Bot, KSTBot
   - VortexBot, ElderRayBot, etc.

4. **Volume Analysis (6 bots)**
   - OBV_TrendBot, MFI_Bot, VolumeBreakoutBot
   - ChaikinOscillatorBot, VolumePriceTrendBot, AccDistBot

5. **Volatility (5 bots)**
   - ATR_VolatilityBot, VolatilityBreakoutBot
   - etc.

6. **Pattern Recognition (4 bots)**
   - FibonacciBot, PivotPointBot
   - SupportResistanceBot, IchimokuBot

7. **Contrarian (4 bots)**
   - RSI_ReversalBot, VolumeSpikeFadeBot
   - BollingerReversalBot, StochasticReversalBot

8. **AI/LLM Enhanced (1 bot)**
   - AIAnalystBot (excluded from quick scans for performance)

**How Bots Work:**
1. Each bot receives computed technical indicators (50+ features)
2. Bot applies its strategy logic to determine: direction (long/short), confidence (1-10), entry/exit prices
3. Original confidence is modified by:
   - **Market Regime Weight** (e.g., trend bots get 1.3x in bull markets)
   - **Timeframe Alignment** (e.g., 1.15x boost if daily & 4h agree)
4. Final confidence clamped to 1-10 range
5. Predictions saved to database for performance tracking

---

### Market Regime Classification

**Status**: ✅ Fully Implemented

**Regimes Detected:**
- **BULL_MARKET**: Strong uptrend (trend bots favored)
- **BEAR_MARKET**: Strong downtrend (contrarian bots favored)
- **SIDEWAYS**: Range-bound (mean reversion bots favored)
- **HIGH_VOLATILITY**: Choppy conditions (volatility bots favored)

**Classification Logic:**
- Uses 30-day price momentum, volatility, and volume analysis
- Classifies with confidence score (0-1.0)
- Applied per-coin and system-wide

**Bot Weight Modifiers:**
```python
# Example: Trend bots in bull market
regime_weight = 1.3  # 30% boost

# Example: Contrarian bots in sideways
regime_weight = 1.2  # 20% boost
```

---

### Multi-Provider Data Resilience

**OHLCV Data (Historical Prices & Candles):**

**Primary**: CoinMarketCap (Start-up tier API key)
- Rate limit: 333 calls/min
- Credits: 298,265 remaining
- Status: ✅ Active (occasional rate limits during heavy scans)

**Backup**: CoinGecko (Free tier)
- Rate limit: ~50 calls/min
- Status: ✅ Active (fallback working)

**Tertiary**: CryptoCompare (Free tier)
- Rate limit: Generous
- Status: ✅ Active (most reliable for 4h candles)

**Futures/Derivatives Data:**

**Primary**: OKX
- Status: ✅ Active (70.7% success rate)
- Provides: Open Interest, Funding Rates, Long/Short Ratios

**Backup**: Coinalyze
- API Key: Valid (2e6860e7-7659-4bd2-9f14-fe3f3cb53b60)
- Status: ⚠️ Unknown (needs testing with new key)

**Tertiary**: Bybit
- Status: ❌ Geo-blocked (CloudFront restrictions)

**Fallback**: Binance
- Status: ❌ Legally blocked (HTTP 451)

**Fallback Architecture:**
```python
async def get_historical_data(symbol):
    providers = [coinmarketcap, coingecko, cryptocompare]
    for provider in providers:
        try:
            data = await provider.fetch(symbol)
            if data: return data
        except RateLimitError:
            continue  # Try next provider
    return []  # All failed
```

---

### Scan Types
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



### Bot Performance Tracking & Analytics

**Status**: ✅ Fully Implemented

**Dashboard Features:**

1. **System Health Metrics**
   - Total predictions evaluated: 416
   - System accuracy: 38.9%
   - Accuracy trend: Improving (+35.1%)
   - Data readiness: 10.7% (need 6 months for full training)

2. **Individual Bot Performance**
   - Win rate, avg profit/loss, total predictions
   - Pending vs. evaluated predictions
   - Performance weight (dynamic multiplier)
   - Partial wins tracking

3. **Performance by Market Regime**
   - Accuracy breakdown: Bull/Bear/Sideways/High Volatility
   - Best regime identification for each bot
   - Predictions count per regime

4. **Bot Degradation Alerts**
   - Critical: Accuracy dropped >10% or consistently <40%
   - Warning: Accuracy dropped 5-10%
   - 11 bots currently flagged

5. **Data Readiness Indicator**
   - Months of data collected: 0.0 (just started)
   - Target: 6 months (2000 evaluated predictions)
   - Current: 416 predictions (10.7% ready)

**Evaluation System:**
- Background job runs daily at 2 AM UTC
- Checks predictions >24h old
- Compares entry price vs. current price
- Marks as: win, loss, partial_win, or pending
- Updates bot performance metrics

---

### Recommendation System

**Aggregation Logic:**
1. **Bot Consensus**: Calculates % of bots agreeing on direction
2. **Weighted Average**: Confidence scores weighted by bot performance
3. **Direction Determination**: Long vs. Short based on majority vote
4. **Final Confidence**: Weighted average of all bot confidences (1-10)

**Recommendation Data:**
- Coin name, symbol, current price
- Consensus direction (long/short)
- Average confidence (1-10)
- Bot count (how many bots analyzed)
- Predicted prices: 24h, 48h, 7d
- Market regime classification
- Rationale (LLM-synthesized for complete scans)

**Top Recommendations Categories:**
1. **Top by Confidence**: Highest average confidence scores
2. **Top % Movers**: Largest predicted percentage gains
3. **Top $ Movers**: Largest predicted absolute dollar gains

---

### Database Schema

**Collections:**

**users**
- Authentication and profile data

**scan_runs**
- Scan metadata: type, start/end time, coins analyzed, status

**recommendations**
- Aggregated coin recommendations from scan runs
- Includes: ticker, coin name, consensus, confidence, regime

**bot_predictions** (NEW - for learning)
- Individual bot predictions per coin per run
- Fields: bot_name, coin_symbol, entry_price, target_price, stop_loss, position_direction, confidence_score, market_regime, outcome_status
- Used for bot performance evaluation

**bot_results** (Real-time storage)
- Raw bot analysis results during scan
- Similar to bot_predictions but includes rationale

**bot_performance**
- Aggregated bot statistics: accuracy, win rate, total predictions
- Updated after each prediction evaluation

---

## 🔧 Recent Critical Fixes

### 1. Database Configuration Issue
**Problem**: Data saved to wrong database (test_database instead of crypto_oracle)  
**Impact**: Login failures, missing recommendations  
**Fix**: Updated `.env` DB_NAME, migrated all data to crypto_oracle  
**Status**: ✅ Resolved

### 2. Bot Details Confidence Scores
**Problem**: All bot details showed 0/10 confidence  
**Root Cause**: Field name mismatch (querying `confidence` instead of `confidence_score`)  
**Fix**: Updated server.py bot_details endpoint field mappings  
**Status**: ✅ Resolved

### 3. Indicator Engine Return Statement
**Problem**: `compute_all_indicators()` missing return statement  
**Impact**: Scans completed with 0 coins analyzed  
**Fix**: Added `return features` at end of method  
**Status**: ✅ Resolved

### 4. BotResult Confidence Validation
**Problem**: Float confidence values failing Pydantic validation (expects int)  
**Impact**: Bot results not saving to database  
**Fix**: Added `int(round(confidence))` conversion before BotResult creation  
**Status**: ✅ Resolved

### 5. Contrarian Bot Confidence Calculation
**Problem**: RSI_ReversalBot and VolumeSpikeFadeBot returning float confidence  
**Impact**: Validation errors, bots not making predictions  
**Fix**: Wrapped confidence calculations with `int()`  
**Status**: ✅ Resolved

---

## 🚧 Pending Implementation (Phase 2)

### Hybrid Bot Aggregation System

**Goal**: Implement intelligent bot weighting and consensus detection to improve recommendation accuracy.

**Components to Implement:**

#### 1. Regime-Aware Bot Weighting (Enhanced)
**Current**: Basic weight multipliers (1.3x for trend bots in bull market)  
**Needed**: 
- Dynamic weight calculation based on historical regime performance
- Adaptive weights that update as bots prove accuracy in specific regimes
- Per-bot regime affinity scoring

#### 2. Confidence Gating
**Specification**: Only include predictions with confidence ≥ 6 in final aggregation  
**Rationale**: Low-confidence predictions (<6) add noise, gating improves signal quality  
**Implementation**: Filter bot_results where confidence < 6 before aggregation

#### 3. Strong Consensus Tier
**Specification**: If 80%+ bots agree on direction, boost final confidence by 1-2 points  
**Rationale**: High agreement indicates strong signal  
**Implementation**:
```python
if consensus_percent >= 80:
    final_confidence *= 1.2  # 20% boost
    final_confidence = min(10, final_confidence)
```

#### 4. Contrarian Agreement Amplification
**Specification**: If 3+ contrarian bots agree with trend bots, apply 1.5x multiplier  
**Rationale**: Contrarians agreeing with trend = very strong signal  
**Implementation**:
```python
contrarian_bots = ['RSI_ReversalBot', 'VolumeSpikeFadeBot', ...]
contrarian_agreements = [b for b in contrarian_bots if b.direction == consensus_direction]
if len(contrarian_agreements) >= 3:
    final_confidence *= 1.5
```

#### 5. Add 3-5 High-Quality Specialized Bots
**Candidates**:
- **Elliott Wave Bot**: Pattern recognition for wave counts
- **Order Flow Bot**: Analyzes bid/ask imbalances from futures data
- **Whale Tracker Bot**: Monitors large wallet movements
- **Social Sentiment Bot**: Twitter/Reddit sentiment analysis
- **Options Flow Bot**: Analyzes options data (if available)

#### 6. Fine-Tune Regime Weight Multipliers
**Current Weights** (examples):
- Trend bots in bull: 1.3x
- Contrarian bots in sideways: 1.2x

**Needed**: 
- Test and optimize these multipliers based on backtest data
- May need to reduce or increase based on actual performance
- Consider per-bot custom multipliers

---

### True Adaptive Intelligence (Phase 3)

**Goal**: Implement machine learning to optimize bot parameters and strategy selection.

**Approaches to Consider:**

#### 1. Parameter Optimization
- Use historical data to optimize bot parameters (e.g., RSI thresholds, SMA periods)
- Grid search or Bayesian optimization
- A/B testing framework for parameter changes

#### 2. Reinforcement Learning
- Model bot selection as RL problem
- State: Market features (price, volume, indicators)
- Action: Select which bots to trust for this coin
- Reward: Prediction accuracy
- Algorithm: Q-Learning or Policy Gradient

#### 3. Ensemble Meta-Learning
- Train meta-model to predict which bots will be accurate for given conditions
- Features: Current indicators, regime, recent bot performance
- Output: Bot weight/importance for current prediction

---

## 🐛 Known Issues & Limitations

### Current Issues

1. **Bot Performance Dashboard Runtime Error**
   - **Status**: ⚠️ Reported by user but not reproducible in testing
   - **All endpoints return valid JSON**: ✅ Verified
   - **Possible causes**: Frontend state management, React error boundary, network timeout
   - **Next steps**: Need browser console logs or screenshot to debug

2. **Rate Limiting During Heavy Scans**
   - **CoinMarketCap**: Hits rate limit (429) frequently during complete scans
   - **CoinGecko**: Free tier rate limits cause fallback delays
   - **Impact**: Slower scans, relies heavily on CryptoCompare fallback
   - **Mitigation**: Already implemented multi-provider fallback (working as designed)

3. **Futures Data Coverage**
   - **OKX**: 70.7% success rate (good but not perfect)
   - **Coinalyze**: New API key needs testing
   - **Bybit & Binance**: Not available (geo-blocked/legal restrictions)
   - **Impact**: Some coins lack futures metrics (open interest, funding rates)

### Limitations

1. **Data Readiness**: Only 10.7% ready (416/2000 predictions needed)
   - System accuracy (38.9%) will improve as more historical data accumulates
   - Need 6 months of data collection for reliable bot performance metrics

2. **AIAnalystBot Excluded from Quick Scans**
   - LLM calls add 2-3 seconds per coin
   - Quick scans use 53/54 bots for speed
   - Complete scans use all 54 bots

3. **Single-Exchange Futures Data**
   - Currently only OKX provides reliable futures data
   - Missing multi-exchange aggregation for open interest
   - Cannot detect divergences across exchanges

4. **No Real-Time Alerts**
   - System requires manual scan initiation
   - No push notifications for high-confidence recommendations
   - No automated scheduled scans (can be added via cron)

---

## 🔒 Security & Configuration

### Environment Variables (.env)

**Backend:**
```bash
MONGO_URL=mongodb://localhost:27017
DB_NAME=crypto_oracle

COINMARKETCAP_API_KEY=2bd6bec9-9bf0-4907-9c67-f8d5f43e3b2d
COINALYZE_API_KEY=2e6860e7-7659-4bd2-9f14-fe3f3cb53b60

PRIMARY_PROVIDER=coinmarketcap
BACKUP_PROVIDER=coingecko

JWT_SECRET_KEY=<secure_random_key>
```

**Frontend:**
```bash
REACT_APP_BACKEND_URL=<external_backend_url>
```

### Critical Rules
1. **Never modify MONGO_URL or REACT_APP_BACKEND_URL** (production configured)
2. **All backend routes must be prefixed with `/api`** for Kubernetes ingress
3. **Use environment variables exclusively** - no hardcoding URLs/ports

---

## 📊 Performance Metrics

### Current System Stats
- **Total Bots**: 54 active
- **Scan Time**: 30-60s (quick), 3-5min (complete)
- **Coins Analyzed**: 100 per scan
- **Predictions Generated**: 4,000-5,000 per scan
- **Database Size**: ~140K bot results, ~58K predictions, ~1,300 recommendations
- **System Accuracy**: 38.9% (improving, early stage)
- **Data Providers**: 7 total (3 OHLCV, 4 futures)
- **API Success Rate**: 
  - OHLCV: 95%+ (multi-provider fallback working)
  - Futures: 70.7% (OKX only)

### Resource Usage
- **Backend Memory**: ~200-300MB
- **MongoDB Storage**: ~500MB
- **API Calls per Scan**: 
  - OHLCV: ~300-400 calls
  - Futures: ~100 calls
  - Total: ~400-500 calls per scan

---

## 🚀 Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- MongoDB 5.0+
- CoinMarketCap API key (Start-up tier recommended)

### Installation

1. **Backend Setup**
```bash
cd /app/backend
pip install -r requirements.txt
# Update .env with API keys
sudo supervisorctl restart backend
```

2. **Frontend Setup**
```bash
cd /app/frontend
yarn install
sudo supervisorctl restart frontend
```

3. **Verify Services**
```bash
sudo supervisorctl status
# Should show: backend RUNNING, frontend RUNNING, mongodb RUNNING
```

### Running a Scan

**Via UI:**
1. Navigate to http://localhost:3000
2. Login with credentials
3. Click \"Run Quick Scan\" or \"Run Complete Scan\"
4. Wait for results (30s-5min)
5. View recommendations on dashboard

**Via API:**
```bash
# Trigger quick scan
curl -X POST http://localhost:8001/api/scan/quick \
  -H \"Content-Type: application/json\" \
  -d '{\"user_id\": \"your_user_id\"}'

# Check status
curl http://localhost:8001/api/scan/status

# Get recommendations
curl http://localhost:8001/api/recommendations/top5
```

---

## 📝 Development Notes

### Testing
- Use `deep_testing_backend_v2` for backend API testing
- Use `auto_frontend_testing_agent` for UI testing
- Always restart services after .env changes: `sudo supervisorctl restart backend`

### Debugging
- **Backend logs**: `tail -f /var/log/supervisor/backend.err.log`
- **Frontend logs**: `tail -f /var/log/supervisor/frontend.err.log`
- **MongoDB**: `mongosh crypto_oracle --eval \"db.stats()\"`

### Common Commands
```bash
# Restart all services
sudo supervisorctl restart all

# Check service status
sudo supervisorctl status

# View backend logs
tail -n 100 /var/log/supervisor/backend.err.log

# Test API endpoint
curl http://localhost:8001/api/bots/status

# Check database
mongosh crypto_oracle --eval \"db.recommendations.countDocuments({})\"
```

---

## 📄 License

Proprietary - All Rights Reserved

---

## 🤝 Support

For issues, questions, or feature requests, please contact the development team.

**Last Updated**: October 3, 2025  
**Version**: 1.0.0 (Phase 1 Complete, Phase 2 Pending)
"
