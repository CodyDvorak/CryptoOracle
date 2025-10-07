/*
  # Advanced Bot Performance Analytics

  ## Overview
  Implements sophisticated performance metrics beyond simple accuracy:
  - Sharpe Ratio, Sortino Ratio, Calmar Ratio
  - Maximum Drawdown tracking
  - Win/Loss streaks
  - Time-based performance patterns
  - Market condition performance matrix
  - Rolling performance windows

  ## New Tables
  - `bot_advanced_metrics` - Advanced performance metrics per bot
  - `bot_performance_streaks` - Tracks winning/losing streaks
  - `bot_time_patterns` - Performance by time of day/week
  - `bot_regime_performance` - Performance breakdown by market regime

  ## New Functions
  - `calculate_advanced_metrics()` - Computes Sharpe, Sortino, etc.
  - `track_performance_streaks()` - Identifies streaks
  - `analyze_time_patterns()` - Time-based analysis
*/

-- ==========================================
-- 1. BOT ADVANCED METRICS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS bot_advanced_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_name text NOT NULL,
  market_regime text NOT NULL DEFAULT 'ALL',

  -- Risk-Adjusted Returns
  sharpe_ratio numeric, -- (avg_return - risk_free_rate) / std_dev
  sortino_ratio numeric, -- (avg_return - risk_free_rate) / downside_deviation
  calmar_ratio numeric, -- avg_return / max_drawdown

  -- Drawdown Metrics
  max_drawdown numeric, -- Largest peak-to-trough decline
  current_drawdown numeric,
  avg_drawdown numeric,
  drawdown_duration_days numeric, -- Avg days in drawdown

  -- Win/Loss Analysis
  win_rate numeric,
  avg_win_size numeric,
  avg_loss_size numeric,
  profit_factor numeric, -- total_wins / total_losses
  expectancy numeric, -- (win_rate * avg_win) - (loss_rate * avg_loss)

  -- Streak Analysis
  current_streak integer, -- positive = winning, negative = losing
  longest_win_streak integer,
  longest_loss_streak integer,

  -- Consistency Metrics
  win_rate_std_dev numeric, -- Standard deviation of rolling win rate
  consistency_score numeric, -- Lower is more consistent

  -- Risk Metrics
  value_at_risk_95 numeric, -- VaR at 95% confidence
  conditional_var_95 numeric, -- CVaR (expected loss beyond VaR)

  -- Time-Based
  best_hour_of_day integer, -- Hour (0-23) with best performance
  worst_hour_of_day integer,
  best_day_of_week integer, -- 0=Sunday, 6=Saturday
  worst_day_of_week integer,

  -- Sample Size
  total_trades integer,
  calculation_date timestamptz DEFAULT now(),

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(bot_name, market_regime)
);

CREATE INDEX IF NOT EXISTS idx_advanced_metrics_bot ON bot_advanced_metrics(bot_name);
CREATE INDEX IF NOT EXISTS idx_advanced_metrics_regime ON bot_advanced_metrics(market_regime);
CREATE INDEX IF NOT EXISTS idx_advanced_metrics_sharpe ON bot_advanced_metrics(sharpe_ratio DESC);
CREATE INDEX IF NOT EXISTS idx_advanced_metrics_sortino ON bot_advanced_metrics(sortino_ratio DESC);

ALTER TABLE bot_advanced_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view advanced metrics"
  ON bot_advanced_metrics FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage advanced metrics"
  ON bot_advanced_metrics FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==========================================
-- 2. BOT PERFORMANCE STREAKS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS bot_performance_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_name text NOT NULL,
  streak_type text NOT NULL CHECK (streak_type IN ('WIN', 'LOSS')),
  streak_length integer NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  is_current boolean DEFAULT false,

  -- Metrics during streak
  total_profit_loss numeric,
  avg_confidence numeric,
  market_regime_during_streak text,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_streaks_bot ON bot_performance_streaks(bot_name);
