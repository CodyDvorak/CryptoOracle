# AI Coding Assistant Prompt - Crypto Oracle Project

## Context

You are reviewing and helping to improve the **Crypto Oracle** application - an AI-powered cryptocurrency trading recommendation system. This prompt provides you with complete context to understand the codebase, identify bugs, and implement new features.

---

## Project Overview

**Application Name**: Crypto Oracle  
**Type**: Full-stack web application (FastAPI + React + MongoDB)  
**Purpose**: Generate AI-powered crypto trading recommendations using 54 specialized trading bots

**Core Functionality**:
- Analyzes 100+ cryptocurrencies using 54 different trading strategies
- Provides directional recommendations (long/short) with confidence scores (1-10)
- Tracks bot performance across different market regimes
- Multi-timeframe analysis (daily + 4-hour candles)
- Resilient multi-provider data fetching with automatic fallback

---

## Technology Stack

**Backend**:
- Python 3.11
- FastAPI (async web framework)
- MongoDB with Motor (async driver)
- Pydantic for data validation
- aiohttp for async HTTP requests

**Frontend**:
- React 18
- Axios for API communication
- React Router for navigation
- Tailwind CSS for styling

**Database**:
- MongoDB 5.0+
- Database name: `crypto_oracle`
- Collections: users, scan_runs, recommendations, bot_predictions, bot_results, bot_performance

**External APIs**:
- CoinMarketCap (OHLCV data - primary)
- CoinGecko (OHLCV data - backup)
- CryptoCompare (OHLCV data - tertiary)
- OKX (futures data - primary)
- Coinalyze (futures data - backup)

---

## Key Architecture Patterns

### 1. Multi-Provider Fallback Pattern

**Location**: `/app/backend/services/multi_provider_client.py`

**How it works**:
```python
async def get_historical_data(symbol):
    providers = [primary, backup, tertiary]
    for provider in providers:
        try:
            data = await provider.fetch(symbol)
            if data:
                return data
        except RateLimitError:
            continue  # Try next provider
    return []  # All providers failed
```

**Critical**: Always try all providers before returning empty data.

### 2. Async Non-Blocking Scans

**Location**: `/app/backend/services/scan_orchestrator.py`

**Pattern**:
```python
for bot in bots:
    if count % 5 == 0:
        await asyncio.sleep(0)  # Yield to event loop
    result = bot.analyze(features)
```

**Critical**: The `asyncio.sleep(0)` is ESSENTIAL to prevent event loop blocking during long scans.

### 3. Market Regime Classification

**Location**: `/app/backend/services/market_regime_classifier.py`

**How it works**:
- Analyzes 30-day price momentum, volatility, volume
- Classifies as: BULL_MARKET, BEAR_MARKET, SIDEWAYS, HIGH_VOLATILITY
- Returns confidence score (0-1.0)
- Used to weight bot predictions (e.g., trend bots get 1.3x in bull markets)

### 4. Bot Strategy Pattern

**Location**: `/app/backend/bots/bot_strategies.py`

**Base class**:
```python
class BotStrategy:
    def __init__(self, name, bot_type='default'):
        self.name = name
        self.bot_type = bot_type  # 'trend', 'contrarian', 'momentum', etc.
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        # Return: {direction, entry, take_profit, stop_loss, confidence, rationale}
        pass
```

**Critical Rules**:
- Confidence MUST be an integer (1-10)
- All prices must be floats
- Return None if no signal
- Check for NaN/Infinity before returning

---

## Database Schema

### bot_predictions Collection

**Purpose**: Store individual bot predictions for performance tracking

**Schema**:
```python
{
    "id": "uuid",
    "run_id": "scan_run_id",
    "user_id": "user_id",
    "bot_name": "SMA_CrossBot",
    "coin_symbol": "BTC",  # NOT "ticker"
    "coin_name": "Bitcoin",
    "entry_price": 50000.0,
    "target_price": 55000.0,
    "stop_loss": 48000.0,
    "position_direction": "long",  # NOT "direction"
    "confidence_score": 8,  # NOT "confidence" - INTEGER
    "leverage": 5.0,
    "timestamp": datetime,
    "market_regime": "bull_market",
    "outcome_status": "pending",  # pending, win, loss, partial_win
    "outcome_checked_at": None,
    "outcome_price": None,
    "profit_loss_percent": None
}
```

**CRITICAL FIELD NAMES**:
- Use `coin_symbol` NOT `ticker`
- Use `position_direction` NOT `direction`  
- Use `confidence_score` NOT `confidence`
- Use `target_price` NOT `take_profit`

