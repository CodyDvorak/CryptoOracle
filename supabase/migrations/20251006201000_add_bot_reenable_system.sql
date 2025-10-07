/*
  # Add Bot Re-Enable System with Guardrails

  ## Problem
  Poor performers (<35% accuracy) are automatically disabled, but they should get
  a second chance after 7 days with stricter guardrails (the TP/SL guardrails we
  implemented earlier).

  ## Solution
  1. Auto-disable bots with <35% accuracy
  2. After 7 days, automatically re-enable them
  3. Apply stricter guardrails on re-enabled bots:
     - Tighter stop-loss (more conservative)
     - Lower leverage
     - Higher confidence threshold required
     - "Probation" status for monitoring
  4. If still poor after probation, disable permanently

  ## New Tables
  - `bot_probation_status` - Tracks bots on probation
  - `bot_guardrails` - Stores guardrail settings per bot

  ## New Functions
  - `reenable_bots_after_7_days()` - Re-enables disabled bots after 7 days
  - `apply_probation_guardrails()` - Applies stricter settings
  - `check_probation_performance()` - Monitors probation performance
*/

-- ==========================================
-- 1. BOT PROBATION STATUS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS bot_probation_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_name text NOT NULL UNIQUE,
  is_on_probation boolean DEFAULT false,

  -- Probation tracking
  probation_start_date timestamptz,
  probation_end_date timestamptz,
  probation_reason text,

  -- Performance during probation
  probation_predictions_count integer DEFAULT 0,
  probation_correct_count integer DEFAULT 0,
  probation_accuracy_rate numeric DEFAULT 0,

  -- Re-enable tracking
  times_disabled integer DEFAULT 0,
  times_reenabled integer DEFAULT 0,
  last_disabled_at timestamptz,
  last_reenabled_at timestamptz,

  -- Permanent disable
  permanently_disabled boolean DEFAULT false,
  permanent_disable_reason text,
  permanently_disabled_at timestamptz,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_probation_name ON bot_probation_status(bot_name);
CREATE INDEX IF NOT EXISTS idx_bot_probation_status ON bot_probation_status(is_on_probation);
CREATE INDEX IF NOT EXISTS idx_bot_probation_permanent ON bot_probation_status(permanently_disabled);

ALTER TABLE bot_probation_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view bot probation status"
  ON bot_probation_status FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage bot probation"
  ON bot_probation_status FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==========================================
-- 2. BOT GUARDRAILS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS bot_guardrails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_name text NOT NULL UNIQUE,

  -- Guardrail settings
  max_leverage numeric DEFAULT 5,
  min_confidence_required numeric DEFAULT 0.6,
  stop_loss_multiplier numeric DEFAULT 1.0, -- 1.0 = normal, 1.5 = tighter (50% tighter)
  take_profit_multiplier numeric DEFAULT 1.0,

  -- Risk management
  max_position_size_percent numeric DEFAULT 5.0,
  require_multiple_timeframe_confirmation boolean DEFAULT false,
  require_regime_alignment boolean DEFAULT false,

  -- Probation-specific
  is_probation_mode boolean DEFAULT false,
  probation_applied_at timestamptz,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_guardrails_name ON bot_guardrails(bot_name);
CREATE INDEX IF NOT EXISTS idx_bot_guardrails_probation ON bot_guardrails(is_probation_mode);

ALTER TABLE bot_guardrails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view bot guardrails"
  ON bot_guardrails FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage bot guardrails"
  ON bot_guardrails FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==========================================
-- 3. FUNCTION: Re-enable Bots After 7 Days
-- ==========================================

CREATE OR REPLACE FUNCTION reenable_bots_after_7_days()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer := 0;
  v_bot record;
