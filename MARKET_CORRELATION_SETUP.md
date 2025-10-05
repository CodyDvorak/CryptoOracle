# Market Correlation Analysis - Setup Guide

## Implementation Complete ✅

The Market Correlation Analysis feature has been fully implemented with multi-API support and automated updates.

---

## Architecture

### Components Created

1. **Price Data Service** (`calculate-correlations/price-data-service.ts`)
   - Multi-API support with intelligent fallback
   - Primary: CoinMarketCap (paid tier)
   - Backup: CryptoCompare
   - Tertiary: CoinGecko

2. **Correlation Calculator** (`calculate-correlations/correlation-calculator.ts`)
   - Pearson correlation coefficient implementation
   - Price series alignment
   - Strength classification (STRONG/MODERATE/WEAK)
   - Market-wide metrics calculation

3. **Edge Functions**
   - `calculate-correlations` - Main calculation engine
   - `correlation-cron` - Automated daily updates
   - `market-correlation` - Frontend API (updated)

4. **Database Schema**
   - `market_correlations` - Stores correlation pairs
   - `correlation_snapshots` - Daily market snapshots

---

## API Configuration

### Required Environment Variables

You need to add these API keys to your Supabase project:

```bash
# Primary API (Paid Tier - Best)
COINMARKETCAP_API_KEY=your_cmc_api_key_here

# Backup APIs
CRYPTOCOMPARE_API_KEY=your_cc_api_key_here
COINGECKO_API_KEY=your_cg_api_key_here  # Optional (free tier works)

# Optional Enhancement APIs
MESSARI_API_KEY=dU1pV6WDoWTcRQclj1dyzeBsyqhJZ4aOEELg17qA4abCWUgO
ALPHA_VANTAGE_API_KEY=DG0X2ZOMG0TPKNFP
```

### Adding Secrets to Supabase

**Option 1: Via Supabase Dashboard**
1. Go to Project Settings > Edge Functions
2. Add each secret:
   ```
   supabase secrets set COINMARKETCAP_API_KEY=your_key_here
   supabase secrets set CRYPTOCOMPARE_API_KEY=your_key_here
   supabase secrets set COINGECKO_API_KEY=your_key_here
   ```

**Option 2: Via .env file (Local Development)**
Create a `.env` file in `supabase/functions/`:
```env
COINMARKETCAP_API_KEY=your_key_here
CRYPTOCOMPARE_API_KEY=your_key_here
COINGECKO_API_KEY=your_key_here
```

---

## Deployment

### 1. Deploy Edge Functions

```bash
# Deploy the main correlation calculator
supabase functions deploy calculate-correlations

# Deploy the cron trigger
supabase functions deploy correlation-cron

# Update existing market-correlation function
supabase functions deploy market-correlation
```

### 2. Set Up Cron Job (Automated Daily Updates)

The correlation-cron function should run daily. Configure in Supabase Dashboard:

1. Go to Database > Cron Jobs (pg_cron extension)
2. Create new cron job:

```sql
-- Run correlation calculation daily at 2 AM UTC
SELECT cron.schedule(
  'daily-correlation-update',
  '0 2 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://your-project.supabase.co/functions/v1/correlation-cron',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
    ) as request_id;
  $$
);
```

Replace:
- `your-project` with your Supabase project ref
- `YOUR_ANON_KEY` with your anon key

---

## API Endpoints

### 1. Get Correlations (Frontend)

```javascript
GET /functions/v1/market-correlation?action=get
```

Returns:
```json
{
  "correlations": [
    {
      "base_asset": "BTC",
      "correlated_asset": "ETH",
      "correlation_coefficient": 0.85,
      "strength": "STRONG",
      "direction": "POSITIVE",
      "timeframe": "1d",
      "period_days": 30
    }
  ],
  "snapshot": {
    "btc_dominance": 52.5,
    "market_sentiment": "BULLISH",
    "top_correlations": [...]
  }
}
```

### 2. Calculate Correlations (Manual Trigger)

```javascript
POST /functions/v1/market-correlation?action=calculate
```

This triggers the full calculation process via the calculate-correlations function.

### 3. Direct Correlation Calculation

```javascript
POST /functions/v1/calculate-correlations?days=30&timeframe=1d&coins=BTC,ETH,SOL
```

Parameters:
- `days` - Historical period (default: 30)
- `timeframe` - Data granularity: 1h, 4h, 1d, 1w (default: 1d)
- `coins` - Comma-separated list (default: top 20 coins)

---

## How It Works

### API Fallback Chain

1. **Try CoinMarketCap** (Primary - Paid Tier)
   - Best data quality and coverage
   - Historical quotes with volume and market cap
   - Higher rate limits

2. **Try CryptoCompare** (Backup)
   - Good historical data
   - Daily OHLCV data
   - Reliable fallback

3. **Try CoinGecko** (Tertiary)
   - Free tier friendly
   - Wide coin coverage
   - Last resort option

### Correlation Calculation

Uses Pearson correlation coefficient:

```
r = Σ((x - x̄)(y - ȳ)) / √(Σ(x - x̄)² * Σ(y - ȳ)²)
```

**Strength Classification:**
- STRONG: |r| >= 0.7
- MODERATE: 0.4 <= |r| < 0.7
- WEAK: |r| < 0.4

**Direction:**
- POSITIVE: r >= 0 (assets move together)
- NEGATIVE: r < 0 (assets move opposite)

### Data Flow

```
┌─────────────────┐
│  Cron Trigger   │ (Daily at 2 AM)
│  correlation-   │
│     cron        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  calculate-     │
│  correlations   │
└────────┬────────┘
         │
         ├──► Fetch Prices (CoinMarketCap/CryptoCompare/CoinGecko)
         │
         ├──► Calculate Correlations (Pearson)
         │
         ├──► Store in market_correlations table
         │
         └──► Create snapshot in correlation_snapshots
```

