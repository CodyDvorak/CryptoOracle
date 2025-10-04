# Complete Deployment Guide

## 🚀 Quick Start (5 Minutes)

### Prerequisites
- Supabase project created
- Git repository ready
- Node.js installed locally

---

## Step 1: Configure Resend API Key

**Your API Key:** `re_QiusXgne_K6cUHXTtQWMd4VXTME6T2HpE`

### In Supabase Dashboard:
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **Edge Functions** in sidebar
4. Click **Settings** or **Manage Secrets**
5. Add new secret:
   - Name: `RESEND_API_KEY`
   - Value: `re_QiusXgne_K6cUHXTtQWMd4VXTME6T2HpE`
6. Save

✅ **Done!** Email system is now active.

---

## Step 2: Set Up Cron Trigger

This enables automatic scheduled scans every 15 minutes.

### Option A: Supabase pg_cron (Recommended)

In Supabase SQL Editor, run:

```sql
-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create the cron job
SELECT cron.schedule(
  'crypto-oracle-cron',           -- Job name
  '*/15 * * * *',                 -- Every 15 minutes
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/cron-trigger',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer YOUR_SERVICE_ROLE_KEY'
    )
  );
  $$
);

-- Verify cron job was created
SELECT * FROM cron.job;
```

**Important:** Replace:
- `YOUR_PROJECT_REF` with your Supabase project reference
- `YOUR_SERVICE_ROLE_KEY` with your service role key (found in Project Settings → API)

### Option B: External Cron (GitHub Actions)

Create `.github/workflows/cron.yml`:

```yaml
name: Crypto Oracle Cron

on:
  schedule:
    - cron: '*/15 * * * *'  # Every 15 minutes
  workflow_dispatch:  # Allow manual trigger

jobs:
  trigger-cron:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Supabase Cron
        run: |
          curl -X POST \
            https://YOUR_PROJECT_REF.supabase.co/functions/v1/cron-trigger \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_KEY }}" \
            -H "Content-Type: application/json"
```

Add `SUPABASE_SERVICE_KEY` to GitHub Secrets.

✅ **Done!** Automated scans are now running.

---

## Step 3: Deploy Frontend

### Vercel (Recommended - 2 minutes)

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Import in Vercel:**
   - Go to https://vercel.com
   - Click "Add New Project"
   - Import your GitHub repository
   - Vercel auto-detects Vite configuration

3. **Add Environment Variables:**
   ```
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```
   (Found in Supabase → Settings → API)

4. **Deploy:**
   - Click "Deploy"
   - Wait 2-3 minutes
   - Done! ✅

### Netlify Alternative

```bash
# Build settings
Build command: npm run build
Publish directory: dist

# Environment variables (same as Vercel)
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

✅ **Done!** App is live at your Vercel/Netlify URL.

---

## Step 4: Configure Production URL

After deploying, update Supabase secrets:

In Supabase Edge Functions → Secrets:
```
FRONTEND_URL=https://your-app.vercel.app
```

This enables proper email links.

---

## Step 5: Test the Complete Flow

### 5.1 Create Account
1. Go to your deployed URL
2. Click "Sign up"
3. Create account with email/password
4. Login

### 5.2 Create Scheduled Scan
1. Navigate to Profile page
2. Scroll to "Scheduled Scans"
3. Select "Daily" at "09:00"
4. Click "Add Schedule"
5. Schedule created! ✅

### 5.3 Verify Email Queue
In Supabase SQL Editor:
```sql
SELECT * FROM scheduled_scans WHERE is_active = true;
SELECT * FROM email_queue ORDER BY created_at DESC LIMIT 10;
```

### 5.4 Manual Test Email
Run the SQL from `test-email.sql` (change email to yours):
```sql
INSERT INTO email_queue (
  recipient_email,
  subject,
  html_body,
  email_type,
  status
) VALUES (
  'your-email@example.com',
  'Test Email',
  '<h1>Test</h1>',
  'test',
  'pending'
);
```

Then trigger email processor:
- Go to Edge Functions → email-processor
- Click "Invoke" button
- Check your email inbox!

### 5.5 Verify Cron Execution
Wait 15 minutes (or trigger manually) and check:
```sql
SELECT
  id,
  interval,
  last_run,
  next_run,
  run_count
FROM scheduled_scans
WHERE is_active = true;
```

`last_run` should update, `run_count` should increment.

---

## 🎯 What to Expect

### After Setup:
1. ✅ Users can signup/login
2. ✅ Users create scheduled scans
3. ✅ Cron runs every 15 minutes
4. ✅ Due scans execute automatically
5. ✅ Emails queue and send
6. ✅ Notifications appear in app
7. ✅ Results visible in dashboard

### Email Flow:
```
Scan completes
    ↓
Email queued in database
    ↓
Cron trigger runs (every 15 min)
    ↓
Email processor sends via Resend
    ↓
User receives email
    ↓
Status updated to "sent"
```

---

## 📊 Monitoring

### Check Email Queue Status
```sql
SELECT
  status,
  COUNT(*) as count
FROM email_queue
GROUP BY status;
```

### Check Recent Scans
```sql
SELECT
  status,
  started_at,
  completed_at,
  total_coins
FROM scan_runs
ORDER BY started_at DESC
LIMIT 10;
```

### Check Cron Job Logs
```sql
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;
```

### Edge Function Logs
1. Go to Edge Functions in Supabase
2. Select function (cron-trigger, email-processor, etc.)
3. Click "Logs" tab
4. View real-time execution logs

---

## 🔧 Troubleshooting

### Emails Not Sending?

**Check 1: API Key Configured?**
```bash
# In edge function logs, should NOT see:
# "RESEND_API_KEY not configured"
```

**Check 2: Queue Has Emails?**
```sql
SELECT * FROM email_queue WHERE status = 'pending';
```

**Check 3: Resend Dashboard**
- Go to https://resend.com/emails
- Check for delivery status
- Look for bounce/error messages

**Check 4: Email Processor Logs**
- Edge Functions → email-processor → Logs
- Look for error messages

### Scans Not Running?

**Check 1: Cron Job Active?**
```sql
SELECT * FROM cron.job WHERE jobname = 'crypto-oracle-cron';
```

**Check 2: Next Run Time Correct?**
```sql
SELECT
  id,
  interval,
  next_run,
  is_active
FROM scheduled_scans;
```

**Check 3: Cron Trigger Logs**
- Edge Functions → cron-trigger → Logs
- Should run every 15 minutes

### Build Errors?

```bash
# Clear cache and rebuild
rm -rf node_modules package-lock.json dist
npm install
npm run build
```

---

## 🎉 You're Done!

The complete system is now:
- ✅ Deployed and accessible
- ✅ Sending emails via Resend
- ✅ Running automated scans
- ✅ Processing 52 trading bots
- ✅ Notifying users in real-time

### Next Steps:
1. Invite beta testers
2. Monitor logs for first week
3. Adjust cron frequency if needed
4. Verify domain in Resend (production)
5. Set up monitoring alerts

### Support:
- Supabase Docs: https://supabase.com/docs
- Resend Docs: https://resend.com/docs
- Edge Functions: https://supabase.com/docs/guides/functions

---

**Total Setup Time:** 5-10 minutes
**System Status:** Production Ready ✅
**API Key:** Configured ✅
**Ready to scale!** 🚀
