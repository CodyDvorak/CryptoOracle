/*
  # Add Automated Learning Cron Jobs

  ## Overview
  Sets up automated cron jobs that run the learning system:
  - Evaluate 24h outcomes every hour
  - Evaluate 48h outcomes every 6 hours
  - Evaluate 7d outcomes daily
  - Update bot accuracy metrics every 6 hours
  - Adjust bot weights daily

  ## Cron Schedule
  - `evaluate_outcomes_24h`: Every hour at :05
  - `evaluate_outcomes_48h`: Every 6 hours at :10
  - `evaluate_outcomes_7d`: Daily at 02:15
  - `update_bot_metrics`: Every 6 hours at :20
  - `adjust_weights`: Daily at 03:00
*/

-- ==========================================
-- 1. Evaluate 24h Outcomes (Every Hour)
-- ==========================================

SELECT cron.schedule(
  'evaluate_outcomes_24h',
  '5 * * * *', -- Every hour at :05
  $$
  SELECT evaluate_pending_outcomes('24h');
  $$
);

-- ==========================================
-- 2. Evaluate 48h Outcomes (Every 6 Hours)
-- ==========================================

SELECT cron.schedule(
  'evaluate_outcomes_48h',
  '10 */6 * * *', -- Every 6 hours at :10
  $$
  SELECT evaluate_pending_outcomes('48h');
  $$
);

-- ==========================================
-- 3. Evaluate 7d Outcomes (Daily)
-- ==========================================

SELECT cron.schedule(
  'evaluate_outcomes_7d',
  '15 2 * * *', -- Daily at 02:15 AM
  $$
  SELECT evaluate_pending_outcomes('7d');
  $$
);

-- ==========================================
-- 4. Update Bot Accuracy Metrics (Every 6 Hours)
-- ==========================================

SELECT cron.schedule(
  'update_bot_metrics',
  '20 */6 * * *', -- Every 6 hours at :20
  $$
  SELECT update_bot_accuracy_metrics();
  $$
);

-- ==========================================
-- 5. Adjust Bot Weights (Daily)
-- ==========================================

SELECT cron.schedule(
  'adjust_bot_weights',
  '0 3 * * *', -- Daily at 03:00 AM
  $$
  SELECT adjust_bot_weights();
  $$
);

-- ==========================================
-- 6. Track Individual Bot Predictions
-- ==========================================

-- Function to create individual bot outcome records from recommendations
CREATE OR REPLACE FUNCTION track_individual_bot_outcomes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- For each recommendation, create individual outcome records for each bot that voted
  INSERT INTO prediction_outcomes (
    recommendation_id,
    bot_name,
    coin_symbol,
    predicted_direction,
    entry_price,
    target_price,
    stop_loss,
    leverage,
    market_regime,
    prediction_confidence,
    prediction_time
  )
  SELECT
    r.id as recommendation_id,
    bp.bot_name,
    r.ticker as coin_symbol,
    bp.position_direction as predicted_direction,
    bp.entry_price,
    bp.take_profit as target_price,
    bp.stop_loss,
    bp.leverage,
    bp.market_regime,
    bp.confidence_score as prediction_confidence,
    bp.prediction_time
  FROM recommendations r
  JOIN bot_predictions bp ON bp.run_id = r.run_id
  WHERE r.created_at >= now() - interval '24 hours'
    AND NOT EXISTS (
      SELECT 1 FROM prediction_outcomes po
      WHERE po.recommendation_id = r.id
        AND po.bot_name = bp.bot_name
    );
END;
$$;

-- Schedule to run every hour after evaluations
SELECT cron.schedule(
  'track_bot_outcomes',
  '50 * * * *', -- Every hour at :50
  $$
  SELECT track_individual_bot_outcomes();
  $$
);

COMMENT ON FUNCTION track_individual_bot_outcomes IS 'Creates individual prediction outcome records for each bot that participated in a recommendation';
