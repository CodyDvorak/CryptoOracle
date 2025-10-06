/*
  # System-Level Automated Comprehensive Scans

  1. Purpose
    - Automatically runs comprehensive market scans every 4 hours
    - No user interaction needed - system-managed
    - Populates all insights page data automatically
    - Ensures fresh data for: bot predictions, correlations, market analysis
  
  2. Implementation
    - Creates system-owned scheduled scan that runs automatically
    - Inserts initial scan schedule with 4-hour intervals
    - Cron job already exists (runs every 10 minutes)
    - Ensures data freshness for all users
  
  3. Benefits
    - Users always see fresh insights without manual scans
    - All API data (TokenMetrics, derivatives, options) refreshed regularly
    - Bot predictions stay current
    - No manual scheduling required
*/

-- Create a system user ID for automated scans (using a fixed UUID)
DO $$ 
BEGIN
  -- Insert system automated scan schedule
  -- This will be picked up by the existing cron-trigger that runs every 10 minutes
  INSERT INTO scheduled_scans (
    id,
    user_id,
    name,
    schedule_cron,
    is_active,
    next_run_at,
    config
  ) VALUES (
    'a0000000-0000-0000-0000-000000000001'::uuid,
    NULL, -- System scan, no specific user
    'System: Automated Comprehensive Market Scan',
    '0 */4 * * *', -- Every 4 hours at the top of the hour
    true,
    NOW(), -- Start immediately
    jsonb_build_object(
      'scanType', 'comprehensive_scan',
      'coinLimit', 100,
      'filterScope', 'top200',
      'confidenceThreshold', 0.60,
      'automated', true,
      'systemOwned', true
    )
  )
  ON CONFLICT (id) DO UPDATE SET
    is_active = true,
    next_run_at = CASE 
      WHEN scheduled_scans.next_run_at < NOW() THEN NOW()
      ELSE scheduled_scans.next_run_at
    END,
    config = jsonb_build_object(
      'scanType', 'comprehensive_scan',
      'coinLimit', 100,
      'filterScope', 'top200',
      'confidenceThreshold', 0.60,
      'automated', true,
      'systemOwned', true
    );
END $$;

-- Create index for faster cron queries
CREATE INDEX IF NOT EXISTS idx_scheduled_scans_active_next_run 
ON scheduled_scans(is_active, next_run_at) 
WHERE is_active = true;

-- Add comment
COMMENT ON TABLE scheduled_scans IS 'Manages both user-created and system-level automated scan schedules';
