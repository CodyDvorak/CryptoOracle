# Fix Bot Performance "Mock Data" Issue ✅

## Root Cause
**Your .env file has an expired JWT token** - that's why:
- Bot Performance page shows empty/mock-looking data
- Console shows 401 errors
- Scan won't stop running

## The Issue

### What's Happening:
1. ✅ **Edge function EXISTS** - `bot-performance` is deployed and active
2. ✅ **Code is CORRECT** - reads from `bot_predictions` table
3. ❌ **Token is EXPIRED** - can't authenticate to fetch data
4. ❌ **Frontend can't reach API** - gets 401 Unauthorized

Result: **Empty data array = looks like mock data**

---

## 🔧 The Fix (YOU MUST DO THIS)

I cannot access your Bolt dashboard - you need to get the key yourself:

### Step-by-Step:

#### 1. Login to Bolt.new
- Go to: https://bolt.new
- Login with your account

#### 2. Find Your Project
- Look for your Crypto Oracle project
- Or go directly to: https://bolt.new/~/0ec90b57d6e95fcbda19832f

#### 3. Get Fresh Anon Key
- Click **"Settings"** (bottom left sidebar)
- Click **"API"** tab
- Under **"Project API keys"** section
- Copy the **"anon"** or **"public"** key
  - Should be ~200 characters
  - Starts with `eyJhbGciOi...`
  - Should say "Never expires" or have far future date

#### 4. Update Your .env File
Open `/tmp/cc-agent/57997993/project/.env` and replace:

```bash
VITE_SUPABASE_URL=https://0ec90b57d6e95fcbda19832f.supabase.co
VITE_SUPABASE_ANON_KEY=<paste-your-new-key-here>
```

**Make sure:**
- No spaces before/after the key
- No quotes around the key
- Complete key copied (all ~200 characters)

#### 5. Restart Dev Server
```bash
# Stop current server (Ctrl+C or Cmd+C)
npm run dev
```

#### 6. Test Bot Performance
- Open browser: http://localhost:5173
- Navigate to **Bot Performance** page
- Check browser console (F12)
- Should see real data, no 401 errors

---

## ✅ What Will Change

### Before (Broken) ❌
```
Console: Failed to load resource: 401 (Unauthorized)
Bot Performance: Empty or "No data available"
Looks like: Mock/placeholder data
```

### After (Fixed) ✅
```
Console: [bot-performance] Fetched 150 predictions from database
Console: [bot-performance] Found 87 unique bots
Console: [bot-performance] Returning 87 bots to client
Bot Performance: Shows all 87 bots with real stats
```

---

## 🧪 How to Verify It's Working

### 1. Check Console (F12)
Look for:
```
✅ No 401 errors
✅ "Fetched X predictions from database"
✅ "Found X unique bots"
```

### 2. Check Bot Performance Page
Should show:
```
✅ Bot names (EMA Bot, RSI Bot, MACD Bot, etc.)
✅ Real accuracy percentages
✅ Prediction counts > 0
✅ Status badges (New/Active/Monitoring/Probation)
```

### 3. Check Network Tab (F12 → Network)
Filter by "bot-performance":
```
✅ Status: 200 OK (not 401)
✅ Response: { "bots": [...], "totalBots": 87 }
✅ Headers: Authorization with valid token
```

---

## 🚨 Why Your Data Might Look "Empty"

Even after fixing the token, if Bot Performance still looks empty:

### Reason 1: No Scan Run Yet
**Solution**: Run a scan first!
- Go to Dashboard
- Click "Run Scan"
- Wait for completion (2-3 minutes)
- Then check Bot Performance

### Reason 2: Database Empty
**Check**:
```sql
-- In Supabase SQL Editor
SELECT COUNT(*) FROM bot_predictions;
```
If returns 0, you need to run scans to generate data.

### Reason 3: Predictions Not Evaluated
Bot predictions need outcomes. Check:
```sql
SELECT outcome_status, COUNT(*)
FROM bot_predictions
GROUP BY outcome_status;
```

Should show: `success`, `failed`, `pending`

---

## 📊 Expected Data After First Scan

After running 1 scan, you should see:

```
Total Bots: ~87 trading bots
Per Bot:
  - Total Predictions: 1-5
  - Status: "New" (blue badge)
  - Accuracy: N/A (< 10 predictions needed)
  - Pending: 1-5 predictions

After 10+ scans:
  - Accurate percentages
  - Success/Failed counts
  - Status badges changing (Active/Monitoring/Probation)
```

---

## 🔍 Debugging Checklist

If still not working after updating token:

### [ ] Token Updated
```bash
# Check .env file
cat .env | grep ANON_KEY
# Should show new key (not expired one)
```

### [ ] Server Restarted
```bash
# Stop and restart
npm run dev
```

### [ ] Browser Cache Cleared
- Hard reload: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- Or clear cache: Ctrl+Shift+Del

### [ ] Correct URL
```
Frontend: http://localhost:5173
Supabase: https://0ec90b57d6e95fcbda19832f.supabase.co
```

### [ ] Function Deployed
Already verified: ✅ bot-performance is ACTIVE

### [ ] Database Has Data
Run a scan first if tables are empty

---

## 🎯 Quick Test

After updating token, test with curl:

```bash
# Replace YOUR_NEW_KEY with the key from .env
curl "https://0ec90b57d6e95fcbda19832f.supabase.co/functions/v1/bot-performance" \
  -H "Authorization: Bearer YOUR_NEW_KEY" \
  -H "apikey: YOUR_NEW_KEY" \
  -H "Content-Type: application/json"
```

**Expected response:**
```json
{
  "bots": [...],
  "totalBots": 87
}
```

**If you get 401:**
- Token is still wrong
- Copy fresh token from dashboard
- Make sure no spaces/quotes

---

## 💡 Summary

### Problem
❌ Expired JWT token → 401 errors → Can't fetch data → Looks like mock data

### Solution
✅ Get fresh anon key from Bolt dashboard → Update .env → Restart → Real data loads

### Action Required
**Only you can do this** - I don't have access to your Bolt dashboard credentials.

### Takes
⏱️ **2 minutes** to fix completely

---

## ✅ After Fix Checklist

- [ ] Updated `.env` with fresh anon key
- [ ] Restarted dev server
- [ ] Cleared browser cache
- [ ] Bot Performance shows data (or "No data" if no scans run yet)
- [ ] No 401 errors in console
- [ ] Status badges showing on bots
- [ ] Can run scan successfully

---

## Still Stuck?

### Quick Test If Your Key Works:
```bash
# Test database access
curl "https://0ec90b57d6e95fcbda19832f.supabase.co/rest/v1/scan_runs?limit=1" \
  -H "apikey: YOUR_KEY" \
  -H "Authorization: Bearer YOUR_KEY"
```

Should return JSON (even if empty `[]`), **not** `{"message":"Invalid API key"}`

### If that works but Bot Performance doesn't:
- Run a scan first to populate data
- Check browser console for different error
- Verify you're on Bot Performance page, not Dashboard

**Bottom line: Update that .env file with a fresh key!** 🔑
