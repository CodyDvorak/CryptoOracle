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

## ✅ Implemented Features

[Content continues with all sections from previous README...]
"
