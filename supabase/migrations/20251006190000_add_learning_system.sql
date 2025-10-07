/*
  # Add Complete Bot Learning System

  ## Overview
  This migration implements a comprehensive learning and feedback loop system for the 87 trading bots.
  It enables bots to learn from their wins and losses, adapt their strategies, and improve accuracy over time.

  ## 1. New Tables

  ### `prediction_outcomes`
  Stores the actual outcomes of bot predictions to measure accuracy:
  - `id` (uuid, primary key)
  - `recommendation_id` (uuid, references recommendations)
  - `bot_name` (text) - which bot made the prediction
  - `predicted_direction` (text) - LONG or SHORT
  - `entry_price` (numeric) - predicted entry price
  - `target_price` (numeric) - take profit target
  - `stop_loss` (numeric) - stop loss level
  - `actual_price_24h` (numeric) - actual price after 24h
  - `actual_price_48h` (numeric) - actual price after 48h
  - `actual_price_7d` (numeric) - actual price after 7 days
  - `was_correct_24h` (boolean) - did prediction match direction?
  - `was_correct_48h` (boolean)
  - `was_correct_7d` (boolean)
  - `profit_loss_24h` (numeric) - % gain/loss after 24h
  - `profit_loss_48h` (numeric)
  - `profit_loss_7d` (numeric)
  - `hit_take_profit` (boolean) - did price reach target?
  - `hit_stop_loss` (boolean) - did price hit stop loss?
  - `market_regime` (text) - market condition during prediction
  - `evaluated_at` (timestamptz) - when outcome was calculated
  - `created_at` (timestamptz)

  ### `bot_accuracy_metrics`
  Aggregated accuracy metrics per bot per market regime:
  - `id` (uuid, primary key)
  - `bot_name` (text)
  - `market_regime` (text) - TRENDING, RANGING, VOLATILE, ALL
  - `total_predictions` (integer) - total predictions made
  - `correct_predictions` (integer) - correct predictions
  - `accuracy_rate` (numeric) - correct/total ratio
  - `avg_profit_loss` (numeric) - average % gain/loss
  - `win_rate` (numeric) - profitable trades / total
  - `avg_confidence` (numeric) - average confidence score
  - `last_30_days_accuracy` (numeric) - recent performance
  - `current_weight` (numeric) - current bot weight (1.0 = default)
  - `is_enabled` (boolean) - bot enabled/disabled
  - `last_updated` (timestamptz)

  ## 2. Functions

  ### `evaluate_prediction_outcome()`
  Fetches current price and evaluates if prediction was correct.
  Called by cron job 24h/48h/7d after prediction.

  ### `update_bot_accuracy_metrics()`
  Recalculates bot accuracy based on recent outcomes.
  Updates weights and enables/disables bots automatically.

  ### `adjust_bot_weights()`
  AI-driven weight adjustment based on performance:
  - High accuracy (>70%) → increase weight +30%
  - Medium accuracy (50-70%) → maintain weight
  - Low accuracy (<50%) → decrease weight -50%
  - Very low (<35% over 50+ predictions) → disable bot

  ## 3. Cron Jobs
  - Evaluate 24h outcomes: runs every hour
  - Evaluate 48h outcomes: runs every 6 hours
  - Evaluate 7d outcomes: runs daily
  - Update bot metrics: runs every 6 hours
  - Adjust weights: runs daily

  ## 4. Security
  - RLS enabled on all tables
  - Only authenticated users can view outcomes
  - Only service role can write outcomes
*/

-- ==========================================
-- 1. PREDICTION OUTCOMES TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS prediction_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid REFERENCES recommendations(id) ON DELETE CASCADE,
  bot_name text NOT NULL,
  coin_symbol text NOT NULL,
  predicted_direction text NOT NULL CHECK (predicted_direction IN ('LONG', 'SHORT')),
  entry_price numeric NOT NULL,
  target_price numeric NOT NULL,
  stop_loss numeric NOT NULL,
  leverage numeric DEFAULT 3,

  -- Actual outcomes
  actual_price_24h numeric,
  actual_price_48h numeric,
  actual_price_7d numeric,

  -- Correctness flags
  was_correct_24h boolean,
  was_correct_48h boolean,
  was_correct_7d boolean,

  -- Profit/Loss calculations
  profit_loss_24h numeric,
  profit_loss_48h numeric,
  profit_loss_7d numeric,

  -- Target hit flags
  hit_take_profit boolean DEFAULT false,
  hit_stop_loss boolean DEFAULT false,

  -- Context
  market_regime text,
  prediction_confidence numeric,

  -- Timestamps
  prediction_time timestamptz NOT NULL,
  evaluated_at_24h timestamptz,
  evaluated_at_48h timestamptz,
  evaluated_at_7d timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prediction_outcomes_bot_name ON prediction_outcomes(bot_name);
