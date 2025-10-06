/*
  # Bot Performance Tracking Automation

  1. Purpose
    - Automates continuous price tracking for ALL coins with predictions
    - Automates bot performance evaluation every hour
    - Ensures accurate bot accuracy metrics
    - Tracks performance for 140+ coins, not just top 15

  2. New Features
    - Price tracker runs every 30 minutes (dynamically tracks all coins)
    - Bot evaluator runs every hour (evaluates all predictions)
    - Automatic cleanup of old price history (keeps 7 days)
    
  3. Benefits
    - 100% prediction coverage (all coins tracked)
    - Real-time bot accuracy metrics
    - Continuous learning system
    - No manual intervention required
*/

-- Create cron job for price tracking (every 30 minutes)
-- This tracks prices for ALL coins that have predictions (dynamic list)
SELECT cron.schedule(
  'price-tracker-continuous',
  '*/30 * * * *', -- Every 30 minutes
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/price-tracker-ws',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key')
    ),
    body := jsonb_build_object()
  );
  $$
);

-- Create cron job for bot performance evaluation (every hour)
-- This evaluates all unevaluated predictions from the last 48 hours
SELECT cron.schedule(
  'bot-performance-evaluator',
  '15 * * * *', -- Every hour at 15 minutes past
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/bot-performance-evaluator?hours=48',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key')
    ),
    body := jsonb_build_object()
  );
  $$
);

-- Create cron job for price history cleanup (daily at 3 AM)
-- Keeps only last 7 days of price history
SELECT cron.schedule(
  'cleanup-old-price-history',
  '0 3 * * *', -- Daily at 3 AM UTC
  $$
  SELECT cleanup_old_price_history();
  $$
);

-- Create function to get bot performance summary
CREATE OR REPLACE FUNCTION get_bot_performance_summary(days_back integer DEFAULT 7)
RETURNS TABLE (
  bot_name text,
  total_predictions bigint,
  evaluated_predictions bigint,
  successful_predictions bigint,
  failed_predictions bigint,
  accuracy_rate numeric,
  avg_profit_loss numeric,
  evaluation_coverage numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bp.bot_name,
    COUNT(*)::bigint as total_predictions,
    COUNT(*) FILTER (WHERE bp.outcome_status IS NOT NULL)::bigint as evaluated_predictions,
    COUNT(*) FILTER (WHERE bp.outcome_status = 'success')::bigint as successful_predictions,
    COUNT(*) FILTER (WHERE bp.outcome_status = 'failed')::bigint as failed_predictions,
    CASE 
      WHEN COUNT(*) FILTER (WHERE bp.outcome_status IN ('success', 'failed')) > 0 
      THEN ROUND((COUNT(*) FILTER (WHERE bp.outcome_status = 'success')::numeric / 
                  COUNT(*) FILTER (WHERE bp.outcome_status IN ('success', 'failed'))::numeric) * 100, 2)
      ELSE 0
    END as accuracy_rate,
    ROUND(AVG(bp.profit_loss_percent) FILTER (WHERE bp.outcome_status IS NOT NULL), 2) as avg_profit_loss,
    CASE 
      WHEN COUNT(*) > 0 
      THEN ROUND((COUNT(*) FILTER (WHERE bp.outcome_status IS NOT NULL)::numeric / COUNT(*)::numeric) * 100, 2)
      ELSE 0
    END as evaluation_coverage
  FROM bot_predictions bp
  WHERE bp.timestamp >= NOW() - (days_back || ' days')::interval
  GROUP BY bp.bot_name
  ORDER BY accuracy_rate DESC NULLS LAST, total_predictions DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get coin price tracking status
CREATE OR REPLACE FUNCTION get_price_tracking_status()
RETURNS TABLE (
  total_coins_with_predictions bigint,
  coins_with_price_history bigint,
  coins_missing_prices bigint,
  latest_price_update timestamptz,
  price_history_coverage numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH prediction_coins AS (
    SELECT DISTINCT coin_symbol
    FROM bot_predictions
    WHERE timestamp >= NOW() - INTERVAL '7 days'
  ),
  tracked_coins AS (
    SELECT DISTINCT symbol
    FROM price_history
    WHERE created_at >= NOW() - INTERVAL '24 hours'
  )
  SELECT 
    (SELECT COUNT(*) FROM prediction_coins)::bigint as total_coins_with_predictions,
    (SELECT COUNT(*) FROM tracked_coins)::bigint as coins_with_price_history,
    (SELECT COUNT(*) FROM prediction_coins WHERE coin_symbol NOT IN (SELECT symbol FROM tracked_coins))::bigint as coins_missing_prices,
    (SELECT MAX(created_at) FROM price_history) as latest_price_update,
    CASE 
      WHEN (SELECT COUNT(*) FROM prediction_coins) > 0
      THEN ROUND(((SELECT COUNT(*) FROM tracked_coins)::numeric / (SELECT COUNT(*) FROM prediction_coins)::numeric) * 100, 2)
      ELSE 0
    END as price_history_coverage;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_bot_performance_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_price_tracking_status TO authenticated;

-- Create index for faster bot performance queries
CREATE INDEX IF NOT EXISTS idx_bot_predictions_outcome_timestamp 
  ON bot_predictions(outcome_status, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_bot_predictions_bot_outcome 
  ON bot_predictions(bot_name, outcome_status);

-- Add comments
COMMENT ON FUNCTION get_bot_performance_summary IS 'Returns bot accuracy and performance metrics for the specified time period';
COMMENT ON FUNCTION get_price_tracking_status IS 'Returns status of price tracking coverage across all coins with predictions';
