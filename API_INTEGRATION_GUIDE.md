# Crypto Oracle - API Integration Guide

## 🚨 PROBLEM: Prices Are Way Off

**Root Cause**: The system is using **hardcoded mock data** instead of real market data.

**Current Mock Prices** (in scan-run/index.ts):
```javascript
const mockCoins = [
  { symbol: 'BTC', name: 'Bitcoin', price: 45000 },   // ❌ Static
  { symbol: 'ETH', name: 'Ethereum', price: 2800 },   // ❌ Static
  { symbol: 'SOL', name: 'Solana', price: 120 },      // ❌ Static
  // ...
];
```

**Solution**: Replace with real-time API calls to fetch actual market prices.

---

## 📊 APIS NEEDED (Grouped by Function)

### GROUP 1: SPOT PRICE DATA (Primary Source)
These APIs provide current cryptocurrency prices, volume, and market cap data.

#### 🥇 **CoinGecko API** (FREE TIER AVAILABLE)
- **Purpose**: Primary source for spot prices, volume, market cap
- **Used In**:
  - `scan-run/crypto-data-service.ts` (already implemented but not used)
  - `bot-performance-evaluator/index.ts`
- **Get API Key**: https://www.coingecko.com/en/api/pricing
  - **Free Tier**: 50 calls/minute (sufficient to start)
  - **Pro Tier**: $129/month - 500 calls/minute
- **Endpoints Used**:
  - `/coins/markets` - Get list of coins with prices
  - `/coins/{id}/ohlc` - Get OHLC (candlestick) data
  - `/simple/price` - Get current price for specific coins
- **Status**: ✅ Partially implemented, needs API key and activation

#### 🥈 **CoinMarketCap API** (FREE TIER LIMITED)
- **Purpose**: Backup/fallback for spot prices
- **Priority**: 1 (highest priority in health check)
- **Get API Key**: https://coinmarketcap.com/api/
  - **Free Tier**: 333 calls/day, 10,000 credits/month
  - **Basic**: $29/month - 10,000 calls/month
  - **Startup**: $99/month - 60,000 calls/month
- **Endpoints Needed**:
  - `/v2/cryptocurrency/quotes/latest` - Get current prices
  - `/v2/cryptocurrency/ohlcv/latest` - Get OHLCV data
  - `/v1/cryptocurrency/listings/latest` - Get top coins
- **Status**: ❌ Not implemented yet

#### 🥉 **CryptoCompare API** (FREE TIER AVAILABLE)
- **Purpose**: Third fallback for spot prices
- **Get API Key**: https://www.cryptocompare.com/cryptopian/api-keys
  - **Free Tier**: 100,000 calls/month
  - **Basic**: $35/month - 300,000 calls/month
- **Endpoints Needed**:
  - `/data/pricemultifull` - Get full price data
  - `/data/v2/histohour` - Get historical hourly data
- **Status**: ❌ Not implemented yet

---

### GROUP 2: DERIVATIVES & FUTURES DATA
These APIs provide derivatives data like funding rates, open interest, liquidations.

#### 🥇 **Coinalyze API**
- **Purpose**: Derivatives metrics, funding rates, open interest
- **Used In**: Bot signals for funding rate arbitrage, liquidation hunting
- **Get API Key**: https://coinalyze.net/api/
  - **Pricing**: Contact for details
- **Endpoints Needed**:
  - `/open-interest` - Get open interest data
  - `/funding-rate` - Get funding rate history
  - `/liquidations` - Get liquidation data
- **Status**: ❌ Not implemented (currently using random mock data)

#### 🥈 **Binance Futures API** (FREE)
- **Purpose**: Binance derivatives data (funding, OI, long/short ratios)
- **Get API Key**: https://www.binance.com/en/my/settings/api-management
  - **Free**: No cost, just create account
- **Endpoints Needed**:
  - `/fapi/v1/fundingRate` - Funding rate history
  - `/fapi/v1/openInterest` - Open interest
  - `/futures/data/takerlongshortRatio` - Taker buy/sell ratio
  - `/futures/data/globalLongShortAccountRatio` - Global long/short ratio
