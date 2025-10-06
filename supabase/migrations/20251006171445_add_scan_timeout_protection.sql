/*
  # Add Scan Timeout Protection

  1. Purpose
    - Automatically marks stuck scans as failed
    - Prevents scans from hanging indefinitely
    - Runs every 15 minutes to clean up orphaned scans

  2. Implementation
    - Creates function to mark scans older than 10 minutes as failed
    - Adds cron job to run cleanup every 15 minutes
    - Updates scan status and provides timeout error message
*/

-- Create function to cleanup stuck scans
CREATE OR REPLACE FUNCTION cleanup_stuck_scans()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Mark scans that have been running for more than 10 minutes as failed
  UPDATE scan_runs
  SET 
    status = 'failed',
    completed_at = NOW(),
    error_message = 'Scan timed out - exceeded 10 minute edge function limit'
  WHERE status = 'running'
  AND started_at < NOW() - INTERVAL '10 minutes';
  
  RAISE NOTICE 'Cleaned up stuck scans';
END;
$$;

-- Create cron job to cleanup stuck scans every 15 minutes
SELECT cron.schedule(
  'cleanup-stuck-scans',
  '*/15 * * * *', -- Every 15 minutes
  $$
  SELECT cleanup_stuck_scans();
  $$
);

-- Run it once immediately to clean up current stuck scans
SELECT cleanup_stuck_scans();

COMMENT ON FUNCTION cleanup_stuck_scans IS 'Marks scans stuck in running state for more than 10 minutes as failed';
