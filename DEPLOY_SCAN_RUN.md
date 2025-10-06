# Deploy scan-run Edge Function

## Critical Fixes Made

The `scan-run` edge function has been fixed with two critical changes:

### 1. Fixed Method Names (index.ts)
- **Line 31**: Changed `fetchTopCoins()` → `getTopCoins('all', minPrice, maxPrice)`
- **Line 66**: Changed `fetchOHLCV(coin.symbol)` → `getOHLCVData(coin.symbol)`

### 2. Fixed Consensus Scoring (aggregation-engine.ts)
Added proper consensus penalties to prevent artificially high confidence scores:
- **<50% consensus**: 30% penalty (multiply by 0.70)
- **50-59% consensus**: 15% penalty (multiply by 0.85)
- **60-69% consensus**: 5% penalty (multiply by 0.95)
- **70-79% consensus**: 8% boost (multiply by 1.08)
- **80%+ consensus**: 15% boost (multiply by 1.15)

This fixes the issue where XMR showed 99% confidence with only 45% bot consensus.

## How to Deploy

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **Edge Functions** → **scan-run**
3. Click **"Deploy new version"** or **"Create new function"**
4. Copy the contents of ALL files from `supabase/functions/scan-run/`:
   - index.ts (main entry)
   - aggregation-engine.ts (consensus logic)
   - crypto-data-service.ts (data fetching)
   - trading-bots.ts (bot strategies)
   - ai-refinement-service.ts
   - derivatives-data-service.ts
   - multi-timeframe-analyzer.ts
   - onchain-data-service.ts
   - options-data-service.ts
   - social-sentiment-service.ts
   - tokenmetrics-service.ts

### Option 2: Using Supabase CLI

```bash
cd /path/to/project
supabase functions deploy scan-run
```

## Files to Deploy

All 11 TypeScript files in `supabase/functions/scan-run/`:

```
supabase/functions/scan-run/
├── index.ts (8,119 bytes) - Main handler
├── aggregation-engine.ts (12,035 bytes) - Fixed consensus logic
├── crypto-data-service.ts (23,384 bytes) - Data fetching
├── trading-bots.ts (97,532 bytes) - Bot strategies
├── ai-refinement-service.ts (15,304 bytes)
├── derivatives-data-service.ts (9,954 bytes)
├── multi-timeframe-analyzer.ts (4,873 bytes)
├── onchain-data-service.ts (17,187 bytes)
├── options-data-service.ts (15,196 bytes)
├── social-sentiment-service.ts (12,706 bytes)
└── tokenmetrics-service.ts (4,622 bytes)
```

**Total Size**: ~220KB

## Expected Results After Deployment

✅ Scans will start successfully
✅ Proper consensus-based confidence scores
✅ XMR-type issues (low consensus → high confidence) will be fixed
✅ Recommendations will show realistic confidence based on bot agreement

## Verification

After deployment, run a test scan and verify:
1. Scan starts without errors
2. Recommendations show varied confidence scores (not all 90%+)
3. Low consensus coins (e.g., 9 LONG vs 11 SHORT) show ~50-60% confidence
4. High consensus coins (e.g., 18 LONG vs 2 SHORT) show ~80-90% confidence