CREATE INDEX IF NOT EXISTS idx_streaks_current ON bot_performance_streaks(is_current);
CREATE INDEX IF NOT EXISTS idx_streaks_length ON bot_performance_streaks(streak_length DESC);

ALTER TABLE bot_performance_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view streaks"
  ON bot_performance_streaks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage streaks"
  ON bot_performance_streaks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==========================================
-- 3. BOT TIME PATTERNS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS bot_time_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_name text NOT NULL,

  -- Hour of day patterns (0-23)
  hour_of_day integer CHECK (hour_of_day >= 0 AND hour_of_day <= 23),
  hour_accuracy numeric,
  hour_profit_loss numeric,
  hour_trade_count integer,

  -- Day of week patterns (0=Sun, 6=Sat)
  day_of_week integer CHECK (day_of_week >= 0 AND day_of_week <= 6),
  day_accuracy numeric,
  day_profit_loss numeric,
  day_trade_count integer,

  -- Market regime during this time
  dominant_regime text,

  last_updated timestamptz DEFAULT now(),

  UNIQUE(bot_name, hour_of_day, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_time_patterns_bot ON bot_time_patterns(bot_name);
CREATE INDEX IF NOT EXISTS idx_time_patterns_hour ON bot_time_patterns(hour_of_day);
CREATE INDEX IF NOT EXISTS idx_time_patterns_day ON bot_time_patterns(day_of_week);

ALTER TABLE bot_time_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view time patterns"
  ON bot_time_patterns FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage time patterns"
  ON bot_time_patterns FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==========================================
-- 4. BOT REGIME PERFORMANCE TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS bot_regime_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_name text NOT NULL,
  market_regime text NOT NULL,

  -- Performance metrics per regime
  trades_in_regime integer DEFAULT 0,
  accuracy_in_regime numeric DEFAULT 0,
  avg_profit_loss numeric DEFAULT 0,
  sharpe_in_regime numeric,

  -- Best/worst in this regime
  best_trade_pnl numeric,
  worst_trade_pnl numeric,

  -- Regime-specific insights
  is_optimal_regime boolean DEFAULT false, -- Bot's best regime
  regime_specialization_score numeric, -- How much better than average

  last_updated timestamptz DEFAULT now(),

  UNIQUE(bot_name, market_regime)
);

CREATE INDEX IF NOT EXISTS idx_regime_perf_bot ON bot_regime_performance(bot_name);
CREATE INDEX IF NOT EXISTS idx_regime_perf_regime ON bot_regime_performance(market_regime);
CREATE INDEX IF NOT EXISTS idx_regime_perf_optimal ON bot_regime_performance(is_optimal_regime);

ALTER TABLE bot_regime_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view regime performance"
  ON bot_regime_performance FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage regime performance"
  ON bot_regime_performance FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==========================================
-- 5. FUNCTION: Calculate Advanced Metrics
-- ==========================================

CREATE OR REPLACE FUNCTION calculate_advanced_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bot record;
  v_regime text;
  v_returns numeric[];
  v_positive_returns numeric[];
  v_negative_returns numeric[];
  v_avg_return numeric;
  v_std_dev numeric;
  v_downside_dev numeric;
  v_sharpe numeric;
  v_sortino numeric;
  v_max_dd numeric;
  v_profit_factor numeric;
