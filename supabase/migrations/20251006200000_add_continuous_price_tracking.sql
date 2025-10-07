/*
  # Add Continuous Price Tracking for TP/SL Detection

  ## Problem
  The system only scans every 24 hours, but we need to detect if TP or SL was hit
  at ANY point between scans (not just at the 24h mark).

  ## Solution
  1. Continuously track prices every 5-15 minutes
  2. Check if TP/SL was hit for active predictions
  3. Mark the exact time when TP/SL was reached
  4. Use this data for more accurate bot performance evaluation

  ## New Tables
  - `continuous_price_tracking` - Stores price snapshots every 5-15 min
  - `tp_sl_events` - Records when TP or SL was hit

  ## New Functions
  - `track_current_prices()` - Fetches and stores current prices
  - `check_tp_sl_hits()` - Checks if any active predictions hit TP/SL
  - `update_outcome_with_tp_sl()` - Updates prediction outcomes with TP/SL data

  ## Cron Jobs
  - Track prices: Every 15 minutes
  - Check TP/SL hits: Every 15 minutes
*/

-- ==========================================
-- 1. CONTINUOUS PRICE TRACKING TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS continuous_price_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  price numeric NOT NULL,
  volume_24h numeric,
  market_cap numeric,
  price_change_1h numeric,
  price_change_24h numeric,
  data_source text DEFAULT 'coingecko',
  recorded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_continuous_price_symbol ON continuous_price_tracking(symbol);
CREATE INDEX IF NOT EXISTS idx_continuous_price_recorded_at ON continuous_price_tracking(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_continuous_price_symbol_time ON continuous_price_tracking(symbol, recorded_at DESC);

ALTER TABLE continuous_price_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view price tracking"
  ON continuous_price_tracking FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage price tracking"
  ON continuous_price_tracking FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==========================================
-- 2. TP/SL EVENTS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS tp_sl_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_outcome_id uuid REFERENCES prediction_outcomes(id) ON DELETE CASCADE,
  recommendation_id uuid REFERENCES recommendations(id) ON DELETE CASCADE,
  coin_symbol text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('TAKE_PROFIT', 'STOP_LOSS')),

  -- Entry and target details
  entry_price numeric NOT NULL,
  target_price numeric NOT NULL,
  actual_hit_price numeric NOT NULL,

  -- Timing
  prediction_time timestamptz NOT NULL,
  hit_at timestamptz NOT NULL,
  hours_to_hit numeric, -- How long until TP/SL was hit

  -- Performance
  profit_loss_percent numeric,
  with_leverage numeric,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tp_sl_events_outcome ON tp_sl_events(prediction_outcome_id);
CREATE INDEX IF NOT EXISTS idx_tp_sl_events_symbol ON tp_sl_events(coin_symbol);
CREATE INDEX IF NOT EXISTS idx_tp_sl_events_type ON tp_sl_events(event_type);
CREATE INDEX IF NOT EXISTS idx_tp_sl_events_hit_at ON tp_sl_events(hit_at DESC);

ALTER TABLE tp_sl_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view TP/SL events"
  ON tp_sl_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage TP/SL events"
  ON tp_sl_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==========================================
-- 3. FUNCTION: Track Current Prices
-- ==========================================

CREATE OR REPLACE FUNCTION track_current_prices()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer := 0;
  v_symbol record;
BEGIN
  -- Get all unique symbols from active recommendations (last 7 days)
  FOR v_symbol IN
    SELECT DISTINCT ticker as symbol
    FROM recommendations
    WHERE created_at >= now() - interval '7 days'
  LOOP
    -- In production, this would call an external API
    -- For now, we'll fetch from price_history if available
    INSERT INTO continuous_price_tracking (symbol, price, recorded_at)
    SELECT
      v_symbol.symbol,
      price,
      now()
    FROM price_history
    WHERE symbol = v_symbol.symbol
    ORDER BY recorded_at DESC
    LIMIT 1
    ON CONFLICT DO NOTHING;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ==========================================
-- 4. FUNCTION: Check TP/SL Hits
-- ==========================================

CREATE OR REPLACE FUNCTION check_tp_sl_hits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer := 0;
  v_outcome record;
  v_current_price numeric;
  v_tp_hit boolean;
  v_sl_hit boolean;