### recommendations Collection

**Schema**:
```python
{
    "id": "uuid",
    "run_id": "scan_run_id",
    "user_id": "user_id",
    "ticker": "BTC",
    "coin": "Bitcoin",
    "current_price": 50000.0,
    "consensus_direction": "long",
    "avg_confidence": 7.5,
    "bot_count": 52,  # How many bots analyzed
    "long_bots": 45,
    "short_bots": 7,
    "long_weight": 8.2,
    "short_weight": 4.1,
    "rationale": "Strong uptrend...",
    "predicted_24h": 52000.0,
    "predicted_48h": 53000.0,
    "predicted_7d": 55000.0,
    "market_regime": "BULL",
    "regime_confidence": 0.85,
    "timestamp": datetime
}
```

---

## Common Issues & How to Fix

### Issue 1: Bot predictions not saving to database

**Symptoms**:
- Logs show "Saved X predictions" but database is empty
- Bot details API returns 0 results

**Root Causes**:
1. **Field name mismatch**: Querying `confidence` but database has `confidence_score`
2. **Validation error**: Confidence is float but model expects int
3. **Wrong database**: Saving to `test_database` instead of `crypto_oracle`

**How to fix**:
```python
# CORRECT field mapping in API endpoints
bot_predictions.find({
    'coin_symbol': ticker  # NOT 'ticker'
})

# CORRECT when creating BotPrediction
prediction = BotPrediction(
    confidence_score=int(round(confidence)),  # Convert to int!
    position_direction=direction,  # NOT 'direction'
    target_price=take_profit  # NOT 'take_profit'
)
```

**Check database name**:
```python
# In server.py
db = client[os.environ.get('DB_NAME', 'crypto_oracle')]

# In .env file
DB_NAME=crypto_oracle  # NOT test_database
```

### Issue 2: Scans complete with 0 coins analyzed

**Root Cause**: Missing `return` statement in indicator_engine.py

**How to fix**:
```python
def compute_all_indicators(historical_data, derivatives_data):
    # ... compute indicators ...
    features['rsi'] = rsi
    features['macd'] = macd
    # ... more features ...
    
    return features  # MUST HAVE THIS!
```

### Issue 3: Bot confidence validation errors

**Symptoms**: Logs show `1 validation error for BotResult: confidence Input should be a valid integer`

**Root Cause**: Confidence becomes float after regime/timeframe modifiers

**How to fix**:
```python
# After applying modifiers
final_confidence = original_confidence * regime_weight * timeframe_modifier
final_confidence = min(10, max(1, final_confidence))

# CONVERT TO INT before creating BotResult
confidence_int = int(round(final_confidence))

bot_result = BotResult(
    confidence=confidence_int  # Use integer
)
```

### Issue 4: Frontend shows "uncaught runtime error"

**Possible Causes**:
1. API returns NaN/Infinity (not valid JSON)
2. Null values not handled properly
3. Missing error boundaries

**How to fix**:
```python
# Backend: Sanitize before returning
def sanitize_for_json(data):
    if isinstance(data, dict):
        return {k: sanitize_for_json(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [sanitize_for_json(v) for v in data]
    elif isinstance(data, float):
        if math.isnan(data) or math.isinf(data):
            return None
    return data

return sanitize_for_json(response_data)
```

```javascript
// Frontend: Handle null values
{performances.map(perf => (
    <div>
        Accuracy: {perf.accuracy_rate ?? 'N/A'}%
    </div>
))}
```

---

## Critical Code Locations

### Backend

**Scan Orchestration**:
- `/app/backend/services/scan_orchestrator.py` - Main scan logic (lines 200-500)
- Method: `run_smart_scan()`, `_analyze_coin_with_cryptocompare()`

**Bot Strategies**:
- `/app/backend/bots/bot_strategies.py` - All 54 bot implementations
- Base class at line 1-50
- Individual bots: SMA_CrossBot (line 200), MACD_Bot (line 230), etc.

**Data Providers**:
- `/app/backend/services/multi_provider_client.py` - OHLCV fallback logic
- `/app/backend/services/multi_futures_client.py` - Futures fallback logic
- `/app/backend/services/coinmarketcap_client.py` - CMC API wrapper
- `/app/backend/services/coingecko_client.py` - CoinGecko API wrapper
- `/app/backend/services/cryptocompare_client.py` - CryptoCompare API wrapper