- **Status**: ❌ Not implemented

#### 🥉 **OKX API** (FREE)
- **Purpose**: OKX exchange derivatives data
- **Get API Key**: https://www.okx.com/account/my-api
  - **Free**: No cost
- **Endpoints Needed**:
  - `/api/v5/public/funding-rate` - Funding rates
  - `/api/v5/public/open-interest` - Open interest
- **Status**: ❌ Not implemented

#### **Bybit API** (FREE)
- **Purpose**: Bybit exchange derivatives data
- **Get API Key**: https://www.bybit.com/app/user/api-management
  - **Free**: No cost
- **Endpoints Needed**:
  - `/derivatives/v3/public/funding/history` - Funding rates
  - `/derivatives/v3/public/open-interest` - Open interest
- **Status**: ❌ Not implemented

---

### GROUP 3: ON-CHAIN & SOCIAL DATA (Advanced)
These provide blockchain metrics, whale activity, sentiment analysis.

#### **Glassnode API** (PAID)
- **Purpose**: On-chain metrics, whale wallets, network activity
- **Get API Key**: https://glassnode.com/
  - **Starter**: $49/month
  - **Advanced**: $799/month
- **Endpoints Needed**:
  - `/v1/metrics/transactions/transfers_volume_sum`
  - `/v1/metrics/addresses/active_count`
  - `/v1/metrics/supply/current`
- **Status**: ❌ Not implemented (optional for future)

#### **Santiment API** (PAID)
- **Purpose**: Social sentiment, developer activity, whale tracking
- **Get API Key**: https://santiment.net/
  - **Pro**: $99/month
- **Status**: ❌ Not implemented (optional for future)

#### **LunarCrush API** (FREE TIER)
- **Purpose**: Social media sentiment (Twitter, Reddit)
- **Get API Key**: https://lunarcrush.com/developers/api
  - **Free Tier**: 50 calls/day
  - **Pro**: $99/month - 1000 calls/day
- **Status**: ❌ Not implemented (optional for future)

---

## 🔧 CURRENT IMPLEMENTATION STATUS

### ✅ Already Implemented (But Not Used)
1. **CoinGecko integration** in `crypto-data-service.ts`
   - `getTopCoins()` - Fetch top cryptocurrencies
   - `getOHLCVData()` - Fetch candle/chart data with indicators
   - Technical indicators calculated (RSI, MACD, Bollinger Bands, etc.)

### ❌ Mock Data (Needs Replacement)
1. **Derivatives data** - Currently random numbers
   - Funding rates: `Math.random() - 0.5) * 0.001`
   - Open interest: `Math.random() * 100000000`
   - Long/short ratio: `0.8 + Math.random() * 0.4`

2. **Spot prices** - Currently hardcoded
   - BTC at $45,000 (actual: varies)
   - ETH at $2,800 (actual: varies)
   - All prices static and outdated

---

## 🎯 RECOMMENDED IMPLEMENTATION ORDER

### Phase 1: Get Basic Prices Working (IMMEDIATE)
**Priority**: 🔴 CRITICAL
**Time**: 1-2 hours

1. **Get CoinGecko API key** (free tier)
   - Sign up at https://www.coingecko.com/
   - Go to API dashboard
   - Copy your API key

2. **Activate crypto-data-service in scan-run**
   ```typescript
   // Replace this:
   const mockCoins = [...]

   // With this:
   import { cryptoDataService } from './crypto-data-service.ts';
   const coins = await cryptoDataService.getTopCoins(filterScope, minPrice, maxPrice);
   ```

3. **Add API key to environment**
   - CoinGecko doesn't require API key for basic tier
   - For Pro tier: Store in Supabase edge function env vars

### Phase 2: Add Derivatives Data (HIGH PRIORITY)
**Priority**: 🟡 HIGH
**Time**: 2-3 hours

1. **Get Binance Futures API** (free, no key needed for public endpoints)
   - Create function to fetch funding rates
   - Fetch open interest data
   - Get long/short ratios

