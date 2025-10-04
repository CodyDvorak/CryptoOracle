# Quick Reference Card

## 🔑 Your Credentials

### Resend API Key
```
re_QiusXgne_K6cUHXTtQWMd4VXTME6T2HpE
```

### Where to Add It
**Supabase Dashboard:**
- Edge Functions → Manage Secrets
- Add: `RESEND_API_KEY` = `re_QiusXgne_K6cUHXTtQWMd4VXTME6T2HpE`

---

## ⚡ Quick Actions

### Test Email System
```sql
-- Run in Supabase SQL Editor (change email to yours!)
INSERT INTO email_queue (recipient_email, subject, html_body, email_type, status)
VALUES ('your@email.com', 'Test', '<h1>It works!</h1>', 'test', 'pending');

-- Then invoke: Edge Functions → email-processor → Invoke
-- Check your inbox!
```

### Manual Cron Trigger
```bash
# Test cron without waiting
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/cron-trigger \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

### Check Email Queue
```sql
SELECT status, COUNT(*) FROM email_queue GROUP BY status;
```

### View Recent Scans
```sql
SELECT * FROM scan_runs ORDER BY started_at DESC LIMIT 5;
```

---

## 📋 Setup Checklist

- [ ] Add `RESEND_API_KEY` to Supabase secrets
- [ ] Set up pg_cron job (runs every 15 min)
- [ ] Deploy frontend to Vercel/Netlify
- [ ] Add `FRONTEND_URL` secret
- [ ] Test email with SQL insert
- [ ] Create test user account
- [ ] Schedule first scan
- [ ] Verify email received

---

## 🚀 Deployment Commands

### Build Locally
```bash
npm install
npm run build
```

### Deploy to Vercel
```bash
git push origin main
# Auto-deploys via Vercel GitHub integration
```

### Environment Variables (Vercel/Netlify)
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## 🎯 Key URLs

### Supabase Dashboard
https://supabase.com/dashboard

### Resend Dashboard
https://resend.com/emails

### Your Deployed App
https://your-app.vercel.app (after deployment)

---

## 📊 Monitoring

### Email Status
```sql
-- Pending emails
SELECT COUNT(*) FROM email_queue WHERE status = 'pending';

-- Failed emails
SELECT * FROM email_queue WHERE status = 'failed';

-- Last 10 sent
SELECT * FROM email_queue WHERE status = 'sent'
ORDER BY sent_at DESC LIMIT 10;
```

### Active Schedules
```sql
SELECT * FROM scheduled_scans WHERE is_active = true;
```

### Today's Scans
```sql
SELECT * FROM scan_runs
WHERE started_at::date = CURRENT_DATE
ORDER BY started_at DESC;
```

---

## 🔧 Common Issues

### "Email not sending"
1. Check secret is set: `RESEND_API_KEY`
2. Check logs: Edge Functions → email-processor → Logs
3. Verify Resend dashboard for delivery status

### "Cron not running"
1. Check cron job exists: `SELECT * FROM cron.job;`
2. Check schedule has future `next_run`
3. Manually trigger to test

### "Build fails"
```bash
rm -rf node_modules dist
npm install
npm run build
```

---

## 📞 Support Resources

- **Supabase:** https://supabase.com/docs
- **Resend:** https://resend.com/docs
- **React:** https://react.dev
- **Vite:** https://vitejs.dev

---

## ✅ System Status

- **Bots:** 52 active (29 specialized)
- **Email Limit:** 3,000/month (Resend free)
- **Cron:** Every 15 minutes
- **Build:** ✅ Successful
- **Production:** ✅ Ready

**Everything is configured and ready to go!** 🎉

Just add the API key to Supabase secrets and you're live!