**Indicator Computation**:
- `/app/backend/services/indicator_engine.py` - Technical indicator calculations
- Methods: `compute_all_indicators()`, `compute_4h_indicators()`

**Market Regime**:
- `/app/backend/services/market_regime_classifier.py` - Regime detection
- Method: `classify_regime()`

**Bot Performance**:
- `/app/backend/services/bot_performance_service.py` - Performance tracking
- Methods: `save_bot_predictions()`, `evaluate_predictions()`

**API Endpoints**:
- `/app/backend/server.py` - All REST API endpoints
- Key endpoints: `/api/scan/quick`, `/api/recommendations/top5`, `/api/bots/performance`

### Frontend

**Dashboard**:
- `/app/frontend/src/App.js` - Main app component
- `/app/frontend/src/components/BotPerformanceDashboard.js` - Analytics UI

**Components**:
- `/app/frontend/src/components/DashboardComponents.js` - Recommendation cards
- `/app/frontend/src/components/BotDetailsModal.js` - Bot breakdown modal

---

## Environment Configuration

**CRITICAL**: Never modify these in .env:
- `MONGO_URL` (production configured)
- `REACT_APP_BACKEND_URL` (production configured)

**Required API Keys**:
```bash
COINMARKETCAP_API_KEY=2bd6bec9-9bf0-4907-9c67-f8d5f43e3b2d
COINALYZE_API_KEY=2e6860e7-7659-4bd2-9f14-fe3f3cb53b60
```

**Database**:
```bash
DB_NAME=crypto_oracle  # MUST be crypto_oracle, NOT test_database
```

**Providers**:
```bash
PRIMARY_PROVIDER=coinmarketcap
BACKUP_PROVIDER=coingecko
```

---

## Testing & Debugging

### Backend Testing
```bash
# Check backend logs
tail -f /var/log/supervisor/backend.err.log

# Test API endpoint
curl http://localhost:8001/api/bots/status

# Check database
mongosh crypto_oracle --eval "db.bot_predictions.countDocuments({})"

# Restart backend
sudo supervisorctl restart backend
```

### Frontend Testing
```bash
# Check frontend logs
tail -f /var/log/supervisor/frontend.err.log

# Restart frontend
sudo supervisorctl restart frontend
```

### Database Inspection
```bash
# Count documents
mongosh crypto_oracle --eval "db.recommendations.countDocuments({})"

# Find sample prediction
mongosh crypto_oracle --eval "db.bot_predictions.findOne()"

# Check field names
mongosh crypto_oracle --eval "db.bot_predictions.findOne({}, {coin_symbol: 1, confidence_score: 1, position_direction: 1})"
```

---

## Pending Implementation (Your Tasks)

### Phase 2: Hybrid Bot Aggregation System

**Task 1: Confidence Gating**
- Filter predictions with confidence < 6 before aggregation
- Location: `/app/backend/services/aggregation_engine.py`
- Method: `aggregate_coin_results()`

```python
def aggregate_coin_results(coin_name, bot_results, current_price):
    # ADD THIS: Filter low-confidence predictions
    high_confidence_results = [r for r in bot_results if r.get('confidence', 0) >= 6]
    
    # Continue with aggregation using high_confidence_results
    ...
```

**Task 2: Strong Consensus Tier**
- If 80%+ bots agree, boost confidence by 20%
- Location: `/app/backend/services/aggregation_engine.py`

```python
if consensus_percent >= 80:
    final_confidence *= 1.2
    final_confidence = min(10, final_confidence)
    metadata['consensus_boost_applied'] = True
```

**Task 3: Contrarian Agreement Amplification**
- If 3+ contrarian bots agree with trend, boost by 50%
- Location: `/app/backend/services/aggregation_engine.py`

```python
contrarian_bots = ['RSI_ReversalBot', 'VolumeSpikeFadeBot', 'BollingerReversalBot', 'StochasticReversalBot']
contrarian_agreements = [r for r in bot_results if r['bot_name'] in contrarian_bots and r['direction'] == consensus_direction]

if len(contrarian_agreements) >= 3:
    final_confidence *= 1.5
    final_confidence = min(10, final_confidence)
```

**Task 4: Add New Specialized Bots**
- Create 3-5 new bot strategies
- Examples: Elliott Wave Bot, Order Flow Bot, Whale Tracker Bot
- Location: `/app/backend/bots/bot_strategies.py`