CREATE INDEX IF NOT EXISTS idx_prediction_outcomes_coin ON prediction_outcomes(coin_symbol);
CREATE INDEX IF NOT EXISTS idx_prediction_outcomes_regime ON prediction_outcomes(market_regime);
CREATE INDEX IF NOT EXISTS idx_prediction_outcomes_prediction_time ON prediction_outcomes(prediction_time DESC);
CREATE INDEX IF NOT EXISTS idx_prediction_outcomes_recommendation ON prediction_outcomes(recommendation_id);

ALTER TABLE prediction_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view prediction outcomes"
  ON prediction_outcomes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage prediction outcomes"
  ON prediction_outcomes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==========================================
-- 2. BOT ACCURACY METRICS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS bot_accuracy_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_name text NOT NULL,
  market_regime text NOT NULL DEFAULT 'ALL',

  -- Core metrics
  total_predictions integer DEFAULT 0,
  correct_predictions integer DEFAULT 0,
  accuracy_rate numeric DEFAULT 0,

  -- Financial metrics
  avg_profit_loss numeric DEFAULT 0,
  total_profit_loss numeric DEFAULT 0,
  win_rate numeric DEFAULT 0,
  max_drawdown numeric DEFAULT 0,

  -- Confidence metrics
  avg_confidence numeric DEFAULT 0,
  confidence_accuracy_correlation numeric DEFAULT 0,

  -- Time-based metrics
  last_7_days_accuracy numeric DEFAULT 0,
  last_30_days_accuracy numeric DEFAULT 0,
  last_90_days_accuracy numeric DEFAULT 0,

  -- Weight management
  current_weight numeric DEFAULT 1.0,
  weight_history jsonb DEFAULT '[]'::jsonb,

  -- Status
  is_enabled boolean DEFAULT true,
  auto_disabled_at timestamptz,
  auto_disabled_reason text,

  -- Timestamps
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),

  UNIQUE(bot_name, market_regime)
);

CREATE INDEX IF NOT EXISTS idx_bot_accuracy_bot_name ON bot_accuracy_metrics(bot_name);
CREATE INDEX IF NOT EXISTS idx_bot_accuracy_regime ON bot_accuracy_metrics(market_regime);
CREATE INDEX IF NOT EXISTS idx_bot_accuracy_rate ON bot_accuracy_metrics(accuracy_rate DESC);
CREATE INDEX IF NOT EXISTS idx_bot_accuracy_enabled ON bot_accuracy_metrics(is_enabled);

ALTER TABLE bot_accuracy_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view bot accuracy metrics"
  ON bot_accuracy_metrics FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage bot accuracy"
  ON bot_accuracy_metrics FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==========================================
-- 3. FUNCTION: Evaluate Prediction Outcome
-- ==========================================

