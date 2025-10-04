# Resend API Key Configuration

## Your Resend API Key
```
re_QiusXgne_K6cUHXTtQWMd4VXTME6T2HpE
```

## Setup Instructions

### Step 1: Add Secret to Supabase

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Edge Functions** (in the left sidebar)
4. Click on **Settings** or **Manage secrets**
5. Click **Add new secret**
6. Enter:
   - **Name**: `RESEND_API_KEY`
   - **Value**: `re_QiusXgne_K6cUHXTtQWMd4VXTME6T2HpE`
7. Click **Save**

### Step 2: Verify Configuration

The secret will be automatically available to all edge functions. You can verify by checking the email-processor function logs.

### Step 3: Test Email Sending

Run this curl command to test:

```bash
# Replace YOUR_PROJECT_URL and YOUR_SERVICE_ROLE_KEY
curl -X POST https://YOUR_PROJECT_URL.supabase.co/functions/v1/email-processor \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

Or test by:
1. Creating a scheduled scan in the Profile page
2. Waiting for the cron trigger to run
3. Checking your email inbox

## Email Sending Limits

**Resend Free Tier:**
- 3,000 emails per month
- 100 emails per day
- Perfect for testing and initial launch

## Email Configuration

The email processor is configured to:
- Send from: `Crypto Oracle <noreply@cryptooracle.app>`
- Process batches of 10 emails at a time
- Retry failed emails automatically
- Log all operations

## Verify Domain (Optional but Recommended)

For production, verify your domain in Resend:

1. Go to https://resend.com/domains
2. Add your domain (e.g., cryptooracle.app)
3. Add DNS records as instructed
4. Update the "from" address in `email-processor/index.ts`

## Current Status

✅ API Key received
✅ Email processor deployed
✅ Queue system ready
⚠️ Needs manual configuration in Supabase Dashboard
⚠️ Domain verification pending (optional)

## What Happens After Setup

Once the API key is configured:
1. Scheduled scans complete → Email queued
2. Cron trigger runs → Calls email processor
3. Email processor → Sends via Resend API
4. User receives → Beautiful HTML email
5. Status updated → Marked as "sent" in database

## Troubleshooting

**If emails don't send:**
1. Check Supabase Edge Function logs
2. Verify API key is correct
3. Check email_queue table for status
4. Ensure RESEND_API_KEY secret is set
5. Review Resend dashboard for errors

**Check Email Queue:**
```sql
-- Run in Supabase SQL Editor
SELECT * FROM email_queue
ORDER BY created_at DESC
LIMIT 10;
```

**Check Logs:**
1. Go to Edge Functions → email-processor
2. Click on "Logs" tab
3. Look for success/error messages