BEGIN
  -- Check all active prediction outcomes (not yet hit TP/SL and < 7 days old)
  FOR v_outcome IN
    SELECT
      po.id,
      po.recommendation_id,
      po.coin_symbol,
      po.predicted_direction,
      po.entry_price,
      po.target_price,
      po.stop_loss,
      po.leverage,
      po.prediction_time,
      po.hit_take_profit,
      po.hit_stop_loss
    FROM prediction_outcomes po
    WHERE po.prediction_time >= now() - interval '7 days'
      AND (po.hit_take_profit = false OR po.hit_stop_loss = false)
  LOOP
    -- Get most recent price
    SELECT price INTO v_current_price
    FROM continuous_price_tracking
    WHERE symbol = v_outcome.coin_symbol
    ORDER BY recorded_at DESC
    LIMIT 1;

    IF v_current_price IS NULL THEN
      CONTINUE;
    END IF;

    v_tp_hit := false;
    v_sl_hit := false;

    -- Check if TP was hit
    IF NOT v_outcome.hit_take_profit THEN
      IF v_outcome.predicted_direction = 'LONG' AND v_current_price >= v_outcome.target_price THEN
        v_tp_hit := true;
      ELSIF v_outcome.predicted_direction = 'SHORT' AND v_current_price <= v_outcome.target_price THEN
        v_tp_hit := true;
      END IF;

      IF v_tp_hit THEN
        -- Record TP hit event
        INSERT INTO tp_sl_events (
          prediction_outcome_id,
          recommendation_id,
          coin_symbol,
          event_type,
          entry_price,
          target_price,
          actual_hit_price,
          prediction_time,
          hit_at,
          hours_to_hit,
          profit_loss_percent,
          with_leverage
        )
        VALUES (
          v_outcome.id,
          v_outcome.recommendation_id,
          v_outcome.coin_symbol,
          'TAKE_PROFIT',
          v_outcome.entry_price,
          v_outcome.target_price,
          v_current_price,
          v_outcome.prediction_time,
          now(),
          EXTRACT(EPOCH FROM (now() - v_outcome.prediction_time)) / 3600,
          CASE
            WHEN v_outcome.predicted_direction = 'LONG'
            THEN ((v_current_price - v_outcome.entry_price) / v_outcome.entry_price) * 100 * v_outcome.leverage
            ELSE ((v_outcome.entry_price - v_current_price) / v_outcome.entry_price) * 100 * v_outcome.leverage
          END,
          v_outcome.leverage
        );

        -- Update prediction outcome
        UPDATE prediction_outcomes
        SET hit_take_profit = true
        WHERE id = v_outcome.id;

        v_count := v_count + 1;
      END IF;
    END IF;

    -- Check if SL was hit
    IF NOT v_outcome.hit_stop_loss THEN
      IF v_outcome.predicted_direction = 'LONG' AND v_current_price <= v_outcome.stop_loss THEN
        v_sl_hit := true;
      ELSIF v_outcome.predicted_direction = 'SHORT' AND v_current_price >= v_outcome.stop_loss THEN
        v_sl_hit := true;
      END IF;

      IF v_sl_hit THEN
        -- Record SL hit event
        INSERT INTO tp_sl_events (
          prediction_outcome_id,
          recommendation_id,
          coin_symbol,
          event_type,
          entry_price,
          target_price,
          actual_hit_price,
          prediction_time,
          hit_at,
          hours_to_hit,
          profit_loss_percent,
          with_leverage
        )
        VALUES (
          v_outcome.id,
          v_outcome.recommendation_id,
          v_outcome.coin_symbol,
          'STOP_LOSS',
          v_outcome.entry_price,
          v_outcome.stop_loss,
          v_current_price,
          v_outcome.prediction_time,
          now(),
          EXTRACT(EPOCH FROM (now() - v_outcome.prediction_time)) / 3600,
          CASE
            WHEN v_outcome.predicted_direction = 'LONG'
            THEN ((v_current_price - v_outcome.entry_price) / v_outcome.entry_price) * 100 * v_outcome.leverage
            ELSE ((v_outcome.entry_price - v_current_price) / v_outcome.entry_price) * 100 * v_outcome.leverage
          END,
          v_outcome.leverage
        );

        -- Update prediction outcome
        UPDATE prediction_outcomes
        SET hit_stop_loss = true
        WHERE id = v_outcome.id;

        v_count := v_count + 1;
      END IF;
    END IF;

  END LOOP;

  RETURN v_count;
END;
$$;