**Template**:
```python
class ElliottWaveBot(BotStrategy):
    def __init__(self):
        super().__init__("ElliottWaveBot", bot_type='pattern')
    
    def analyze(self, features: Dict) -> Optional[Dict]:
        # Implement Elliott Wave pattern recognition
        # Return: direction, entry, take_profit, stop_loss, confidence (INT!), rationale
        pass
```

**Task 5: Fine-Tune Regime Weight Multipliers**
- Test and optimize current multipliers
- Location: `/app/backend/services/market_regime_classifier.py`
- Method: `get_bot_weight_modifier()`

Current weights:
```python
'BULL_MARKET': {'trend': 1.3, 'contrarian': 0.8, ...}
'BEAR_MARKET': {'trend': 0.8, 'contrarian': 1.2, ...}
```

Optimize based on backtest results.

---

## Bug Hunting Checklist

When reviewing code, check for:

### Data Type Issues
- [ ] All confidence values converted to int before Pydantic models
- [ ] No NaN or Infinity in JSON responses
- [ ] Proper type hints on all functions

### Field Name Consistency
- [ ] Database queries use `coin_symbol`, `confidence_score`, `position_direction`
- [ ] No hardcoded field names - use constants
- [ ] API responses map fields correctly

### Error Handling
- [ ] All API calls wrapped in try/except
- [ ] Fallback providers tried on failure
- [ ] Errors logged with context (coin symbol, provider name)
- [ ] User-friendly error messages

### Async/Await
- [ ] All async functions use `await` on async calls
- [ ] `asyncio.sleep(0)` in long loops
- [ ] No blocking operations in async functions

### Database Operations
- [ ] All MongoDB queries use correct database name (`crypto_oracle`)
- [ ] `_id` fields converted to strings before JSON serialization
- [ ] Datetime objects stored as ISO strings or datetime objects (not strings)

### Frontend
- [ ] Null/undefined checks before rendering
- [ ] Loading states for async operations
- [ ] Error boundaries for component crashes
- [ ] Proper cleanup in useEffect hooks

---

## Code Quality Standards

### Python
- Use type hints: `def analyze(self, features: Dict[str, float]) -> Optional[Dict]:`
- Use async/await for all I/O operations
- Log at appropriate levels: `logger.info()`, `logger.warning()`, `logger.error()`
- Keep functions under 50 lines when possible
- Use descriptive variable names

### React
- Use functional components with hooks
- Keep components under 300 lines
- Extract reusable logic into custom hooks
- Use proper PropTypes or TypeScript

### Database
- Never store NaN, Infinity, or circular references
- Use UUID strings for IDs, not MongoDB ObjectId
- Store datetimes consistently (ISO strings or datetime objects)
- Index frequently queried fields

---

## Performance Optimization

### Backend
- Use batch operations: `insert_many()` instead of loop of `insert_one()`
- Cache expensive calculations (technical indicators)
- Use database indexes on `run_id`, `coin_symbol`, `bot_name`
- Implement request rate limiting for external APIs

### Frontend
- Lazy load heavy components
- Debounce search/filter inputs
- Use React.memo for expensive renders
- Paginate large lists

---

## Questions to Ask When Reviewing Code

1. **Does this handle failures gracefully?**
   - What if the API returns empty data?
   - What if the database is unreachable?

2. **Is this async-safe?**
   - Does it block the event loop?
   - Are there race conditions?

3. **Are field names consistent?**
   - Database vs. API vs. frontend
   - Check Pydantic model definitions

4. **Will this scale?**
   - What if 1000 coins are analyzed?
   - What if 100 concurrent users?

5. **Is it testable?**
   - Can you mock external dependencies?
   - Are side effects isolated?

---

## Success Criteria

Your code changes are successful when:

1. **All existing features still work** (no regressions)
2. **New features pass acceptance tests**
3. **No console errors** in browser or backend logs
4. **Database writes verified** (check document counts)
5. **API responses are valid JSON** (no NaN/Infinity)
6. **Performance is acceptable** (scans complete in < 5 minutes)
7. **Code follows project patterns** (multi-provider fallback, async, etc.)

---

## Final Notes

**Remember**:
- Always restart services after .env changes
- Test with real scans, not just unit tests
- Check both backend logs AND database state
- When in doubt, follow existing patterns in the codebase

**Most Common Mistakes**:
1. Using wrong field names (confidence vs. confidence_score)
2. Forgetting to convert float to int for confidence
3. Not handling None/null values
4. Blocking the event loop in async functions
5. Saving to wrong database (test_database vs. crypto_oracle)

**Good Luck!** 🚀