BEGIN
  -- Find bots that have been disabled for 7+ days and aren't permanently disabled
  FOR v_bot IN
    SELECT
      bam.bot_name,
      bam.market_regime,
      bam.auto_disabled_at,
      bam.auto_disabled_reason,
      bam.accuracy_rate,
      bam.total_predictions
    FROM bot_accuracy_metrics bam
    LEFT JOIN bot_probation_status bps ON bps.bot_name = bam.bot_name
    WHERE bam.is_enabled = false
      AND bam.auto_disabled_at IS NOT NULL
      AND bam.auto_disabled_at <= now() - interval '7 days'
      AND bam.market_regime = 'ALL' -- Only process 'ALL' regime to avoid duplicates
      AND (bps.permanently_disabled IS NULL OR bps.permanently_disabled = false)
  LOOP

    -- Check if already on probation (this would be second+ chance)
    IF EXISTS (
      SELECT 1 FROM bot_probation_status
      WHERE bot_name = v_bot.bot_name
        AND times_reenabled >= 2
    ) THEN
      -- Third strike - permanently disable
      UPDATE bot_probation_status
      SET
        permanently_disabled = true,
        permanent_disable_reason = 'Failed after 2 probation periods',
        permanently_disabled_at = now()
      WHERE bot_name = v_bot.bot_name;

      CONTINUE;
    END IF;

    -- Re-enable the bot
    UPDATE bot_accuracy_metrics
    SET
      is_enabled = true,
      auto_disabled_at = NULL,
      auto_disabled_reason = NULL,
      last_updated = now()
    WHERE bot_name = v_bot.bot_name;

    -- Update bot_status_management
    UPDATE bot_status_management
    SET
      is_enabled = true,
      disabled_reason = NULL,
      last_modified = now()
    WHERE bot_name = v_bot.bot_name;

    -- Create or update probation status
    INSERT INTO bot_probation_status (
      bot_name,
      is_on_probation,
      probation_start_date,
      probation_end_date,
      probation_reason,
      times_reenabled,
      last_reenabled_at
    )
    VALUES (
      v_bot.bot_name,
      true,
      now(),
      now() + interval '14 days', -- 2 week probation
      format('Re-enabled after 7 days. Previous accuracy: %.1f%% over %s predictions',
        v_bot.accuracy_rate * 100, v_bot.total_predictions),
      1,
      now()
    )
    ON CONFLICT (bot_name)
    DO UPDATE SET
      is_on_probation = true,
      probation_start_date = now(),
      probation_end_date = now() + interval '14 days',
      probation_reason = format('Re-enabled after 7 days. Previous accuracy: %.1f%% over %s predictions',
        v_bot.accuracy_rate * 100, v_bot.total_predictions),
      times_reenabled = bot_probation_status.times_reenabled + 1,
      last_reenabled_at = now(),
      probation_predictions_count = 0,
      probation_correct_count = 0,
      probation_accuracy_rate = 0;

    -- Apply probation guardrails
    PERFORM apply_probation_guardrails(v_bot.bot_name);

    v_count := v_count + 1;

    RAISE NOTICE 'Re-enabled bot % with probation guardrails', v_bot.bot_name;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ==========================================
-- 4. FUNCTION: Apply Probation Guardrails
-- ==========================================

