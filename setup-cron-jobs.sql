-- Crypto Oracle - Cron Job Setup Script
-- Run this in Supabase Dashboard -> Database -> SQL Editor

-- Instructions:
-- 1. Replace YOUR_PROJECT with your Supabase project ref (e.g., abc123xyz)
-- 2. Replace YOUR_ANON_KEY with your anon key from .env file
-- 3. Execute this entire script in SQL Editor

-- Enable required extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- ====================================================================================
-- 1. Daily Market Correlation Update (2 AM UTC)
-- ====================================================================================
SELECT cron.schedule(
  'daily-correlation-update',
  '0 2 * * *',
  $$
  SELECT extensions.http_post(
    url:='https://YOUR_PROJECT.supabase.co/functions/v1/correlation-cron',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- ====================================================================================
-- 2. Daily Email Report (6 AM UTC)
-- ====================================================================================
SELECT cron.schedule(
  'daily-email-report',
  '0 6 * * *',
  $$
  SELECT extensions.http_post(
    url:='https://YOUR_PROJECT.supabase.co/functions/v1/email-alerts',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body:='{"action": "send_scheduled_report"}'::jsonb
  ) as request_id;
  $$
);

-- ====================================================================================
-- 3. Hourly Alert Check
-- ====================================================================================
SELECT cron.schedule(
  'hourly-alert-check',
  '0 * * * *',
  $$
  SELECT extensions.http_post(
    url:='https://YOUR_PROJECT.supabase.co/functions/v1/email-alerts',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body:='{"action": "check_and_send"}'::jsonb
  ) as request_id;
  $$
);

-- ====================================================================================
-- 4. Daily Bot Performance Snapshot (1 AM UTC)
-- ====================================================================================
SELECT cron.schedule(
  'daily-bot-performance-snapshot',
  '0 1 * * *',
  $$
  INSERT INTO bot_performance_history (
    bot_name,
    accuracy_rate,
    total_predictions,
    correct_predictions,
    avg_confidence,
    market_regime,
    recorded_at
  )
  SELECT
    bot_name,
    accuracy_rate,
    total_predictions,
    correct_predictions,
    avg_confidence,
    best_regime as market_regime,
    NOW() as recorded_at
  FROM bot_performance
  WHERE total_predictions > 0;
  $$
);

-- ====================================================================================
-- 5. Weekly Scan Cleanup (Sunday 3 AM UTC)
-- ====================================================================================
SELECT cron.schedule(
  'weekly-scan-cleanup',
  '0 3 * * 0',
  $$
  SELECT extensions.http_post(
    url:='https://YOUR_PROJECT.supabase.co/functions/v1/scan-cleanup',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body:='{"days": 30}'::jsonb
  ) as request_id;
  $$
);

-- ====================================================================================
-- Verify Cron Jobs
-- ====================================================================================

-- List all scheduled jobs
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  database
FROM cron.job
ORDER BY jobname;

-- View recent execution history
SELECT 
  jobid,
  runid,
  job_name,
  status,
  start_time,
  end_time,
  (end_time - start_time) as duration
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;

-- ====================================================================================
-- Troubleshooting Commands
-- ====================================================================================

-- To unschedule a job (if needed):
-- SELECT cron.unschedule('job-name-here');

-- To manually trigger correlation update:
-- SELECT extensions.http_post(
--   url:='https://YOUR_PROJECT.supabase.co/functions/v1/correlation-cron',
--   headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
-- );

-- ====================================================================================
-- Success Message
-- ====================================================================================

SELECT 'Cron jobs setup complete! Check cron.job table to verify.' as message;
