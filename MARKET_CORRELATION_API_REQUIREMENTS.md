# Market Correlation Analysis - External API Requirements

This document outlines the external APIs and data sources needed to fully implement the Market Correlation Analysis feature.

## Overview

The Market Correlation Analysis component provides real-time correlation data between different cryptocurrencies, helping traders understand market relationships and diversification opportunities.

## Required APIs

### 1. **Price Data API**
To calculate correlations, we need historical and real-time price data for multiple cryptocurrencies.

**Recommended Providers:**

- **CoinGecko API** (Free tier available)
  - Endpoint: `/coins/{id}/market_chart`
  - Features: Historical prices, market cap, volume
  - Rate Limit: 10-50 calls/minute (free tier)
  - Documentation: https://www.coingecko.com/api/documentation

- **CoinMarketCap API** (Free tier available)
  - Endpoint: `/v1/cryptocurrency/quotes/historical`
  - Features: Historical OHLCV data
  - Rate Limit: 333 calls/day (free tier)
  - Documentation: https://coinmarketcap.com/api/documentation/v1/

- **CryptoCompare API** (Free tier available)
  - Endpoint: `/data/v2/histoday`
  - Features: Daily historical data
  - Rate Limit: 100,000 calls/month (free tier)
  - Documentation: https://min-api.cryptocompare.com/documentation

**What We Need:**
- Historical daily closing prices for the last 30-90 days
- Multiple coins simultaneously (at least 20-50 top coins)
- Real-time price updates for live correlation tracking

### 2. **Market Data API**
For enhanced correlation analysis including volume and market cap correlations.

**Recommended:**

- **Messari API** (Free tier available)
  - Endpoint: `/v1/assets/{asset}/metrics/market-data`
  - Features: Comprehensive market metrics
  - Rate Limit: 20 calls/minute (free tier)
  - Documentation: https://messari.io/api/docs

### 3. **Technical Indicators API** (Optional Enhancement)
For correlation of technical indicators across different coins.

**Recommended:**

- **TradingView API** (Requires subscription)
  - Features: Real-time technical indicators
  - Use Case: Correlate RSI, MACD across multiple assets

- **Alpha Vantage** (Free tier available)
  - Endpoint: `/query?function=RSI` and other indicators
  - Rate Limit: 5 API calls/minute, 500 calls/day (free tier)
  - Documentation: https://www.alphavantage.co/documentation/

## Implementation Requirements

### Data Collection

1. **Batch Historical Data Fetch**
   - Collect 30-90 days of daily closing prices for 20-50 coins
   - Store in database for faster correlation calculations
   - Update daily via scheduled cron job

2. **Real-Time Updates**
   - WebSocket connections for live price feeds
   - Recalculate correlations every 15-60 minutes
   - Update UI via Supabase Realtime

### Correlation Calculation

Calculate Pearson correlation coefficient between coin pairs:

```
r = Σ((x - x̄)(y - ȳ)) / √(Σ(x - x̄)² * Σ(y - ȳ)²)
```

Where:
- x, y are price series for two different coins
- x̄, ȳ are mean prices

### Database Schema

Already exists in migration `20251005070034_add_market_correlation_tables.sql`:

- `market_correlations` table
  - coin_pair (e.g., "BTC-ETH")
  - correlation_value (-1 to 1)
  - time_period (30d, 90d, etc.)
  - last_updated

### Edge Function

Create a new edge function `calculate-correlations`:

```typescript
// Pseudo-code structure
export default async function handler(req) {
  // 1. Fetch price data from external API
  const prices = await fetchPriceData(coins, period)

  // 2. Calculate correlations for all pairs
  const correlations = calculateCorrelationMatrix(prices)

  // 3. Store in database
  await supabase.from('market_correlations').upsert(correlations)

  return { success: true, correlations }
}
```

## Cost Considerations

### Free Tier Limitations

With free API tiers:
- **CoinGecko**: 50 calls/min = ~3,000 calls/hour
- **CoinMarketCap**: 333 calls/day
- **CryptoCompare**: 100,000 calls/month = ~3,300 calls/day

### Recommended Approach for Production

1. **Start with CoinGecko free tier**
   - Sufficient for 50 coins with hourly updates
   - Cache data in database to minimize API calls

2. **Upgrade as needed**
   - CoinGecko Pro: $129/month (500 calls/min)
   - CoinMarketCap Basic: $29/month (10,000 calls/day)

3. **Optimization Strategies**
   - Calculate correlations server-side once per hour
   - Cache results in Supabase
   - Use database queries for UI instead of repeated API calls
   - Implement request batching

## Current Implementation Status

### ✅ Completed
- Database schema (market_correlations table)
- Frontend component (MarketCorrelation.jsx)
- WebSocket support for real-time updates
- UI for displaying correlation matrix

### ❌ Missing (Requires External APIs)
- Actual price data fetching from external APIs
- Correlation calculation logic
- Scheduled updates via cron
- Edge function to process and store correlations

## Implementation Steps

1. **Choose API Provider** (Recommended: CoinGecko free tier)
2. **Sign up and get API key**
3. **Create Edge Function** (`supabase/functions/calculate-correlations/index.ts`)
4. **Implement correlation calculation algorithm**
5. **Set up Supabase cron job** to run hourly
6. **Test with small dataset** (5-10 coins)
7. **Scale to full dataset** (50+ coins)
8. **Monitor API usage and costs**

## Alternative: Mock Data for Development

For development and testing without external APIs, the current implementation uses mock data:

```javascript
// Already implemented in MarketCorrelation.jsx
const mockCorrelations = [
  { pair: 'BTC-ETH', correlation: 0.85, strength: 'Strong' },
  { pair: 'BTC-SOL', correlation: 0.72, strength: 'Moderate' },
  // ... more mock data
]
```

This allows the UI to be tested and refined before integrating real APIs.

## Security Notes

- **Never commit API keys** to the repository
- Store API keys in Supabase secrets/environment variables
- Use edge functions to keep API keys server-side
- Implement rate limiting to avoid exceeding API quotas
- Monitor API usage via provider dashboards

## Support and Resources

- CoinGecko Support: https://www.coingecko.com/en/api/documentation
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Supabase Cron Jobs: https://supabase.com/docs/guides/functions/schedule-functions