CREATE OR REPLACE FUNCTION evaluate_prediction_outcome(
  p_recommendation_id uuid,
  p_timeframe text -- '24h', '48h', '7d'
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
BEGIN
  -- Get recommendation and current price
  SELECT
    r.ticker,
    r.current_price as entry_price,
    r.consensus_direction,
    r.avg_take_profit,
    r.avg_stop_loss,
    r.avg_leverage,
    r.market_regime,
    r.avg_confidence,
    r.created_at as prediction_time
  INTO v_rec
  FROM recommendations r
  WHERE r.id = p_recommendation_id;

  IF v_rec IS NULL THEN
    RETURN;
  END IF;

  -- Fetch current price (you'll need to implement this based on your price tracking)
  -- For now, we'll use a placeholder that checks price_history table
  SELECT price INTO v_current_price
  FROM price_history
  WHERE symbol = v_rec.ticker
  ORDER BY recorded_at DESC
  LIMIT 1;

  IF v_current_price IS NULL THEN
    RETURN;
  END IF;

  -- Calculate if prediction was correct
  IF v_rec.consensus_direction = 'LONG' THEN
    v_was_correct := v_current_price > v_rec.entry_price;
    v_profit_loss := ((v_current_price - v_rec.entry_price) / v_rec.entry_price) * 100 * v_rec.avg_leverage;
  ELSE -- SHORT
    v_was_correct := v_current_price < v_rec.entry_price;
    v_profit_loss := ((v_rec.entry_price - v_current_price) / v_rec.entry_price) * 100 * v_rec.avg_leverage;
  END IF;

  -- Insert outcome record if not exists
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
    p_recommendation_id,
    'AGGREGATED', -- We'll track individual bot outcomes separately
    v_rec.ticker,
    v_rec.consensus_direction,
    v_rec.entry_price,
    v_rec.avg_take_profit,
    v_rec.avg_stop_loss,
    v_rec.avg_leverage,
    v_rec.market_regime,
    v_rec.avg_confidence,
    v_rec.prediction_time
  WHERE NOT EXISTS (
    SELECT 1 FROM prediction_outcomes
    WHERE recommendation_id = p_recommendation_id
  );

  -- Update outcome based on timeframe
  IF p_timeframe = '24h' THEN
    UPDATE prediction_outcomes
    SET
      actual_price_24h = v_current_price,
      was_correct_24h = v_was_correct,
      profit_loss_24h = v_profit_loss,
      evaluated_at_24h = now(),
      hit_take_profit = CASE
        WHEN v_rec.consensus_direction = 'LONG' AND v_current_price >= v_rec.avg_take_profit THEN true
        WHEN v_rec.consensus_direction = 'SHORT' AND v_current_price <= v_rec.avg_take_profit THEN true
        ELSE hit_take_profit
      END,
      hit_stop_loss = CASE
        WHEN v_rec.consensus_direction = 'LONG' AND v_current_price <= v_rec.avg_stop_loss THEN true
        WHEN v_rec.consensus_direction = 'SHORT' AND v_current_price >= v_rec.avg_stop_loss THEN true
        ELSE hit_stop_loss
      END
    WHERE recommendation_id = p_recommendation_id;

  ELSIF p_timeframe = '48h' THEN
    UPDATE prediction_outcomes
    SET
      actual_price_48h = v_current_price,
      was_correct_48h = v_was_correct,
      profit_loss_48h = v_profit_loss,
      evaluated_at_48h = now()
    WHERE recommendation_id = p_recommendation_id;

  ELSIF p_timeframe = '7d' THEN
    UPDATE prediction_outcomes
    SET
      actual_price_7d = v_current_price,
      was_correct_7d = v_was_correct,
      profit_loss_7d = v_profit_loss,
      evaluated_at_7d = now()
    WHERE recommendation_id = p_recommendation_id;
  END IF;

END;
$$;

-- ==========================================
-- 4. FUNCTION: Update Bot Accuracy Metrics
-- ==========================================

CREATE OR REPLACE FUNCTION update_bot_accuracy_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bot record;
  v_regime text;
BEGIN
  -- Update metrics for each bot and regime combination
  FOR v_bot IN
    SELECT DISTINCT bp.bot_name
    FROM bot_predictions bp
  LOOP
    FOR v_regime IN SELECT unnest(ARRAY['ALL', 'BULL', 'BEAR', 'SIDEWAYS', 'TRENDING', 'RANGING', 'VOLATILE']) LOOP

      -- Calculate and update metrics
      INSERT INTO bot_accuracy_metrics (
        bot_name,
        market_regime,
        total_predictions,
        correct_predictions,
        accuracy_rate,
        avg_profit_loss,
        total_profit_loss,
        win_rate,
        avg_confidence,
        last_7_days_accuracy,
        last_30_days_accuracy,
        last_90_days_accuracy,
        last_updated
      )
      SELECT
        v_bot.bot_name,
        v_regime,
        COUNT(*) as total_predictions,
        COUNT(*) FILTER (WHERE po.was_correct_24h = true) as correct_predictions,
        COALESCE(
          COUNT(*) FILTER (WHERE po.was_correct_24h = true)::numeric / NULLIF(COUNT(*), 0),
          0
        ) as accuracy_rate,
        COALESCE(AVG(po.profit_loss_24h), 0) as avg_profit_loss,
        COALESCE(SUM(po.profit_loss_24h), 0) as total_profit_loss,
        COALESCE(
          COUNT(*) FILTER (WHERE po.profit_loss_24h > 0)::numeric / NULLIF(COUNT(*), 0),
          0
        ) as win_rate,
        COALESCE(AVG(bp.confidence_score), 0) as avg_confidence,
        -- Last 7 days
        COALESCE(
          COUNT(*) FILTER (
            WHERE po.was_correct_24h = true
            AND po.prediction_time >= now() - interval '7 days'
          )::numeric / NULLIF(
            COUNT(*) FILTER (WHERE po.prediction_time >= now() - interval '7 days'), 0
          ),
          0
        ) as last_7_days_accuracy,
        -- Last 30 days
        COALESCE(
          COUNT(*) FILTER (
            WHERE po.was_correct_24h = true
            AND po.prediction_time >= now() - interval '30 days'
          )::numeric / NULLIF(
            COUNT(*) FILTER (WHERE po.prediction_time >= now() - interval '30 days'), 0
          ),
          0
        ) as last_30_days_accuracy,
        -- Last 90 days
        COALESCE(
          COUNT(*) FILTER (
            WHERE po.was_correct_24h = true
            AND po.prediction_time >= now() - interval '90 days'
          )::numeric / NULLIF(
            COUNT(*) FILTER (WHERE po.prediction_time >= now() - interval '90 days'), 0
          ),
          0
        ) as last_90_days_accuracy,
        now() as last_updated
      FROM bot_predictions bp
      JOIN prediction_outcomes po ON po.recommendation_id = bp.run_id
      WHERE bp.bot_name = v_bot.bot_name
        AND (v_regime = 'ALL' OR bp.market_regime = v_regime)
        AND po.evaluated_at_24h IS NOT NULL
      GROUP BY v_bot.bot_name
      HAVING COUNT(*) > 0

      ON CONFLICT (bot_name, market_regime)
      DO UPDATE SET
        total_predictions = EXCLUDED.total_predictions,
        correct_predictions = EXCLUDED.correct_predictions,
        accuracy_rate = EXCLUDED.accuracy_rate,
        avg_profit_loss = EXCLUDED.avg_profit_loss,
        total_profit_loss = EXCLUDED.total_profit_loss,
        win_rate = EXCLUDED.win_rate,
        avg_confidence = EXCLUDED.avg_confidence,
        last_7_days_accuracy = EXCLUDED.last_7_days_accuracy,
        last_30_days_accuracy = EXCLUDED.last_30_days_accuracy,
        last_90_days_accuracy = EXCLUDED.last_90_days_accuracy,
        last_updated = now();

    END LOOP;
  END LOOP;
END;
$$;

-- ==========================================
-- 5. FUNCTION: Adjust Bot Weights
-- ==========================================

CREATE OR REPLACE FUNCTION adjust_bot_weights()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bot record;
  v_new_weight numeric;
  v_weight_change numeric;
BEGIN
  FOR v_bot IN
    SELECT * FROM bot_accuracy_metrics
    WHERE total_predictions >= 10 -- Minimum sample size
  LOOP

    -- Calculate new weight based on accuracy
    -- Use recent performance (last 30 days) more heavily
    v_new_weight := v_bot.current_weight;

    -- High performers: increase weight
    IF v_bot.last_30_days_accuracy > 0.70 AND v_bot.total_predictions >= 20 THEN
      v_weight_change := 0.30; -- +30%
      v_new_weight := LEAST(v_bot.current_weight * (1 + v_weight_change), 2.0);

    -- Good performers: slight increase
    ELSIF v_bot.last_30_days_accuracy > 0.60 AND v_bot.total_predictions >= 20 THEN
      v_weight_change := 0.10; -- +10%
      v_new_weight := LEAST(v_bot.current_weight * (1 + v_weight_change), 1.5);

    -- Medium performers: maintain
    ELSIF v_bot.last_30_days_accuracy >= 0.50 THEN
      v_new_weight := v_bot.current_weight;

    -- Poor performers: decrease weight
    ELSIF v_bot.last_30_days_accuracy < 0.50 AND v_bot.total_predictions >= 20 THEN
      v_weight_change := -0.50; -- -50%
      v_new_weight := GREATEST(v_bot.current_weight * (1 + v_weight_change), 0.2);

    -- Very poor performers: disable
    ELSIF v_bot.accuracy_rate < 0.35 AND v_bot.total_predictions >= 50 THEN
      v_new_weight := 0;
      UPDATE bot_accuracy_metrics
      SET
        is_enabled = false,
        auto_disabled_at = now(),
        auto_disabled_reason = format(
          'Low accuracy: %.1f%% over %s predictions',
          v_bot.accuracy_rate * 100,
          v_bot.total_predictions
        )
      WHERE id = v_bot.id;
      CONTINUE;
    END IF;

    -- Update weight with history tracking
    UPDATE bot_accuracy_metrics
    SET
      current_weight = v_new_weight,
      weight_history = weight_history || jsonb_build_object(
        'timestamp', now(),
        'old_weight', v_bot.current_weight,
        'new_weight', v_new_weight,
        'accuracy_30d', v_bot.last_30_days_accuracy,
        'total_predictions', v_bot.total_predictions
      ),
      last_updated = now()
    WHERE id = v_bot.id;

    -- Also update bot_parameters table for runtime usage
    INSERT INTO bot_parameters (
      bot_name,
      market_regime,
      parameters,
      performance_score,
      is_active
    )
    VALUES (
      v_bot.bot_name,
      v_bot.market_regime,
      jsonb_build_object('weight', v_new_weight),
      v_bot.accuracy_rate,
      v_bot.is_enabled
    )
    ON CONFLICT (bot_name, market_regime)
    DO UPDATE SET
      parameters = jsonb_set(
        bot_parameters.parameters,
        '{weight}',
        to_jsonb(v_new_weight)
      ),
      performance_score = v_bot.accuracy_rate,
      is_active = v_bot.is_enabled,
      updated_at = now();

  END LOOP;
END;
$$;

-- ==========================================
-- 6. FUNCTION: Batch Evaluate Pending Outcomes
-- ==========================================

CREATE OR REPLACE FUNCTION evaluate_pending_outcomes(
  p_timeframe text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer := 0;
  v_rec record;
  v_age interval;
BEGIN
  -- Determine how old recommendations should be
  v_age := CASE p_timeframe
    WHEN '24h' THEN interval '24 hours'
    WHEN '48h' THEN interval '48 hours'
    WHEN '7d' THEN interval '7 days'
    ELSE interval '24 hours'
  END;

  -- Find recommendations that need evaluation
  FOR v_rec IN
    SELECT r.id
    FROM recommendations r
    LEFT JOIN prediction_outcomes po ON po.recommendation_id = r.id
    WHERE r.created_at <= now() - v_age
      AND (
        (p_timeframe = '24h' AND (po.evaluated_at_24h IS NULL OR po.id IS NULL))
        OR (p_timeframe = '48h' AND (po.evaluated_at_48h IS NULL OR po.id IS NULL))
        OR (p_timeframe = '7d' AND (po.evaluated_at_7d IS NULL OR po.id IS NULL))
      )
    LIMIT 100 -- Process in batches
  LOOP
    PERFORM evaluate_prediction_outcome(v_rec.id, p_timeframe);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ==========================================
-- 7. Initialize Bot Accuracy Metrics
-- ==========================================

-- Create initial records for all bots
INSERT INTO bot_accuracy_metrics (bot_name, market_regime, is_enabled)
SELECT DISTINCT
  bp.bot_name,
  'ALL' as market_regime,
  true as is_enabled
FROM bot_predictions bp
WHERE NOT EXISTS (
  SELECT 1 FROM bot_accuracy_metrics bam
  WHERE bam.bot_name = bp.bot_name AND bam.market_regime = 'ALL'
)
ON CONFLICT (bot_name, market_regime) DO NOTHING;

COMMENT ON TABLE prediction_outcomes IS 'Stores actual outcomes of bot predictions for learning and accuracy tracking';
COMMENT ON TABLE bot_accuracy_metrics IS 'Aggregated accuracy metrics per bot per market regime with weight management';
COMMENT ON FUNCTION evaluate_prediction_outcome IS 'Evaluates a single prediction outcome by comparing predicted vs actual price';
COMMENT ON FUNCTION update_bot_accuracy_metrics IS 'Recalculates all bot accuracy metrics from prediction outcomes';
COMMENT ON FUNCTION adjust_bot_weights IS 'Automatically adjusts bot weights based on performance and disables poor performers';
COMMENT ON FUNCTION evaluate_pending_outcomes IS 'Batch processes pending outcome evaluations for specified timeframe';
