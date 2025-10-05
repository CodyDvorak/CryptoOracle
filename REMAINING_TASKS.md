# Remaining Implementation Tasks

## ✅ COMPLETED
1. Bot Performance filters (regime/timeframe/coin) - Code added
2. Custom Alerts Manager UI component - Created
3. Investigated 100% confidence - NOT A BUG (legitimate when all bots agree)

## 🚧 IN PROGRESS - NEED TO COMPLETE

### 1. Integrate Custom Alerts into Profile Page
- Import CustomAlertsManager component
- Add to Profile.jsx
- Pass user ID as prop

### 2. Add Filter UI to BotPerformance Page
- Add filter dropdowns for regime/timeframe/coin
- Wire up to existing filter state (already added)
- Style filter bar

### 3. Signal Performance Tracking Enhancements
Need to add separate component or section showing:
- Detailed signal outcome history table
- Signal vs actual price comparison charts (use Chart.js or similar)
- Time to target analysis
- Stop loss hit rate
- Take profit achievement rate

### 4. Advanced Backtesting UI
Need to add to BotPerformance page:
- Date range selector inputs (already in state)
- "Run Backtest" button (function exists)
- Results display section with:
  - Performance charts
  - Win/loss visualization
  - Historical trend graphs
- Toggle to show/hide backtest results

### 5. Market Correlation Analysis
Need to implement from scratch:
- Edge function implementation (currently empty stub)
- Database table for correlation data
- Frontend component to display correlations
- Integration into Dashboard or Insights page

### 6. Update BotPerformance CSS
- Add styles for new filters
- Add styles for backtesting section
- Add styles for signal tracking section

## 📊 PRIORITY ORDER

1. **HIGHEST**: Integrate Custom Alerts into Profile (5 min)
2. **HIGH**: Add filter UI to BotPerformance (10 min)
3. **HIGH**: Add backtesting UI to BotPerformance (20 min)
4. **MEDIUM**: Signal tracking enhancements (30 min)
5. **LOW**: Market Correlation (45 min - complex, least critical)

## 🎯 ESTIMATED TOTAL TIME
~2 hours for all remaining features

## ⚠️ CONFIDENCE BUG STATUS
NOT A BUG - 100% confidence is correct when:
- All bots agree on direction
- All bot confidences are high (>6/10)
- TokenMetrics confirms the direction
- This represents maximum conviction

The backend correctly caps at 1.0 (100%) using Math.min().