2. **Optional: Get Coinalyze key** if you need advanced derivatives
   - Better data aggregation
   - More exchanges covered

### Phase 3: Add Redundancy (MEDIUM PRIORITY)
**Priority**: 🟢 MEDIUM
**Time**: 3-4 hours

1. **Get CoinMarketCap API key** (free tier)
   - Implement as fallback when CoinGecko fails
   - Add to data provider rotation

2. **Get CryptoCompare API key** (free tier)
   - Third fallback option
   - Increases reliability

### Phase 4: Advanced Features (FUTURE)
**Priority**: ⚪ LOW
**Time**: Ongoing

1. On-chain metrics (Glassnode)
2. Social sentiment (LunarCrush)
3. WebSocket connections for real-time updates

---

## 📝 HOW TO GET API KEYS

### 1. CoinGecko (FREE - Start Here) ⭐
```
1. Go to: https://www.coingecko.com/
2. Click "Sign Up" (top right)
3. Verify email
4. Go to: https://www.coingecko.com/en/developers/dashboard
5. Click "Create API Key"
6. Copy your API key
7. Note: Free tier doesn't require API key, but Pro tier does
```

### 2. CoinMarketCap (FREE TIER)
```
1. Go to: https://coinmarketcap.com/api/
2. Click "Get Your Free API Key Now"
3. Fill out registration
4. Verify email
5. Go to dashboard
6. Copy your API key from "API Key" section
```

### 3. Binance (FREE) ⭐
```
1. Go to: https://www.binance.com/
2. Create account if you don't have one
3. Go to: https://www.binance.com/en/my/settings/api-management
4. Click "Create API"
5. Name it "Crypto Oracle"
6. Enable "Can Read" permission ONLY (NOT "Can Trade")
7. Complete 2FA verification
8. Copy API Key and Secret Key
9. Whitelist IP if needed (optional for public data)
```

### 4. Coinalyze (PAID - Contact Sales)
```
1. Go to: https://coinalyze.net/api/
2. Click "Contact Us" or "Request Access"
3. Fill out form with your use case
4. They will provide pricing and API credentials
```

---

## 🔐 WHERE TO STORE API KEYS

### For Edge Functions (Backend)
```typescript
// Option 1: Environment variables (RECOMMENDED)
const COINGECKO_API_KEY = Deno.env.get('COINGECKO_API_KEY');
const COINMARKETCAP_API_KEY = Deno.env.get('COINMARKETCAP_API_KEY');
const BINANCE_API_KEY = Deno.env.get('BINANCE_API_KEY');
const BINANCE_SECRET_KEY = Deno.env.get('BINANCE_SECRET_KEY');

// Set via Supabase dashboard:
// Project Settings > Edge Functions > Environment Variables
```

### For Frontend (Not Recommended)
❌ **DO NOT** store API keys in frontend code
✅ Always call APIs from edge functions

---

## 💻 IMPLEMENTATION EXAMPLE

### Current Code (scan-run/index.ts)
```typescript
// ❌ BAD: Using mock data
const mockCoins = [
  { symbol: 'BTC', name: 'Bitcoin', price: 45000 },
  { symbol: 'ETH', name: 'Ethereum', price: 2800 },
];

for (const coin of mockCoins) {
  // Generate predictions...
}
```

### Updated Code (SHOULD BE)
```typescript
// ✅ GOOD: Using real data
import { cryptoDataService } from './crypto-data-service.ts';

const coins = await cryptoDataService.getTopCoins(
  filterScope,  // 'top50', 'top200', or 'all'
  minPrice,     // Optional filter
  maxPrice      // Optional filter
);

for (const coin of coins) {
  // Get detailed technical data
  const ohlcv = await cryptoDataService.getOHLCVData(coin.symbol);
  const derivatives = await cryptoDataService.getDerivativesData(coin.symbol);

  // Now use REAL data for bot predictions
}
```

---

## 🎯 IMMEDIATE ACTION ITEMS

