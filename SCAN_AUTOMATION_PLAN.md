# Scan Automation Plan - Analysis & Implementation Strategy

## Current Scan Architecture Analysis

### How Scans Currently Work

**All scans use the SAME scan engine** (`scan-run` edge function) but with different parameters:

1. **scan-run/index.ts** - Main scan engine
   - Analyzes coins using ALL 83 bots
   - Uses `botFilter` parameter to focus results
   - Uses `regimeFilter` parameter to filter by market conditions
   - Uses `confidenceThreshold` to gate results

2. **Key Parameters**:
   - `scanType`: Identifier (e.g., 'whale_activity')
   - `coinLimit`: How many coins to analyze
   - `confidenceThreshold`: Minimum confidence to include
   - `botFilter`: Array of specific bot names to highlight
   - `regimeFilter`: 'trending', 'ranging', 'volatile', etc.

### Current Scan Types

**Base Scans** (manually triggered):
1. Quick Scan
2. Oracle Scan (Ultimate)
3. Deep Analysis
4. Top 200 Scan
5. Top 500 Scan
6. High Conviction
7. AI-Powered Full Scan
8. Low Cap Gems
9. Custom Scan

**Specialized Scans** (currently manual, need automation):
1. Whale Activity
2. Options Flow (NOT in scanTypes.js - missing!)
3. Trending Markets
4. Futures Signals
5. Elliott Wave Scan
6. Volatile Markets
7. Breakout Hunter
8. Reversal Opportunities

---

## ⚠️ IMPORTANT DISCOVERY

**Options Flow is NOT a separate scan type!**
- It's data fetched DURING scans via `options-data-service.ts`
- Used by "Options Flow Detector" bot
- No separate scan needed - it runs automatically

---

## Current Behavior

### What Happens When You Run a Scan

**Example: Running "Quick Scan"**
```javascript
{
  scanType: 'quick_scan',
  coinLimit: 100,
  confidenceThreshold: 0.7,
  // NO botFilter - uses ALL 83 bots
  // NO regimeFilter - analyzes all market conditions
}
```

**Example: Running "Whale Activity Scan"**
```javascript
{
  scanType: 'whale_activity',
  coinLimit: 200,
  confidenceThreshold: 0.65,
  botFilter: ['Whale Activity Tracker', 'Order Flow Analysis', 'Volume Spike', 'OBV'],
  // Results EMPHASIZE these 4 bots but ALL 83 bots still run
}
```

### Key Insight
**ALL 83 bots ALWAYS run on EVERY scan!**
- `botFilter` doesn't disable bots
- `botFilter` highlights specific bot results
- `regimeFilter` filters coins by market regime

---

## What You're Asking For

### Requirement 1: Auto-Run with Every Manual Scan
**"When I run Quick Scan, also run Whale Activity, Trending Markets, etc."**

**Problem**: This would mean:
- Quick Scan analyzes 100 coins × 83 bots
- THEN Whale Activity analyzes 200 coins × 83 bots
- THEN Trending Markets analyzes 200 coins × 83 bots
- etc.

**Total**: 7-8 scans running sequentially = 20-30 minutes!

### Requirement 2: Automated Intervals
**"Run these scans automatically every X hours"**

This makes more sense! Examples:
- Whale Activity: Every 6 hours
- Trending Markets: Every 4 hours
- Futures Signals: Every 2 hours

---

## Recommended Solution

### Option A: Smart Unified Scanning (RECOMMENDED) ⭐

**Change how scans work fundamentally:**

Instead of running separate scans, create ONE comprehensive scan that:
1. Analyzes all coins once with all 83 bots
2. Stores ALL bot predictions
3. Frontend filters/displays based on "view mode"

**Benefits**:
- ✅ Run one scan = get ALL insights
- ✅ Much faster (2-5 minutes vs 20-30 minutes)
- ✅ Less API costs
- ✅ All data always fresh

**Implementation**:
```javascript
// When user clicks "Quick Scan"
POST /scan-run
{
  scanType: 'comprehensive',
  coinLimit: 200,
  confidenceThreshold: 0.60,
  // NO filters - store everything
}

// Frontend shows different "views":
- Dashboard: Show high confidence (0.70+)
- Whale Activity View: Filter by whale bots
- Trending Markets View: Filter by trend bots + trending regime
- Futures Signals View: Filter by derivatives bots
```

**Pages Update**:
```javascript
// Insights page becomes filter selector
<select onChange={filterView}>
  <option>All Signals</option>
  <option>Whale Activity</option>
  <option>Trending Markets</option>
  <option>Futures Signals</option>
  <option>Breakout Opportunities</option>
  <option>Elliott Wave Patterns</option>
  <option>Reversal Setups</option>
  <option>Volatile Markets</option>
</select>
```

---

### Option B: Sequential Automated Scans

**Run multiple scans in sequence:**

**Pros**:
- Keeps current architecture
- Each scan type separate

**Cons**:
- ❌ 20-30 minutes total
- ❌ High API costs (multiple scans)
- ❌ Complex scheduling
- ❌ Risk of timeouts

