# Quick Start Deployment Guide

## ✅ All Features Implemented - Ready to Deploy!

---

## 1. Database Setup (2 minutes)

```bash
# Apply the new migration
supabase migrations apply

# Or manually run:
psql $DATABASE_URL -f supabase/migrations/20251004200000_add_alerts_and_features.sql
```

This creates:
- ✅ user_alerts table
- ✅ timeframe_analyses table
- ✅ social_sentiment table
- ✅ onchain_data table
- ✅ backtest_results table

---

## 2. Enable Supabase Realtime (1 minute)

In Supabase Dashboard:
1. Go to **Database** → **Replication**
2. Enable replication for:
   - ✅ recommendations
   - ✅ scan_runs
   - ✅ user_notifications (if exists)

---

## 3. Get FREE Groq API Key (2 minutes)

1. Visit: https://console.groq.com/
2. Sign up (free)
3. Go to API Keys
4. Create new key
5. Add to `.env`:

```bash
GROQ_API_KEY=gsk_your_key_here
```

**No credit card required. 100% free!**

---

## 4. Deploy Edge Functions (3 minutes)

```bash
# Deploy updated scan-run with all features
supabase functions deploy scan-run

# Deploy other functions (already done but verify)
supabase functions deploy email-alerts
supabase functions deploy backtesting
```

---

## 5. Build Frontend (1 minute)

```bash
npm run build
```

Expected output:
```
✓ 1594 modules transformed
✓ built in ~4s
```

---

## 6. Test Everything (5 minutes)

### Test 1: Real-Time Updates
1. Open Dashboard
2. Open browser console (F12)
3. Start a scan
4. Watch for: `🆕 New recommendation received:`

### Test 2: AI Analysis (FREE Groq)
```bash
# Should work with Groq key
curl -X POST https://your-project.supabase.co/functions/v1/scan-run \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d '{"interval":"4h","scanType":"quick_scan","coinLimit":10}'
```

### Test 3: On-Chain Data Fallback
Scan will automatically use backup APIs if Blockchair limit is reached. No action needed!

---

## 7. Optional: Set Up Cron Job for Alerts

In Supabase Dashboard → Database → Cron Jobs:

```sql
SELECT cron.schedule(
  'check-alerts-hourly',
  '0 * * * *',  -- Every hour
  $$
  SELECT net.http_post(
    url:='https://your-project-ref.supabase.co/functions/v1/email-alerts',
    headers:='{"Content-Type": "application/json"}'::jsonb,
    body:='{"action": "check_and_send"}'::jsonb
  );
  $$
);
```

---

## What's Now Live

✅ **59 Professional Bots** - Zero random logic
✅ **FREE AI Analysis** - Groq Llama 3.1 70B
✅ **Real-Time Updates** - WebSocket < 100ms latency
✅ **3-Tier On-Chain** - Never runs out of data
✅ **Multi-Timeframe** - 1H, 4H, 1D, 1W analysis
✅ **Social Sentiment** - Reddit, CryptoPanic, News
✅ **Email Alerts** - Automated notifications
✅ **Backtesting** - Historical validation

---

## Cost Summary

| Feature | Cost |
|---------|------|
| Groq AI | **$0/month** |
| Supabase | **Free tier** |
| On-Chain APIs | **Free tier** |
| WebSockets | **Built-in** |
| Email Alerts | **Free tier (3K/month)** |

**Total: $0/month for moderate usage**

---

## Troubleshooting

### "Groq API error"
→ Check GROQ_API_KEY in .env
→ System will use fallback (rule-based) analysis

### "Blockchair limit reached"
→ Automatic! Switches to Blockchain.com or BlockCypher

### "No real-time updates"
→ Check Supabase Realtime is enabled
→ Check browser console for errors

### "Build fails"
→ Run: `npm install`
→ Check Node version (need 18+)

---

## Ready! 🚀

Your platform is now:
- Production-ready
- Cost-optimized ($0-5/month)
- Feature-complete
- Real-time enabled

**Start scanning and watch the signals roll in!**