### Step 1: Get CoinGecko Working (30 minutes)
1. ✅ crypto-data-service.ts already exists
2. ✅ CoinGecko API calls already implemented
3. ❌ **TODO**: Import and use in scan-run/index.ts
4. ❌ **TODO**: Replace mockCoins with real API calls

### Step 2: Update scan-run Function (1 hour)
1. ❌ Import crypto-data-service
2. ❌ Replace mockCoins with getTopCoins()
3. ❌ Fetch OHLCV data for each coin
4. ❌ Use real indicators instead of random values
5. ❌ Deploy updated function

### Step 3: Add Derivatives Data (2 hours)
1. ❌ Get Binance API credentials
2. ❌ Create derivatives-data-service.ts
3. ❌ Implement funding rate fetching
4. ❌ Implement open interest fetching
5. ❌ Replace mock derivatives data

### Step 4: Test & Verify (30 minutes)
1. ❌ Run a scan with real data
2. ❌ Verify prices match market
3. ❌ Check bot predictions make sense
4. ❌ Monitor API rate limits

---

## 📊 API RATE LIMITS & COSTS

| API | Free Tier | Calls/Min | Calls/Day | Cost/Month |
|-----|-----------|-----------|-----------|------------|
| CoinGecko | ✅ Yes | 50 | 72,000 | $0 |
| CoinGecko Pro | - | 500 | 720,000 | $129 |
| CoinMarketCap | ✅ Yes | - | 333 | $0 |
| CoinMarketCap Basic | - | - | ~333 | $29 |
| CryptoCompare | ✅ Yes | - | ~3,300 | $0 |
| Binance | ✅ Yes | 1,200 | - | $0 |
| Coinalyze | ❌ No | Contact | Contact | Contact |
| OKX | ✅ Yes | 20 | - | $0 |
| Bybit | ✅ Yes | 50 | - | $0 |

### Estimated Usage (Per Scan)
- **Spot prices**: 1 call (gets top 500 coins)
- **OHLCV data per coin**: 1 call per coin
- **Derivatives per coin**: 1 call per coin

**For a scan of 100 coins:**
- Spot prices: 1 call
- OHLCV: 100 calls
- Derivatives: 100 calls
- **Total**: ~201 calls per scan

**With CoinGecko Free (50 calls/min):**
- Time per scan: ~4 minutes
- Scans per hour: ~15 scans
- Scans per day: ~360 scans

**Recommendation**: Start with free tier, upgrade if needed.

---

## 🛠️ TROUBLESHOOTING

### "Rate limit exceeded"
**Solution**:
1. Add caching (store prices for 1-5 minutes)
2. Implement request queue
3. Upgrade to paid tier
4. Add multiple API providers as fallback

### "API key invalid"
**Solution**:
1. Check environment variables are set correctly
2. Verify key hasn't expired
3. Check API key permissions
4. Regenerate key if needed

### "Prices still wrong"
**Solution**:
1. Verify crypto-data-service is being imported
2. Check function deployment succeeded
3. Clear any caching layers
4. Check API responses in logs

---

## 📞 SUPPORT CONTACTS

### CoinGecko
- Docs: https://www.coingecko.com/en/api/documentation
- Support: hello@coingecko.com

### CoinMarketCap
- Docs: https://coinmarketcap.com/api/documentation/v1/
- Support: https://coinmarketcap.com/api/support/

### Binance
- Docs: https://binance-docs.github.io/apidocs/
- Support: https://www.binance.com/en/support

---

## ✅ COMPLETION CHECKLIST

- [ ] Signed up for CoinGecko
- [ ] Got CoinGecko API key (or using free tier)
- [ ] Signed up for CoinMarketCap
- [ ] Got CoinMarketCap API key
- [ ] Created Binance account
- [ ] Got Binance API key and secret
- [ ] Updated scan-run to use crypto-data-service
- [ ] Added API keys to Supabase environment
- [ ] Deployed updated scan-run function
- [ ] Tested with real market data
- [ ] Verified prices are accurate
- [ ] Implemented derivatives data fetching
- [ ] Added error handling and fallbacks
- [ ] Monitoring API rate limits
