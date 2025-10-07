# How to Use the New Enhancements

## Quick Start

All enhancements are **automatically active** - no configuration needed!

---

## 1. Rate Limiting (For Future API Integrations)

### When to Use
Adding a new external API? Wrap it with rate limiting:

```typescript
// In any edge function
import { createRateLimiter } from '../shared/rate-limiter.ts'

// Configure for your API's limits
const coinGeckoLimiter = createRateLimiter(10, 20) // 10 req/sec, burst 20

// Use it
const data = await coinGeckoLimiter(async () => {
  return fetch('https://api.coingecko.com/...')
})
```

### Real Examples

```typescript
// High-volume API (TokenMetrics)
const tokenMetricsLimiter = createRateLimiter(5, 10)

// Low-volume API (News)
const newsLimiter = createRateLimiter(1, 3)

// Burst-friendly API (Price data)
const priceLimiter = createRateLimiter(20, 50)
```

---

## 2. Viewing Bot Status Badges

### In the UI
1. Go to **Bot Performance** page
2. Each bot card now shows a colored badge:
   - 🟦 **New** - Less than 10 predictions
   - 🟢 **Active** - Performing well (≥60%)
   - 🟡 **Monitoring** - Borderline (40-60%)
   - 🔴 **Probation** - Underperforming (25-40%)
   - ⚫ **Retired** - Critical (<25%)

### What to Do

- **🟦 New bots**: Watch and wait
- **🟢 Active bots**: Trust their signals
- **🟡 Monitoring**: Review parameters
- **🔴 Probation**: Consider disabling
- **⚫ Retired**: Already disabled

---

## 3. Understanding Improved Confidence Scores

### What Changed

**Before:**
```
Bot says: 8/10 confidence
System uses: 8/10 directly
```

**After:**
```
Bot says: 8/10 confidence
System calibrates: 8/10 → 0.82 probability
Then checks disagreement:
- If bots agree: 0.82 * 1.0 = 0.82
- If bots split 50/50: 0.82 * 0.7 = 0.57
```

### Why It Matters

- **More accurate** predictions
- **Lower confidence** when bots disagree
- **Prevents** over-confident bad trades

### No Action Needed
This happens automatically in every scan!

---

## 4. Better TP/SL Targets

### What Improved

The system now:
1. **Removes outliers** (trimmed mean)
2. **Adapts to regime**:
   - Trending: Wider targets
   - Volatile: Tighter targets, wider stops
   - Ranging: Balanced
3. **Falls back to ATR** if bot data insufficient

### Example

**Trending Market (BTC pumping):**
```
Entry: $65,000
TP: $65,000 + (ATR $450 * 2.5) = $66,125
SL: $65,000 - (ATR $450 * 1.2) = $64,460
Risk/Reward: 1:2.5 ratio
```

**Volatile Market (High swings):**
```
Entry: $65,000
TP: $65,000 + (ATR $450 * 1.8) = $65,810
SL: $65,000 - (ATR $450 * 1.5) = $64,325
Risk/Reward: 1:1.2 ratio (safer)
```

### No Action Needed
Automatically applied to all scan results!

---

## 5. Monitoring System Health

### Check These Metrics

**Bot Performance Page:**
- How many bots in **probation**? (Should be < 10%)
- Average system accuracy? (Target: > 50%)
- Any bots need attention? (Red badges)

**Scan Results Page:**
- Confidence scores realistic? (Not all 9-10)
- TP/SL ratios reasonable? (1:1.5 to 1:3)
- Disagreement penalty working? (Lower confidence when bots split)

---

## Advanced: Tuning Parameters

### If You Want to Adjust

**Disagreement Penalty** (`aggregation-engine.ts`):
```typescript
// Current: Max 30% penalty
return 1.0 - (entropy * 0.3);

// More aggressive (40% penalty):
return 1.0 - (entropy * 0.4);

// Less aggressive (20% penalty):
return 1.0 - (entropy * 0.2);
```

**Platt Scaling** (`aggregation-engine.ts`):
```typescript
// Current
private plattA = 0.0;
private plattB = 0.9;

// After collecting data, you can recalibrate
// (Requires historical outcome analysis)
```

**TP/SL Multipliers** (`aggregation-engine.ts`):
```typescript
// Trending market
const atrMultiplier = 2.5 // Increase for wider targets
const stopMultiplier = 1.2 // Increase for wider stops

// Volatile market
const atrMultiplier = 1.8 // Adjust as needed
const stopMultiplier = 1.5
```

---

## Troubleshooting

### Issue: Too many bots in probation

**Solution:**
1. Check if market regime shifted
2. Consider retraining bot parameters
3. Use **Adaptive AI** panel to optimize

### Issue: Confidence scores too low

**Check:**
- Bot disagreement high? (Working as intended)
- Platt scaling too aggressive? (Adjust parameters)
- Not enough bot signals? (Need more active bots)

### Issue: TP/SL too tight/wide

**Adjust:**
```typescript
// In aggregation-engine.ts
const atrMultiplier = 2.5 // Increase = wider
const stopMultiplier = 1.2 // Increase = safer
```

---

## Best Practices

### Do This ✅

1. **Monitor probation bots** weekly
2. **Check disagreement** on major trades
3. **Review TP/SL ratios** across regimes
4. **Use rate limiting** for new APIs
5. **Trust the system** - it's self-correcting

### Don't Do This ❌

1. ~~Ignore probation badges~~
2. ~~Trade when confidence < 6/10~~
3. ~~Override TP/SL without reason~~
4. ~~Add APIs without rate limiting~~
5. ~~Disable all underperforming bots~~ (System does this automatically)

---

## Performance Expectations

### What to Expect

**Week 1:**
- Calibration settling in
- Some bots may drop to probation
- Confidence scores more conservative

**Week 2-4:**
- System learns optimal thresholds
- Probation badges stabilize
- Hit rates improve

**Month 2+:**
- Fully calibrated
- Consistent performance
- Auto-adaptation working

### Key Metrics

| Metric | Target | Warning |
|--------|--------|---------|
| System Accuracy | > 55% | < 45% |
| Probation Bots | < 15% | > 25% |
| Avg Confidence | 6.5-7.5 | < 6.0 or > 8.5 |
| TP Hit Rate | > 55% | < 45% |
| SL Hit Rate | < 30% | > 40% |

---

## Summary

### You Don't Need to Do Anything!

All enhancements work automatically:
- ✅ Confidence calibration: **Automatic**
- ✅ Disagreement penalty: **Automatic**
- ✅ TP/SL synthesis: **Automatic**
- ✅ Status badges: **Automatic**
- ✅ Rate limiting: **Ready when needed**

### Just Monitor

- Bot Performance page
- Probation badges
- Overall system accuracy

### The system is now smarter, safer, and self-aware! 🚀
