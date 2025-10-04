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