CREATE OR REPLACE FUNCTION apply_probation_guardrails(p_bot_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert or update guardrails with stricter settings
  INSERT INTO bot_guardrails (
    bot_name,
    max_leverage,
    min_confidence_required,
    stop_loss_multiplier,
    take_profit_multiplier,
    max_position_size_percent,
    require_multiple_timeframe_confirmation,
    require_regime_alignment,
    is_probation_mode,
    probation_applied_at
  )
  VALUES (
    p_bot_name,
    3, -- Reduced from typical 5
    0.70, -- Increased from 0.60
    1.5, -- 50% tighter stop-loss
    0.8, -- 20% closer take-profit (more conservative)
    2.0, -- Reduced from typical 5%
    true, -- Require multiple timeframes to agree
    true, -- Require regime alignment
    true,
    now()
  )
  ON CONFLICT (bot_name)
  DO UPDATE SET
    max_leverage = 3,
    min_confidence_required = 0.70,
    stop_loss_multiplier = 1.5,
    take_profit_multiplier = 0.8,
    max_position_size_percent = 2.0,
    require_multiple_timeframe_confirmation = true,
    require_regime_alignment = true,
    is_probation_mode = true,
    probation_applied_at = now(),
    updated_at = now();
END;
$$;

-- ==========================================
-- 5. FUNCTION: Check Probation Performance
-- ==========================================

CREATE OR REPLACE FUNCTION check_probation_performance()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer := 0;
  v_bot record;
BEGIN
  -- Check all bots currently on probation
  FOR v_bot IN
    SELECT
      bps.bot_name,
      bps.probation_predictions_count,
      bps.probation_correct_count,
      bps.probation_accuracy_rate,
      bps.probation_start_date,
      bps.probation_end_date,
      bps.times_reenabled
    FROM bot_probation_status bps
    WHERE bps.is_on_probation = true
      AND bps.probation_end_date <= now()
  LOOP

    -- Calculate probation accuracy
    UPDATE bot_probation_status
    SET probation_accuracy_rate = CASE
      WHEN probation_predictions_count > 0
      THEN probation_correct_count::numeric / probation_predictions_count
      ELSE 0
    END
    WHERE bot_name = v_bot.bot_name;

    -- Refresh the record
    SELECT * INTO v_bot
    FROM bot_probation_status
    WHERE bot_name = v_bot.bot_name;

    -- Evaluate probation performance
    IF v_bot.probation_predictions_count >= 20 THEN
      -- Enough data to evaluate

      IF v_bot.probation_accuracy_rate >= 0.50 THEN
        -- Passed probation! Remove guardrails
        UPDATE bot_probation_status
        SET
          is_on_probation = false,
          probation_start_date = NULL,
          probation_end_date = NULL
        WHERE bot_name = v_bot.bot_name;

        -- Remove probation guardrails (reset to normal)
        UPDATE bot_guardrails
        SET
          max_leverage = 5,
          min_confidence_required = 0.60,
          stop_loss_multiplier = 1.0,
          take_profit_multiplier = 1.0,
          max_position_size_percent = 5.0,
          require_multiple_timeframe_confirmation = false,
          require_regime_alignment = false,
          is_probation_mode = false
        WHERE bot_name = v_bot.bot_name;

        RAISE NOTICE 'Bot % passed probation with %.1f%% accuracy', v_bot.bot_name, v_bot.probation_accuracy_rate * 100;

      ELSE
        -- Failed probation - disable again
        UPDATE bot_accuracy_metrics
        SET
          is_enabled = false,
          auto_disabled_at = now(),
          auto_disabled_reason = format('Failed probation with %.1f%% accuracy over %s predictions',
            v_bot.probation_accuracy_rate * 100, v_bot.probation_predictions_count)
        WHERE bot_name = v_bot.bot_name;

        UPDATE bot_status_management
        SET
          is_enabled = false,
          disabled_reason = format('Failed probation with %.1f%% accuracy',
            v_bot.probation_accuracy_rate * 100)
        WHERE bot_name = v_bot.bot_name;

        UPDATE bot_probation_status
        SET
          is_on_probation = false,
          times_disabled = times_disabled + 1,
          last_disabled_at = now()
        WHERE bot_name = v_bot.bot_name;

        RAISE NOTICE 'Bot % failed probation with %.1f%% accuracy', v_bot.bot_name, v_bot.probation_accuracy_rate * 100;
      END IF;

      v_count := v_count + 1;

    ELSE
      -- Not enough data yet - extend probation by 7 days
      UPDATE bot_probation_status
      SET probation_end_date = probation_end_date + interval '7 days'
      WHERE bot_name = v_bot.bot_name;

      RAISE NOTICE 'Bot % probation extended - only %s predictions so far', v_bot.bot_name, v_bot.probation_predictions_count;
    END IF;

  END LOOP;

  RETURN v_count;
END;
$$;

-- ==========================================
-- 6. FUNCTION: Track Probation Predictions
-- ==========================================

-- This function should be called after each prediction evaluation
CREATE OR REPLACE FUNCTION update_probation_tracking(
  p_bot_name text,
  p_was_correct boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update probation tracking if bot is on probation
  UPDATE bot_probation_status
  SET
    probation_predictions_count = probation_predictions_count + 1,
    probation_correct_count = probation_correct_count + CASE WHEN p_was_correct THEN 1 ELSE 0 END,
    probation_accuracy_rate = CASE
      WHEN probation_predictions_count + 1 > 0
      THEN (probation_correct_count + CASE WHEN p_was_correct THEN 1 ELSE 0 END)::numeric / (probation_predictions_count + 1)
      ELSE 0
    END,
    updated_at = now()
  WHERE bot_name = p_bot_name
    AND is_on_probation = true;
END;
$$;

-- ==========================================
-- 7. UPDATE ADJUST_BOT_WEIGHTS TO TRACK DISABLES
-- ==========================================

-- Modify the existing adjust_bot_weights to track disable counts
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
    WHERE total_predictions >= 10
  LOOP

    v_new_weight := v_bot.current_weight;

    IF v_bot.last_30_days_accuracy > 0.70 AND v_bot.total_predictions >= 20 THEN
      v_weight_change := 0.30;
      v_new_weight := LEAST(v_bot.current_weight * (1 + v_weight_change), 2.0);

    ELSIF v_bot.last_30_days_accuracy > 0.60 AND v_bot.total_predictions >= 20 THEN
      v_weight_change := 0.10;
      v_new_weight := LEAST(v_bot.current_weight * (1 + v_weight_change), 1.5);

    ELSIF v_bot.last_30_days_accuracy >= 0.50 THEN
      v_new_weight := v_bot.current_weight;

    ELSIF v_bot.last_30_days_accuracy < 0.50 AND v_bot.total_predictions >= 20 THEN
      v_weight_change := -0.50;
      v_new_weight := GREATEST(v_bot.current_weight * (1 + v_weight_change), 0.2);

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

      -- Track in probation status
      INSERT INTO bot_probation_status (bot_name, times_disabled, last_disabled_at)
      VALUES (v_bot.bot_name, 1, now())
      ON CONFLICT (bot_name)
      DO UPDATE SET
        times_disabled = bot_probation_status.times_disabled + 1,
        last_disabled_at = now();

      CONTINUE;
    END IF;

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
-- 8. SETUP CRON JOBS
-- ==========================================

-- Re-enable bots after 7 days - runs daily
SELECT cron.schedule(
  'reenable_bots_after_7_days',
  '0 5 * * *', -- Daily at 5 AM
  $$
  SELECT reenable_bots_after_7_days();
  $$
);

-- Check probation performance - runs daily
SELECT cron.schedule(
  'check_probation_performance',
  '30 5 * * *', -- Daily at 5:30 AM
  $$
  SELECT check_probation_performance();
  $$
);

COMMENT ON TABLE bot_probation_status IS 'Tracks bots on probation after being re-enabled with stricter guardrails';
COMMENT ON TABLE bot_guardrails IS 'Stores guardrail settings (leverage, stop-loss, confidence thresholds) per bot';
COMMENT ON FUNCTION reenable_bots_after_7_days IS 'Automatically re-enables disabled bots after 7 days with probation guardrails';
COMMENT ON FUNCTION apply_probation_guardrails IS 'Applies stricter guardrails to bots on probation (lower leverage, tighter stops)';
COMMENT ON FUNCTION check_probation_performance IS 'Evaluates probation performance and either removes guardrails or permanently disables bot';