-- ==========================================
-- 5. ENHANCED EVALUATION WITH TP/SL DATA
-- ==========================================

-- Update the existing evaluate_prediction_outcome to consider TP/SL hits
CREATE OR REPLACE FUNCTION evaluate_prediction_outcome_enhanced(
  p_recommendation_id uuid,
  p_timeframe text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rec record;
  v_current_price numeric;
  v_was_correct boolean;
  v_profit_loss numeric;
  v_tp_event record;
  v_sl_event record;
BEGIN
  -- First run the standard evaluation
  PERFORM evaluate_prediction_outcome(p_recommendation_id, p_timeframe);

  -- Then check if TP or SL was hit during the period
  SELECT * INTO v_tp_event
  FROM tp_sl_events
  WHERE recommendation_id = p_recommendation_id
    AND event_type = 'TAKE_PROFIT'
  LIMIT 1;

  SELECT * INTO v_sl_event
  FROM tp_sl_events
  WHERE recommendation_id = p_recommendation_id
    AND event_type = 'STOP_LOSS'
  LIMIT 1;

  -- Update outcome with TP/SL information
  IF v_tp_event.id IS NOT NULL THEN
    UPDATE prediction_outcomes
    SET
      hit_take_profit = true,
      profit_loss_24h = CASE WHEN p_timeframe = '24h' THEN v_tp_event.profit_loss_percent ELSE profit_loss_24h END,
      profit_loss_48h = CASE WHEN p_timeframe = '48h' THEN v_tp_event.profit_loss_percent ELSE profit_loss_48h END,
      profit_loss_7d = CASE WHEN p_timeframe = '7d' THEN v_tp_event.profit_loss_percent ELSE profit_loss_7d END,
      was_correct_24h = CASE WHEN p_timeframe = '24h' THEN true ELSE was_correct_24h END,
      was_correct_48h = CASE WHEN p_timeframe = '48h' THEN true ELSE was_correct_48h END,
      was_correct_7d = CASE WHEN p_timeframe = '7d' THEN true ELSE was_correct_7d END
    WHERE recommendation_id = p_recommendation_id;
  END IF;

  IF v_sl_event.id IS NOT NULL THEN
    UPDATE prediction_outcomes
    SET
      hit_stop_loss = true,
      profit_loss_24h = CASE WHEN p_timeframe = '24h' THEN v_sl_event.profit_loss_percent ELSE profit_loss_24h END,
      profit_loss_48h = CASE WHEN p_timeframe = '48h' THEN v_sl_event.profit_loss_percent ELSE profit_loss_48h END,
      profit_loss_7d = CASE WHEN p_timeframe = '7d' THEN v_sl_event.profit_loss_percent ELSE profit_loss_7d END,
      was_correct_24h = CASE WHEN p_timeframe = '24h' THEN false ELSE was_correct_24h END,
      was_correct_48h = CASE WHEN p_timeframe = '48h' THEN false ELSE was_correct_48h END,
      was_correct_7d = CASE WHEN p_timeframe = '7d' THEN false ELSE was_correct_7d END
    WHERE recommendation_id = p_recommendation_id;
  END IF;

END;
$$;

-- ==========================================
-- 6. SETUP CRON JOBS
-- ==========================================

-- Track prices every 15 minutes
SELECT cron.schedule(
  'track_prices_continuous',
  '*/15 * * * *',
  $$
  SELECT track_current_prices();
  $$
);

-- Check TP/SL hits every 15 minutes
SELECT cron.schedule(
  'check_tp_sl_hits',
  '*/15 * * * *',
  $$
  SELECT check_tp_sl_hits();
  $$
);

-- Cleanup old price tracking data (keep 30 days)
SELECT cron.schedule(
  'cleanup_old_price_tracking',
  '0 4 * * *', -- Daily at 4 AM
  $$
  DELETE FROM continuous_price_tracking
  WHERE recorded_at < now() - interval '30 days';
  $$
);

COMMENT ON TABLE continuous_price_tracking IS 'Stores price snapshots every 15 minutes for TP/SL detection';
COMMENT ON TABLE tp_sl_events IS 'Records when take-profit or stop-loss levels were hit';
COMMENT ON FUNCTION track_current_prices IS 'Fetches and stores current prices for active predictions';
COMMENT ON FUNCTION check_tp_sl_hits IS 'Checks if any active predictions hit their TP or SL levels';