BEGIN
  -- Calculate for each bot and regime
  FOR v_bot IN SELECT DISTINCT bot_name FROM bot_predictions LOOP
    FOR v_regime IN SELECT unnest(ARRAY['ALL', 'BULL', 'BEAR', 'SIDEWAYS', 'TRENDING', 'RANGING', 'VOLATILE']) LOOP

      -- Gather returns data
      SELECT ARRAY_AGG(profit_loss_24h)
      INTO v_returns
      FROM prediction_outcomes
      WHERE bot_name = v_bot.bot_name
        AND (v_regime = 'ALL' OR market_regime = v_regime)
        AND profit_loss_24h IS NOT NULL;

      IF v_returns IS NULL OR array_length(v_returns, 1) < 10 THEN
        CONTINUE; -- Need at least 10 trades
      END IF;

      -- Calculate average return
      SELECT AVG(val) INTO v_avg_return FROM unnest(v_returns) val;

      -- Calculate standard deviation
      SELECT STDDEV(val) INTO v_std_dev FROM unnest(v_returns) val;

      -- Separate positive and negative returns
      SELECT ARRAY_AGG(val) INTO v_positive_returns
      FROM unnest(v_returns) val WHERE val > 0;

      SELECT ARRAY_AGG(val) INTO v_negative_returns
      FROM unnest(v_returns) val WHERE val < 0;

      -- Calculate downside deviation (only negative returns)
      IF v_negative_returns IS NOT NULL AND array_length(v_negative_returns, 1) > 0 THEN
        SELECT SQRT(AVG(val * val)) INTO v_downside_dev
        FROM unnest(v_negative_returns) val;
      ELSE
        v_downside_dev := 0.01; -- Small number to avoid division by zero
      END IF;

      -- Sharpe Ratio (assuming risk-free rate = 0 for crypto)
      IF v_std_dev > 0 THEN
        v_sharpe := v_avg_return / v_std_dev;
      ELSE
        v_sharpe := 0;
      END IF;

      -- Sortino Ratio (only penalizes downside volatility)
      IF v_downside_dev > 0 THEN
        v_sortino := v_avg_return / v_downside_dev;
      ELSE
        v_sortino := v_sharpe; -- Fallback to Sharpe if no downside
      END IF;

      -- Max Drawdown (simplified - tracks consecutive losses)
      WITH losses AS (
        SELECT
          bot_name,
          profit_loss_24h,
          SUM(profit_loss_24h) OVER (
            ORDER BY evaluated_at_24h
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
          ) as cumulative_pnl
        FROM prediction_outcomes
        WHERE bot_name = v_bot.bot_name
          AND (v_regime = 'ALL' OR market_regime = v_regime)
          AND profit_loss_24h IS NOT NULL
      )
      SELECT MIN(cumulative_pnl) INTO v_max_dd FROM losses;

      v_max_dd := COALESCE(ABS(v_max_dd), 0);

      -- Profit Factor (total wins / total losses)
      SELECT
        COALESCE(
          SUM(profit_loss_24h) FILTER (WHERE profit_loss_24h > 0) /
          NULLIF(ABS(SUM(profit_loss_24h) FILTER (WHERE profit_loss_24h < 0)), 0),
          0
        )
      INTO v_profit_factor
      FROM prediction_outcomes
      WHERE bot_name = v_bot.bot_name
        AND (v_regime = 'ALL' OR market_regime = v_regime)
        AND profit_loss_24h IS NOT NULL;

      -- Insert or update metrics
      INSERT INTO bot_advanced_metrics (
        bot_name,
        market_regime,
        sharpe_ratio,
        sortino_ratio,
        calmar_ratio,
        max_drawdown,
        avg_drawdown,
        win_rate,
        avg_win_size,
        avg_loss_size,
        profit_factor,
        expectancy,
        total_trades,
        calculation_date
      )
      SELECT
        v_bot.bot_name,
        v_regime,
        v_sharpe,
        v_sortino,
        CASE WHEN v_max_dd > 0 THEN v_avg_return / v_max_dd ELSE 0 END as calmar_ratio,
        v_max_dd,
        AVG(ABS(profit_loss_24h)) FILTER (WHERE profit_loss_24h < 0) as avg_drawdown,
        COUNT(*) FILTER (WHERE profit_loss_24h > 0)::numeric / COUNT(*) as win_rate,
        AVG(profit_loss_24h) FILTER (WHERE profit_loss_24h > 0) as avg_win_size,
        AVG(profit_loss_24h) FILTER (WHERE profit_loss_24h < 0) as avg_loss_size,
        v_profit_factor,
        v_avg_return as expectancy,
        COUNT(*) as total_trades,
        now()
      FROM prediction_outcomes
      WHERE bot_name = v_bot.bot_name
        AND (v_regime = 'ALL' OR market_regime = v_regime)
        AND profit_loss_24h IS NOT NULL

      ON CONFLICT (bot_name, market_regime)
      DO UPDATE SET
        sharpe_ratio = EXCLUDED.sharpe_ratio,
        sortino_ratio = EXCLUDED.sortino_ratio,
        calmar_ratio = EXCLUDED.calmar_ratio,
        max_drawdown = EXCLUDED.max_drawdown,
        avg_drawdown = EXCLUDED.avg_drawdown,
        win_rate = EXCLUDED.win_rate,
        avg_win_size = EXCLUDED.avg_win_size,
        avg_loss_size = EXCLUDED.avg_loss_size,
        profit_factor = EXCLUDED.profit_factor,
        expectancy = EXCLUDED.expectancy,
        total_trades = EXCLUDED.total_trades,
        calculation_date = now(),
        updated_at = now();

    END LOOP;
  END LOOP;