**Implementation**:
```javascript
// When user clicks "Quick Scan"
1. Run Quick Scan (2-3 min)
2. Wait for completion
3. Run Whale Activity (2-3 min)
4. Run Trending Markets (2-3 min)
5. Run Futures Signals (2-3 min)
6. Run Breakout Hunter (2-3 min)
7. Run Elliott Wave (2-3 min)
8. Run Reversal Opportunities (2-3 min)
9. Run Volatile Markets (2-3 min)

Total: 16-24 minutes
```

---

### Option C: Parallel Automated Scans

**Run scans in parallel:**

**Pros**:
- Faster than sequential
- All complete in ~5 minutes

**Cons**:
- ❌ VERY high API costs (8x the API calls)
- ❌ Rate limiting issues
- ❌ Database write conflicts

---

### Option D: Scheduled Background Scans (Hybrid)

**Combine automation with scheduling:**

**Manual Scans** (user triggered):
- Quick Scan
- Oracle Scan
- Deep Analysis
- AI-Powered Scan
- Custom Scan

**Automated Background Scans** (cron jobs):
```
Every 4 hours: Comprehensive Market Scan
  - Stores: ALL bot predictions
  - Analyzes: Top 200 coins
  - Duration: 3-4 minutes

Frontend filters by "view type"
```

**Benefits**:
- ✅ Data always fresh (every 4 hours)
- ✅ User gets instant results (no waiting)
- ✅ Reasonable API costs
- ✅ Simple architecture

---

## My Recommendation: Option A + D Hybrid

### Architecture Change

**1. Backend (scan-run)**
- Remove `botFilter` concept
- Store ALL 83 bot predictions always
- Add `scan_view_type` column to recommendations

**2. Automated Scanning**
```sql
-- Cron job runs every 4 hours
INSERT INTO cron.job (schedule, command)
VALUES (
  '0 */4 * * *',
  'SELECT net.http_post(...) -- Triggers scan-run'
);
```

**3. Frontend Filtering**
```javascript
// Insights page
const [viewMode, setViewMode] = useState('all')

// Filter recommendations by view
const filteredRecs = useMemo(() => {
  if (viewMode === 'whale_activity') {
    return recs.filter(r =>
      r.bot_predictions.some(p =>
        WHALE_BOTS.includes(p.bot_name)
      )
    )
  }
  // etc...
}, [recs, viewMode])
```

**4. Dashboard Changes**
```javascript
// Remove individual scan type buttons
// Replace with:
<button onClick={runComprehensiveScan}>
  Run Market Scan (All 83 Bots)
</button>

// Add view selector
<select onChange={setView}>
  <option>All Insights</option>
  <option>Whale Activity</option>
  <option>Trending Momentum</option>
  <option>Futures & Derivatives</option>
  <option>Breakout Setups</option>
  <option>Reversal Patterns</option>
  <option>Volatile Opportunities</option>
  <option>Elliott Wave Analysis</option>
</select>
```

---

## Implementation Steps

### Phase 1: Data Collection (No UI Changes)
1. Modify scan-run to ALWAYS store all bot predictions
2. Don't change frontend at all
3. Test that all 83 bots' data is saved

### Phase 2: Add Filtering
1. Create filter utility functions
2. Update Insights page with view selector
3. Filter displayed results by view type

### Phase 3: Automate Background
1. Create cron job for 4-hour scans
2. Auto-scan runs comprehensive analysis
3. Users see fresh data always

### Phase 4: Dashboard Simplification
1. Remove individual scan buttons
2. Add "Run Comprehensive Scan" button
3. Add view selector dropdown

---

## Questions to Clarify

1. **Do you want scans to run EVERY TIME you click a button?**
   - If yes, Option B (sequential) or C (parallel)
   - If no, Option A/D (background + filtering)

2. **Do you want 20-30 minute wait times?**
   - If no, Option A/D is better

3. **Are you OK with view-based filtering instead of separate scans?**
   - If yes, Option A/D is much better
   - If no, Option B/C required

4. **What interval for automation?**
   - Every 2 hours? (12 scans/day)
   - Every 4 hours? (6 scans/day)
   - Every 6 hours? (4 scans/day)

---

## Recommendation Summary

**I recommend Option A + D: Smart Unified + Background Automation**

**Why**:
- ✅ Fast (2-5 minutes)
- ✅ Cost effective (1 scan vs 8 scans)
- ✅ Always fresh data
- ✅ Better UX
- ✅ Simpler architecture
- ✅ All 83 bots used efficiently

**Implementation Time**: 1-2 hours

**User Experience**:
- Click "Run Market Scan" = 2-5 minutes
- View results filtered by category
- Background scan every 4 hours keeps data fresh
- Charts, Insights, Analytics all use same data

---

## What to Keep

**Current Features** (don't change):
- All 83 bots
- Hybrid aggregation engine
- ML ensemble weighting
- Options flow analysis (automatic)
- Regime detection
- Multi-timeframe analysis

**New Features** (add):
- View-based filtering
- Background automation
- Real-time data freshness indicator

---

## Cost Comparison

**Current** (if running all manually):
- 8 scans × 200 coins × API calls = High cost

**Option A/D**:
- 1 scan × 200 coins × API calls × 6/day = Much lower

**Savings**: ~85% reduction in API costs

---

## Next Steps

Please confirm:
1. Do you want Option A/D (unified + background)?
2. Or do you want Option B (sequential separate scans)?
3. What automation interval? (2hr, 4hr, 6hr?)

Once confirmed, I'll implement immediately!
