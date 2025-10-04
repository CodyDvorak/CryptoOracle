# Crypto Oracle - API Structure Hierarchy Map

## 1. Frontend → Supabase Edge Functions (Primary Entry Points)

### 1.1 Dashboard.jsx → scan-run
- **Endpoint**: `/functions/v1/scan-run`
- **Method**: POST
- **Purpose**: Initiate market scan with trading bot analysis
- **Data Flow**:
  ```
  User clicks "Start Scan"
  → POST /scan-run (scanType, coinLimit, filterScope)
  → Creates scan_runs record (status: 'running')
  → Triggers scan processing
  ```

### 1.2 Dashboard.jsx → scan-latest
- **Endpoint**: `/functions/v1/scan-latest`
- **Method**: GET
- **Purpose**: Fetch most recent scan recommendations
- **Data Flow**:
  ```
  Component mounts
  → GET /scan-latest
  → Returns latest recommendations from database
  ```

### 1.3 History.jsx → scan-history
- **Endpoint**: `/functions/v1/scan-history`
- **Method**: GET
- **Purpose**: Retrieve historical scan data
- **Data Flow**:
  ```
  User navigates to History page
  → GET /scan-history
  → Returns scan_runs with recommendations
  ```

### 1.4 BotPerformance.jsx → bot-performance
- **Endpoint**: `/functions/v1/bot-performance`
- **Method**: GET
- **Purpose**: Get individual bot performance metrics
- **Data Flow**:
  ```
  Component loads
  → GET /bot-performance
  → Returns bot_performance records with accuracy stats
  ```

### 1.5 Profile.jsx → scheduled-scan
- **Endpoint**: `/functions/v1/scheduled-scan`
- **Method**: POST/GET
- **Purpose**: Manage automated scans
- **Data Flow**:
  ```
  User configures schedule
  → POST /scheduled-scan (settings)
  → Updates scheduled_scans table
  ```

### 1.6 Profile.jsx → notifications
- **Endpoint**: `/functions/v1/notifications`
- **Method**: GET
- **Purpose**: Fetch user notifications
- **Data Flow**:
  ```
  NotificationCenter component
  → GET /notifications
  → Returns notifications table records
  ```

---

## 2. Scan-Run Edge Function → External APIs (Secondary)

### 2.1 scan-run/index.ts → crypto-data-service.ts

#### 2.1.1 CryptoDataService.getTopCoins()
- **External API**: CoinGecko
- **Endpoint**: `https://api.coingecko.com/api/v3/coins/markets`
- **Method**: GET
- **Purpose**: Fetch top coins by market cap
- **Parameters**:
  - `vs_currency=usd`
  - `order=market_cap_desc`
  - `per_page={50|100|200|500}`
- **Returns**: Array of coins with:
  - symbol, name, price
  - volume24h, marketCap
- **Auth**: None (Free tier)

#### 2.1.2 CryptoDataService.getOHLCVData()
- **External API**: CoinGecko
- **Endpoint**: `https://api.coingecko.com/api/v3/coins/{symbol}/ohlc`
- **Method**: GET
- **Purpose**: Get OHLCV candlestick data for technical analysis
- **Parameters**:
  - `vs_currency=usd`
  - `days=30`
- **Returns**:
  - Candles (open, high, low, close, volume)
  - Calculated indicators:
    - RSI, MACD, Bollinger Bands
    - EMAs (20, 50, 200), SMAs
    - ATR, ADX, Stochastic
    - CCI, Williams %R, VWAP
    - OBV, Ichimoku, Parabolic SAR
- **Auth**: None (Free tier)

#### 2.1.3 CryptoDataService.getDerivativesData()
- **Current Status**: **MOCK DATA** ⚠️
- **Expected APIs** (Not yet implemented):
  - Binance Futures API
  - OKX Futures API
  - Deribit API
- **Should Return**:
  - Open Interest
  - Funding Rates
  - Long/Short Ratios
  - Liquidations data
  - Premium Index

### 2.2 scan-run/index.ts → trading-bots.ts

#### 2.2.1 All 59 Trading Bots
- **Input**: OHLCV data + derivatives data + coin info
- **Processing**: Internal algorithm (no external API)
- **Output**: Bot predictions
  - Direction (LONG/SHORT)
  - Confidence score (0-1)
  - Entry price, Take Profit, Stop Loss
  - Leverage recommendation
- **Examples**:
  - RSIBot: Checks RSI < 30 (oversold) or > 70 (overbought)
  - MACDBot: Analyzes MACD crossovers
  - EMABot: Golden cross / death cross detection
  - VolumeBot: Volume spike detection
  - (+ 55 more specialized bots)

---

## 3. Scan-Run Edge Function → Additional Services (Tertiary)

### 3.1 ai-refinement-service.ts (Optional Enhancement)

#### 3.1.1 GROQ API
- **Endpoint**: `https://api.groq.com/openai/v1/chat/completions`
- **Method**: POST
- **Purpose**: AI analysis of market conditions
- **Model**: llama-3.1-70b-versatile
- **Auth**: `GROQ_API_KEY` environment variable
- **Status**: Available but not actively used in main scan flow