---

## Usage in Frontend

The MarketCorrelation component automatically:
1. Fetches correlations on load
2. Displays correlation matrix
3. Shows market sentiment and BTC dominance
4. Provides manual recalculate button

```javascript
// Component already integrated in Insights page
import MarketCorrelation from '../components/MarketCorrelation'

// Usage
<MarketCorrelation />
```

---

## Testing

### 1. Manual Test

```bash
# Test correlation calculation
curl -X POST "https://your-project.supabase.co/functions/v1/calculate-correlations?days=7&timeframe=1d&coins=BTC,ETH,SOL" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### 2. Check Database

```sql
-- View recent correlations
SELECT * FROM market_correlations
ORDER BY updated_at DESC
LIMIT 20;

-- View latest snapshot
SELECT * FROM correlation_snapshots
ORDER BY snapshot_date DESC
LIMIT 1;
```

### 3. Frontend Test

1. Navigate to Insights page
2. Scroll to Market Correlation Analysis
3. Click "Recalculate" button
4. Wait 30-60 seconds
5. Correlation matrix should populate

---

## Monitoring

### Check Function Logs

```bash
# View correlation calculation logs
supabase functions logs calculate-correlations

# View cron execution logs
supabase functions logs correlation-cron
```

### Database Monitoring

```sql
-- Count correlations by timeframe
SELECT timeframe, COUNT(*) as count
FROM market_correlations
GROUP BY timeframe;

-- Check update frequency
SELECT
  DATE(updated_at) as date,
  COUNT(*) as correlations_updated
FROM market_correlations
GROUP BY DATE(updated_at)
ORDER BY date DESC
LIMIT 7;

-- View market sentiment history
SELECT
  DATE(snapshot_date) as date,
  market_sentiment,
  btc_dominance
FROM correlation_snapshots
ORDER BY snapshot_date DESC
LIMIT 30;
```

---

## Rate Limits & Costs

### API Limits

**CoinMarketCap (Paid Tier):**
- Varies by plan
- Typically: 10,000+ calls/day
- Historical data included

**CryptoCompare:**
- Free: 100,000 calls/month = ~3,300/day
- More than sufficient for daily updates

**CoinGecko:**
- Free: 50 calls/minute
- Backup usage only

### Optimization

The system is optimized for cost-efficiency:

1. **Rate Limiting**: 250ms delay between API calls
2. **Caching**: Results stored in database
3. **Daily Updates**: Single calculation per day
4. **Smart Fallback**: Uses cheaper APIs when possible
5. **Batch Processing**: Calculates all pairs in one run

**Estimated Daily Costs:**
- 20 coins = 190 correlation pairs
- 20 API calls for price data
- Well within free tier limits

---

## Troubleshooting

### Issue: No correlations calculated

**Check:**
1. API keys are set correctly
2. Edge functions deployed
3. Check function logs for errors

```bash
supabase functions logs calculate-correlations
```

### Issue: CoinMarketCap failing

**Solution:**
- System will automatically fall back to CryptoCompare
- Check CMC API key and subscription status
- Verify CMC endpoint is correct

### Issue: Correlations outdated

**Check cron job:**
```sql
SELECT * FROM cron.job WHERE jobname = 'daily-correlation-update';
```

**Manually trigger:**
```bash
curl -X POST "https://your-project.supabase.co/functions/v1/correlation-cron" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### Issue: Insufficient data

**Cause:** Not enough overlapping price points

**Solution:**
- Increase `days` parameter (try 60 or 90)
- Check if coin is supported by APIs
- Verify coin symbol mapping in price-data-service.ts

---

## Advanced Configuration

### Add More Coins

Edit `supabase/functions/calculate-correlations/index.ts`:

```typescript
const TOP_COINS = [
  'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', // ... add more
  'YOUR_NEW_COIN'
];
```

And add mapping in `price-data-service.ts`:

```typescript
private symbolMappings = {
  'YOUR_COIN': { cmc: 'SYMBOL', cg: 'coin-id', cc: 'SYMBOL' }
};
```

### Adjust Calculation Frequency

Change cron schedule:

```sql
-- Twice daily (2 AM and 2 PM)
SELECT cron.schedule(
  'daily-correlation-update',
  '0 2,14 * * *',  -- Changed from '0 2 * * *'
  $$ ... $$
);
```

### Custom Timeframes

Calculate different periods simultaneously:

```bash
# Calculate 7-day, 30-day, and 90-day correlations
curl -X POST ".../calculate-correlations?days=7&timeframe=1d"
curl -X POST ".../calculate-correlations?days=30&timeframe=1d"
curl -X POST ".../calculate-correlations?days=90&timeframe=1w"
```

---

## Support & Resources

- **CoinMarketCap API Docs**: https://coinmarketcap.com/api/documentation/v1/
- **CryptoCompare API Docs**: https://min-api.cryptocompare.com/documentation
- **CoinGecko API Docs**: https://www.coingecko.com/api/documentation
- **Supabase Edge Functions**: https://supabase.com/docs/guides/functions
- **Supabase Cron Jobs**: https://supabase.com/docs/guides/database/extensions/pg_cron

---

## Summary

✅ **Implemented:**
- Multi-API price data service with intelligent fallback
- Pearson correlation calculation
- Automated daily updates via cron
- Database storage and querying
- Frontend integration

✅ **Ready to Use:**
- Deploy edge functions
- Add API keys
- Set up cron job
- Start calculating correlations

The system is production-ready and optimized for reliability and cost-efficiency.
