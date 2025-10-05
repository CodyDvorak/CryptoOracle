# Netlify Configuration Guide

## 🚀 Your Frontend is Already Connected to Netlify via Bolt!

---

## Step 1: Find Your Netlify URL

### Option A: Check Bolt Interface
- Your deployed site URL should be visible in the Bolt interface
- It will look like: `https://your-app-name.netlify.app`

### Option B: Check Netlify Dashboard
1. Go to https://app.netlify.com
2. Find your "crypto-oracle" site
3. Copy the URL (e.g., `https://crypto-oracle-abc123.netlify.app`)

### Option C: Check Your Browser
- The URL you're currently viewing this app at IS your frontend URL!
- If you see something like `https://something.netlify.app`, that's it!

---

## Step 2: Configure Frontend URL as Environment Variable

Once you have your Netlify URL, you need to set it as an environment variable in Supabase:

### In Supabase Dashboard:

1. Go to: https://supabase.com/dashboard/project/0ec90b57d6e95fcbda19832f
2. Click **Settings** → **Edge Functions** → **Environment Variables**
3. Add a new variable:
   - **Name**: `FRONTEND_URL`
   - **Value**: `https://your-app-name.netlify.app` (your actual Netlify URL)
4. Click **Save**

### Important: Redeploy Edge Functions

After adding the environment variable, you need to redeploy your edge functions for them to pick up the new value.

---

## Step 3: Configure Email Sender Domain (Optional but Recommended)

Currently, emails are sent from:
- `alerts@cryptooracle.ai`
- `reports@cryptooracle.ai`

### To use your own domain:

#### Option A: Use Resend's Default Domain (Quick)
The emails will work immediately with Resend's default sending domain. No action needed!

#### Option B: Add Custom Domain (Professional)

If you own `cryptooracle.ai` or another domain:

1. **In Resend Dashboard**:
   - Go to https://resend.com/domains
   - Click "Add Domain"
   - Enter your domain
   - Add the DNS records they provide

2. **Update Email Addresses** (after domain verified):
   - The current code already uses `cryptooracle.ai`
   - If you own this domain, just verify it in Resend
   - If you use a different domain, update the code

---

## Step 4: Update Email Links (After You Have Frontend URL)

The email templates currently use `https://cryptooracle.ai` as a placeholder. Once you know your real Netlify URL, update these files:

### Update scheduled-scan/index.ts:
```typescript
// Currently uses:
${Deno.env.get('FRONTEND_URL') || 'http://localhost:5173'}/results

// Will automatically use your FRONTEND_URL once set in Supabase!
```

### Update email-alerts/index.ts:
```typescript
// Lines with hardcoded URLs that need updating:
Line 417: href="https://cryptooracle.ai/dashboard"
Line 432: href="https://cryptooracle.ai/profile"
Line 550: href="https://cryptooracle.ai/dashboard"
Line 557: href="https://cryptooracle.ai/profile"
```

Replace all instances of `https://cryptooracle.ai` with:
```typescript
${Deno.env.get('FRONTEND_URL') || 'https://your-netlify-url.netlify.app'}
```

---

## Quick Reference: Current Configuration

### Where Frontend URL is Used:
1. **Email Templates**: "View Dashboard" button links
2. **Scheduled Reports**: Results page links
3. **Alert Management**: Profile settings links

### Current Placeholders:
- `https://cryptooracle.ai` - Generic placeholder
- `http://localhost:5173` - Local development
- `FRONTEND_URL` env var - Production (needs to be set)

---

## Example: Complete Setup

Let's say your Netlify URL is: `https://crypto-oracle-ai-123.netlify.app`

### 1. Set Environment Variable in Supabase:
```
FRONTEND_URL=https://crypto-oracle-ai-123.netlify.app
```

### 2. Email Links Will Become:
- Dashboard: `https://crypto-oracle-ai-123.netlify.app/dashboard`
- Profile: `https://crypto-oracle-ai-123.netlify.app/profile`
- Results: `https://crypto-oracle-ai-123.netlify.app/results`

### 3. Test:
- Trigger an alert or scan
- Check the email
- Click the links - they should work!

---

## Troubleshooting

### "I don't know my Netlify URL"
- Check the Bolt interface - it should show the deployed URL
- Check your browser address bar when viewing the app
- Login to Netlify dashboard and look for your site

### "Links in emails don't work"
- Make sure `FRONTEND_URL` is set in Supabase environment variables
- Redeploy edge functions after setting the variable
- Check that the URL doesn't have a trailing slash

### "Emails aren't sending"
- Verify `RESEND_API_KEY` is set correctly
- Check Resend dashboard for send logs
- Make sure user email addresses are valid

### "I want to use my own domain"
1. Buy a domain (e.g., from Namecheap, GoDaddy)
2. Point it to Netlify (follow Netlify's custom domain guide)
3. Verify domain in Resend for emails
4. Update `FRONTEND_URL` to your custom domain

---

## Current Status:

✅ Frontend deployed on Netlify (via Bolt)
✅ Backend running on Supabase Edge Functions
✅ Email system configured with Resend
✅ API keys all configured

⏳ **Action Needed**: Set `FRONTEND_URL` environment variable in Supabase

---

## Next Steps:

1. **Find your Netlify URL** (check Bolt or Netlify dashboard)
2. **Set FRONTEND_URL** in Supabase Edge Functions environment variables
3. **Redeploy edge functions** (or they'll pick it up on next deployment)
4. **Test an email** to verify links work

That's it! Your system is already 95% configured. Just need to plug in the frontend URL! 🎉