#### 3.1.2 Google Gemini API
- **Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`
- **Method**: POST
- **Purpose**: Alternative AI analysis
- **Auth**: `GEMINI_API_KEY` environment variable
- **Status**: Available but not actively used in main scan flow

### 3.2 social-sentiment-service.ts (Available but not integrated)

#### 3.2.1 Reddit API
- **Endpoint**: `https://www.reddit.com/search.json`
- **Method**: GET
- **Purpose**: Social sentiment from Reddit discussions
- **Auth**: None (public API)
- **Status**: Service exists but NOT called by scan-run

#### 3.2.2 CryptoPanic API
- **Endpoint**: `https://cryptopanic.com/api/v1/posts/`
- **Method**: GET
- **Purpose**: Crypto news aggregation
- **Auth**: `CRYPTOPANIC_API_KEY` required
- **Status**: Service exists but NOT called by scan-run

#### 3.2.3 NewsAPI
- **Endpoint**: `https://newsapi.org/v2/everything`
- **Method**: GET
- **Purpose**: General crypto news
- **Auth**: `NEWSAPI_KEY` required
- **Status**: Service exists but NOT called by scan-run

### 3.3 onchain-data-service.ts (Available but not integrated)

#### 3.3.1 Blockchair API
- **Endpoint**: `https://api.blockchair.com/{blockchain}/transactions`
- **Method**: GET
- **Purpose**: Whale transaction tracking
- **Auth**: None (public API)
- **Status**: Service exists but NOT called by scan-run

#### 3.3.2 Blockchain.info API
- **Endpoint**: `https://blockchain.info/unconfirmed-transactions`
- **Method**: GET
- **Purpose**: Bitcoin mempool data
- **Auth**: None (public API)
- **Status**: Service exists but NOT called by scan-run

#### 3.3.3 BlockCypher API
- **Endpoint**: `https://api.blockcypher.com/v1/{chain}`
- **Method**: GET
- **Purpose**: Multi-chain blockchain data
- **Auth**: None (public API)
- **Status**: Service exists but NOT called by scan-run

---

## 4. Background Edge Functions (Automated)

### 4.1 scan-cleanup
- **Trigger**: Supabase Cron (every 5 minutes)
- **Purpose**: Mark stalled scans as completed
- **APIs Used**: None (database only)

### 4.2 cron-trigger
- **Trigger**: External cron service
- **Purpose**: Trigger scheduled scans
- **APIs Used**: Calls scan-run internally

### 4.3 bot-performance-evaluator
- **Trigger**: Manual or scheduled
- **Purpose**: Calculate bot accuracy metrics
- **APIs Used**: None (database only)

### 4.4 email-alerts / email-processor
- **Trigger**: New recommendations
- **Purpose**: Send email notifications
- **APIs Used**: SMTP (configuration in integrations_config)

---

## 5. Database Tables (Supabase PostgreSQL)

### Primary Tables:
1. **scan_runs** - Scan metadata
2. **recommendations** - Aggregated coin signals
3. **bot_predictions** - Individual bot votes
4. **bot_performance** - Bot accuracy tracking
5. **users** - Auth users
6. **user_profiles** - User preferences
7. **notifications** - In-app notifications
8. **scheduled_scans** - Automation settings

---

## Current API Usage Summary

### ✅ ACTIVE (Currently Being Called):
1. **CoinGecko** - Coin market data + OHLCV
   - No API key required (free tier)
   - Rate limit: ~50 calls/minute
   - Used by: scan-run function

### ⚠️ MOCK DATA (Needs Real Implementation):
2. **Derivatives Data** - Funding rates, OI, ratios
   - Currently returns random data
   - Needs: Binance API, OKX API keys

### 🔌 AVAILABLE BUT NOT INTEGRATED:
3. **GROQ AI** - Market analysis
4. **Gemini AI** - Alternative analysis
5. **Reddit** - Social sentiment
6. **CryptoPanic** - Crypto news
7. **NewsAPI** - General news
8. **Blockchair** - On-chain data
9. **BlockCypher** - Blockchain stats
10. **Blockchain.info** - Bitcoin data

### 📊 Data Flow Summary:
```
User Action (Frontend)
    ↓
Supabase Edge Function
    ↓
External API (CoinGecko)
    ↓
Trading Bots (59 algorithms)
    ↓
Database (PostgreSQL)
    ↓
Real-time Updates (Supabase Realtime)
    ↓
Frontend Display
```

---

## Priority for Full Implementation:

**HIGH PRIORITY:**
1. ✅ CoinGecko integration (DONE)
2. ❌ Binance/OKX derivatives data (NEEDED)

**MEDIUM PRIORITY:**
3. Social sentiment APIs (Reddit, CryptoPanic)
4. On-chain data (Blockchair, BlockCypher)

**LOW PRIORITY:**
5. AI refinement (GROQ, Gemini)
6. News aggregation (NewsAPI)

---

**Legend:**
- 1.x = Frontend to Backend
- 2.x = Backend to External APIs
- 3.x = Optional Enhancement Services
- 4.x = Background Automation
- 5.x = Data Persistence Layer