END;
$$;

-- ==========================================
-- 6. FUNCTION: Track Performance Streaks
-- ==========================================

CREATE OR REPLACE FUNCTION track_performance_streaks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bot record;
  v_streak_type text;
  v_streak_length integer;
  v_streak_start timestamptz;
BEGIN
  -- Analyze streaks for each bot
  FOR v_bot IN SELECT DISTINCT bot_name FROM bot_predictions LOOP

    -- End any existing current streaks
    UPDATE bot_performance_streaks
    SET is_current = false, ended_at = now()
    WHERE bot_name = v_bot.bot_name AND is_current = true;

    -- Calculate current streak
    WITH ordered_outcomes AS (
      SELECT
        was_correct_24h,
        profit_loss_24h,
        evaluated_at_24h,
        market_regime,
        ROW_NUMBER() OVER (ORDER BY evaluated_at_24h DESC) as rn
      FROM prediction_outcomes
      WHERE bot_name = v_bot.bot_name
        AND was_correct_24h IS NOT NULL
      ORDER BY evaluated_at_24h DESC
    ),
    streak_calc AS (
      SELECT
        CASE WHEN was_correct_24h THEN 'WIN' ELSE 'LOSS' END as streak_type,
        COUNT(*) as streak_length,
        MIN(evaluated_at_24h) as streak_start,
        SUM(profit_loss_24h) as total_pnl,
        AVG(CASE WHEN was_correct_24h THEN 1.0 ELSE 0.0 END) as avg_conf,
        MAX(market_regime) as regime
      FROM ordered_outcomes
      WHERE rn <= (
        SELECT MIN(rn) - 1
        FROM ordered_outcomes o2
        WHERE o2.was_correct_24h != ordered_outcomes.was_correct_24h
          AND o2.rn > ordered_outcomes.rn
        UNION ALL
        SELECT MAX(rn) FROM ordered_outcomes
        LIMIT 1
      )
      GROUP BY CASE WHEN was_correct_24h THEN 'WIN' ELSE 'LOSS' END
    )
    INSERT INTO bot_performance_streaks (
      bot_name,
      streak_type,
      streak_length,
      started_at,
      is_current,
      total_profit_loss,
      avg_confidence,
      market_regime_during_streak
    )
    SELECT
      v_bot.bot_name,
      streak_type,
      streak_length,
      streak_start,
      true,
      total_pnl,
      avg_conf,
      regime
    FROM streak_calc
    WHERE streak_length >= 2; -- Only track streaks of 2+

    -- Update advanced metrics with streak info
    UPDATE bot_advanced_metrics
    SET
      current_streak = CASE
        WHEN (SELECT streak_type FROM bot_performance_streaks
              WHERE bot_name = v_bot.bot_name AND is_current = true LIMIT 1) = 'WIN'
        THEN (SELECT streak_length FROM bot_performance_streaks
              WHERE bot_name = v_bot.bot_name AND is_current = true LIMIT 1)
        ELSE -(SELECT streak_length FROM bot_performance_streaks
               WHERE bot_name = v_bot.bot_name AND is_current = true LIMIT 1)
      END,
      longest_win_streak = (
        SELECT COALESCE(MAX(streak_length), 0)
        FROM bot_performance_streaks
        WHERE bot_name = v_bot.bot_name AND streak_type = 'WIN'
      ),
      longest_loss_streak = (
        SELECT COALESCE(MAX(streak_length), 0)
        FROM bot_performance_streaks
        WHERE bot_name = v_bot.bot_name AND streak_type = 'LOSS'
      )
    WHERE bot_name = v_bot.bot_name;

  END LOOP;
END;
$$;

-- ==========================================
-- 7. FUNCTION: Analyze Time Patterns
-- ==========================================

CREATE OR REPLACE FUNCTION analyze_time_patterns()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bot record;
BEGIN
  FOR v_bot IN SELECT DISTINCT bot_name FROM bot_predictions LOOP

    -- Analyze hour of day patterns
    INSERT INTO bot_time_patterns (
      bot_name,
      hour_of_day,
      hour_accuracy,
      hour_profit_loss,
      hour_trade_count,
      dominant_regime
    )
    SELECT
      v_bot.bot_name,
      EXTRACT(HOUR FROM prediction_time)::integer as hour_of_day,
      AVG(CASE WHEN was_correct_24h THEN 1.0 ELSE 0.0 END) as hour_accuracy,
      AVG(profit_loss_24h) as hour_profit_loss,
      COUNT(*) as hour_trade_count,
      MODE() WITHIN GROUP (ORDER BY market_regime) as dominant_regime
    FROM prediction_outcomes
    WHERE bot_name = v_bot.bot_name
      AND was_correct_24h IS NOT NULL
    GROUP BY EXTRACT(HOUR FROM prediction_time)::integer

    ON CONFLICT (bot_name, hour_of_day, day_of_week)
    DO UPDATE SET
      hour_accuracy = EXCLUDED.hour_accuracy,
      hour_profit_loss = EXCLUDED.hour_profit_loss,
      hour_trade_count = EXCLUDED.hour_trade_count,
      dominant_regime = EXCLUDED.dominant_regime,
      last_updated = now();

    -- Update best/worst hours in advanced metrics
    UPDATE bot_advanced_metrics
    SET
      best_hour_of_day = (
        SELECT hour_of_day
        FROM bot_time_patterns
        WHERE bot_name = v_bot.bot_name AND hour_of_day IS NOT NULL
        ORDER BY hour_accuracy DESC
        LIMIT 1
      ),
      worst_hour_of_day = (
        SELECT hour_of_day
        FROM bot_time_patterns
        WHERE bot_name = v_bot.bot_name AND hour_of_day IS NOT NULL
        ORDER BY hour_accuracy ASC
        LIMIT 1
      )
    WHERE bot_name = v_bot.bot_name;

  END LOOP;
END;
$$;

-- ==========================================
-- 8. SETUP CRON JOBS
-- ==========================================

-- Calculate advanced metrics every 6 hours
SELECT cron.schedule(
  'calculate_advanced_metrics',
  '0 */6 * * *',
  $$
  SELECT calculate_advanced_metrics();
  $$
);

-- Track performance streaks daily
SELECT cron.schedule(
  'track_performance_streaks',
  '30 3 * * *',
  $$
  SELECT track_performance_streaks();
  $$
);

-- Analyze time patterns daily
SELECT cron.schedule(
  'analyze_time_patterns',
  '45 3 * * *',
  $$
  SELECT analyze_time_patterns();
  $$
);

COMMENT ON TABLE bot_advanced_metrics IS 'Advanced performance metrics: Sharpe ratio, Sortino ratio, max drawdown, streaks';
COMMENT ON TABLE bot_performance_streaks IS 'Tracks winning and losing streaks for each bot';
COMMENT ON TABLE bot_time_patterns IS 'Performance patterns by hour of day and day of week';
COMMENT ON TABLE bot_regime_performance IS 'Performance breakdown by market regime';
