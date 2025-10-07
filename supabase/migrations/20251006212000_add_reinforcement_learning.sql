/*
  # Reinforcement Learning Weight Optimizer

  ## Overview
  Implements a reinforcement learning (RL) approach to bot weight optimization:
  - Treats weight adjustment as an RL problem
  - Learns optimal weights through trial and error
  - Adapts faster than traditional statistical methods
  - Uses reward signals from actual trading performance

  ## RL Components
  - **State**: Market regime, bot recent performance, current weights
  - **Action**: Weight adjustment (increase, decrease, maintain)
  - **Reward**: Actual profit/loss from predictions
  - **Policy**: Learned strategy for weight adjustment

  ## Key Concepts
  - **Q-Learning**: Learn value of taking actions in states
  - **Exploration vs Exploitation**: Balance trying new weights vs using known good weights
  - **Temporal Credit Assignment**: Reward actions based on future outcomes
  - **Multi-Armed Bandit**: Treat each bot as an arm, learn which to "pull"

  ## New Tables
  - `rl_state_space` - Defines possible states
  - `rl_action_history` - Records actions taken and outcomes
  - `rl_q_table` - Stores learned Q-values for state-action pairs
  - `rl_policy` - Current policy for weight adjustment

  ## New Functions
  - `rl_get_current_state()` - Encodes current situation as state
  - `rl_select_action()` - Choose action using epsilon-greedy
  - `rl_update_q_values()` - Update Q-table with rewards
  - `rl_optimize_weights()` - Main RL optimization loop
*/

-- ==========================================
-- 1. RL STATE SPACE TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS rl_state_space (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_name text NOT NULL,

  -- State features
  market_regime text NOT NULL,
  performance_bucket text NOT NULL, -- 'EXCELLENT', 'GOOD', 'AVERAGE', 'POOR', 'VERY_POOR'
  current_weight_bucket text NOT NULL, -- 'VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'
  recent_trend text NOT NULL, -- 'IMPROVING', 'STABLE', 'DECLINING'
  correlation_level text NOT NULL, -- 'UNIQUE', 'MODERATE', 'REDUNDANT'

  -- State hash for quick lookup
  state_hash text GENERATED ALWAYS AS (
    bot_name || '_' ||
    market_regime || '_' ||
    performance_bucket || '_' ||
    current_weight_bucket || '_' ||
    recent_trend || '_' ||
    correlation_level
  ) STORED,

  -- Tracking
  times_encountered integer DEFAULT 0,
  last_seen timestamptz DEFAULT now(),

  UNIQUE(state_hash)
);

CREATE INDEX IF NOT EXISTS idx_rl_state_bot ON rl_state_space(bot_name);
CREATE INDEX IF NOT EXISTS idx_rl_state_hash ON rl_state_space(state_hash);

ALTER TABLE rl_state_space ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view RL state space"
  ON rl_state_space FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage RL state space"
  ON rl_state_space FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==========================================
-- 2. RL ACTION HISTORY TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS rl_action_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_name text NOT NULL,
  state_hash text NOT NULL,

  -- Action taken
  action_type text NOT NULL, -- 'INCREASE_WEIGHT', 'DECREASE_WEIGHT', 'MAINTAIN_WEIGHT'
  action_magnitude numeric, -- How much to change weight
  old_weight numeric NOT NULL,
  new_weight numeric NOT NULL,

  -- Context
  market_regime text NOT NULL,
  bot_accuracy_at_action numeric,

  -- Outcome (filled in later)
  immediate_reward numeric, -- Reward after next prediction
  delayed_reward numeric, -- Reward after multiple predictions
  cumulative_reward numeric, -- Total reward accumulated

  -- Tracking
  action_timestamp timestamptz DEFAULT now(),
  reward_calculated_at timestamptz,

  -- RL metadata
  was_exploration boolean DEFAULT false, -- Was this a random exploration?
  epsilon_value numeric, -- Exploration rate at time of action

  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rl_action_bot ON rl_action_history(bot_name);
CREATE INDEX IF NOT EXISTS idx_rl_action_state ON rl_action_history(state_hash);
CREATE INDEX IF NOT EXISTS idx_rl_action_timestamp ON rl_action_history(action_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_rl_action_type ON rl_action_history(action_type);

ALTER TABLE rl_action_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view RL action history"
  ON rl_action_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage RL action history"
  ON rl_action_history FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==========================================
-- 3. RL Q-TABLE (State-Action Values)
-- ==========================================

CREATE TABLE IF NOT EXISTS rl_q_table (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_hash text NOT NULL,
  action_type text NOT NULL,

  -- Q-value (expected future reward)
  q_value numeric DEFAULT 0,

  -- Tracking
  times_tried integer DEFAULT 0,
  times_successful integer DEFAULT 0, -- Led to positive reward
  avg_reward numeric DEFAULT 0,

  -- Confidence in Q-value (higher = more samples)
  confidence_score numeric DEFAULT 0,

  last_updated timestamptz DEFAULT now(),

  UNIQUE(state_hash, action_type)
);

CREATE INDEX IF NOT EXISTS idx_q_table_state ON rl_q_table(state_hash);
CREATE INDEX IF NOT EXISTS idx_q_table_action ON rl_q_table(action_type);
CREATE INDEX IF NOT EXISTS idx_q_table_value ON rl_q_table(q_value DESC);

ALTER TABLE rl_q_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view Q-table"
  ON rl_q_table FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage Q-table"
  ON rl_q_table FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==========================================
-- 4. RL POLICY TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS rl_policy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_version integer NOT NULL UNIQUE,

  -- Hyperparameters
  learning_rate numeric DEFAULT 0.1, -- Alpha: how much to update Q-values
  discount_factor numeric DEFAULT 0.95, -- Gamma: importance of future rewards
  epsilon numeric DEFAULT 0.2, -- Exploration rate (20% random actions)
  epsilon_decay numeric DEFAULT 0.995, -- Decay exploration over time

  -- Performance tracking
  total_actions integer DEFAULT 0,
  total_explorations integer DEFAULT 0,
  avg_reward numeric DEFAULT 0,
  policy_performance_score numeric DEFAULT 0,

  -- Active status
  is_active boolean DEFAULT true,
  activated_at timestamptz DEFAULT now(),
  deactivated_at timestamptz,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_policy_version ON rl_policy(policy_version DESC);
CREATE INDEX IF NOT EXISTS idx_policy_active ON rl_policy(is_active);

ALTER TABLE rl_policy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view RL policy"
  ON rl_policy FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage RL policy"
  ON rl_policy FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==========================================
-- 5. FUNCTION: Get Current State
-- ==========================================

CREATE OR REPLACE FUNCTION rl_get_current_state(p_bot_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_state_hash text;
  v_regime text;
  v_perf_bucket text;
  v_weight_bucket text;
  v_trend text;
  v_corr_level text;
  v_accuracy numeric;
  v_weight numeric;
  v_recent_accuracy numeric;
  v_past_accuracy numeric;
  v_avg_correlation numeric;
BEGIN
  -- Get bot metrics
  SELECT
    last_30_days_accuracy,
    current_weight
  INTO v_accuracy, v_weight
  FROM bot_accuracy_metrics
  WHERE bot_name = p_bot_name AND market_regime = 'ALL'
  LIMIT 1;

  -- Determine market regime (use most recent scan)
  SELECT market_regime INTO v_regime
  FROM bot_predictions
  WHERE bot_name = p_bot_name
  ORDER BY prediction_time DESC
  LIMIT 1;

  v_regime := COALESCE(v_regime, 'UNKNOWN');

  -- Performance bucket
  v_perf_bucket := CASE
    WHEN v_accuracy >= 0.70 THEN 'EXCELLENT'
    WHEN v_accuracy >= 0.60 THEN 'GOOD'
    WHEN v_accuracy >= 0.50 THEN 'AVERAGE'
    WHEN v_accuracy >= 0.35 THEN 'POOR'
    ELSE 'VERY_POOR'
  END;

  -- Weight bucket
  v_weight_bucket := CASE
    WHEN v_weight >= 1.5 THEN 'VERY_HIGH'
    WHEN v_weight >= 1.2 THEN 'HIGH'
    WHEN v_weight >= 0.8 THEN 'MEDIUM'
    WHEN v_weight >= 0.5 THEN 'LOW'
    ELSE 'VERY_LOW'
  END;

  -- Trend (comparing recent vs past performance)
  SELECT last_7_days_accuracy INTO v_recent_accuracy
  FROM bot_accuracy_metrics
  WHERE bot_name = p_bot_name AND market_regime = 'ALL';

  SELECT last_30_days_accuracy INTO v_past_accuracy
  FROM bot_accuracy_metrics
  WHERE bot_name = p_bot_name AND market_regime = 'ALL';

  v_trend := CASE
    WHEN v_recent_accuracy > v_past_accuracy + 0.10 THEN 'IMPROVING'
    WHEN v_recent_accuracy < v_past_accuracy - 0.10 THEN 'DECLINING'
    ELSE 'STABLE'
  END;

  -- Correlation level
  SELECT AVG(ABS(correlation_coefficient)) INTO v_avg_correlation
  FROM bot_correlation_matrix
  WHERE bot_name_a = p_bot_name OR bot_name_b = p_bot_name;

  v_corr_level := CASE
    WHEN v_avg_correlation < 0.3 THEN 'UNIQUE'
    WHEN v_avg_correlation < 0.7 THEN 'MODERATE'
    ELSE 'REDUNDANT'
  END;

  -- Create state hash
  v_state_hash := p_bot_name || '_' ||
                  v_regime || '_' ||
                  v_perf_bucket || '_' ||
                  v_weight_bucket || '_' ||
                  v_trend || '_' ||
                  v_corr_level;

  -- Insert or update state
  INSERT INTO rl_state_space (
    bot_name,
    market_regime,
    performance_bucket,
    current_weight_bucket,
    recent_trend,
    correlation_level,
    times_encountered,
    last_seen
  )
  VALUES (
    p_bot_name,
    v_regime,
    v_perf_bucket,
    v_weight_bucket,
    v_trend,
    v_corr_level,
    1,
    now()
  )
  ON CONFLICT (state_hash)
  DO UPDATE SET
    times_encountered = rl_state_space.times_encountered + 1,
    last_seen = now();

  RETURN v_state_hash;
END;
$$;

-- ==========================================
-- 6. FUNCTION: Select Action (Epsilon-Greedy)
-- ==========================================

CREATE OR REPLACE FUNCTION rl_select_action(
  p_state_hash text,
  p_epsilon numeric DEFAULT 0.2
)
RETURNS TABLE (
  action_type text,
  action_magnitude numeric,
  was_exploration boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_random numeric;
  v_best_action text;
  v_best_q_value numeric;
BEGIN
  v_random := random();

  -- Epsilon-greedy: explore with probability epsilon
  IF v_random < p_epsilon THEN
    -- EXPLORATION: Random action
    SELECT a.action_type, 0.1 as magnitude, true as exploration
    INTO action_type, action_magnitude, was_exploration
    FROM (
      VALUES ('INCREASE_WEIGHT'), ('DECREASE_WEIGHT'), ('MAINTAIN_WEIGHT')
    ) AS a(action_type)
    ORDER BY random()
    LIMIT 1;

  ELSE
    -- EXPLOITATION: Choose best known action
    SELECT qt.action_type, qt.q_value
    INTO v_best_action, v_best_q_value
    FROM rl_q_table qt
    WHERE qt.state_hash = p_state_hash
    ORDER BY qt.q_value DESC
    LIMIT 1;

    IF v_best_action IS NULL THEN
      -- No Q-values yet, default to maintain
      action_type := 'MAINTAIN_WEIGHT';
      action_magnitude := 0;
      was_exploration := false;
    ELSE
      action_type := v_best_action;
      action_magnitude := 0.1; -- Standard adjustment
      was_exploration := false;
    END IF;
  END IF;

  RETURN NEXT;
END;
$$;

-- ==========================================
-- 7. FUNCTION: Update Q-Values
-- ==========================================

CREATE OR REPLACE FUNCTION rl_update_q_values()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_action record;
  v_reward numeric;
  v_current_q numeric;
  v_max_future_q numeric;
  v_new_q numeric;
  v_alpha numeric;
  v_gamma numeric;
  v_count integer := 0;
BEGIN
  -- Get current policy parameters
  SELECT learning_rate, discount_factor
  INTO v_alpha, v_gamma
  FROM rl_policy
  WHERE is_active = true
  ORDER BY policy_version DESC
  LIMIT 1;

  v_alpha := COALESCE(v_alpha, 0.1);
  v_gamma := COALESCE(v_gamma, 0.95);

  -- Update Q-values for actions that have rewards
  FOR v_action IN
    SELECT
      ah.id,
      ah.state_hash,
      ah.action_type,
      ah.immediate_reward
    FROM rl_action_history ah
    WHERE ah.immediate_reward IS NOT NULL
      AND ah.reward_calculated_at >= now() - interval '1 hour'
  LOOP

    v_reward := v_action.immediate_reward;

    -- Get current Q-value
    SELECT q_value INTO v_current_q
    FROM rl_q_table
    WHERE state_hash = v_action.state_hash
      AND action_type = v_action.action_type;

    v_current_q := COALESCE(v_current_q, 0);

    -- Get max Q-value for next state (temporal difference learning)
    SELECT MAX(q_value) INTO v_max_future_q
    FROM rl_q_table
    WHERE state_hash LIKE split_part(v_action.state_hash, '_', 1) || '%';

    v_max_future_q := COALESCE(v_max_future_q, 0);

    -- Q-learning update: Q(s,a) = Q(s,a) + alpha * [reward + gamma * max(Q(s',a')) - Q(s,a)]
    v_new_q := v_current_q + v_alpha * (v_reward + v_gamma * v_max_future_q - v_current_q);

    -- Update Q-table
    INSERT INTO rl_q_table (state_hash, action_type, q_value, times_tried, avg_reward)
    VALUES (v_action.state_hash, v_action.action_type, v_new_q, 1, v_reward)
    ON CONFLICT (state_hash, action_type)
    DO UPDATE SET
      q_value = v_new_q,
      times_tried = rl_q_table.times_tried + 1,
      times_successful = rl_q_table.times_successful + CASE WHEN v_reward > 0 THEN 1 ELSE 0 END,
      avg_reward = (rl_q_table.avg_reward * rl_q_table.times_tried + v_reward) / (rl_q_table.times_tried + 1),
      confidence_score = LEAST(rl_q_table.times_tried / 100.0, 1.0),
      last_updated = now();

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ==========================================
-- 8. FUNCTION: RL Weight Optimization
-- ==========================================

CREATE OR REPLACE FUNCTION rl_optimize_weights()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bot record;
  v_state_hash text;
  v_action record;
  v_old_weight numeric;
  v_new_weight numeric;
  v_epsilon numeric;
  v_count integer := 0;
BEGIN
  -- Get current epsilon
  SELECT epsilon INTO v_epsilon
  FROM rl_policy
  WHERE is_active = true
  ORDER BY policy_version DESC
  LIMIT 1;

  v_epsilon := COALESCE(v_epsilon, 0.2);

  -- For each bot, get state and take action
  FOR v_bot IN
    SELECT bot_name, current_weight
    FROM bot_accuracy_metrics
    WHERE market_regime = 'ALL' AND is_enabled = true
  LOOP

    -- Get current state
    v_state_hash := rl_get_current_state(v_bot.bot_name);

    -- Select action
    SELECT * INTO v_action
    FROM rl_select_action(v_state_hash, v_epsilon)
    LIMIT 1;

    -- Calculate new weight
    v_old_weight := v_bot.current_weight;

    v_new_weight := CASE v_action.action_type
      WHEN 'INCREASE_WEIGHT' THEN LEAST(v_old_weight * 1.1, 2.0)
      WHEN 'DECREASE_WEIGHT' THEN GREATEST(v_old_weight * 0.9, 0.2)
      ELSE v_old_weight
    END;

    -- Apply weight change
    UPDATE bot_accuracy_metrics
    SET current_weight = v_new_weight
    WHERE bot_name = v_bot.bot_name AND market_regime = 'ALL';

    -- Record action
    INSERT INTO rl_action_history (
      bot_name,
      state_hash,
      action_type,
      action_magnitude,
      old_weight,
      new_weight,
      market_regime,
      bot_accuracy_at_action,
      was_exploration,
      epsilon_value
    )
    VALUES (
      v_bot.bot_name,
      v_state_hash,
      v_action.action_type,
      v_action.action_magnitude,
      v_old_weight,
      v_new_weight,
      split_part(v_state_hash, '_', 2),
      (SELECT last_30_days_accuracy FROM bot_accuracy_metrics
       WHERE bot_name = v_bot.bot_name AND market_regime = 'ALL'),
      v_action.was_exploration,
      v_epsilon
    );

    v_count := v_count + 1;
  END LOOP;

  -- Decay epsilon (reduce exploration over time)
  UPDATE rl_policy
  SET
    epsilon = epsilon * epsilon_decay,
    total_actions = total_actions + v_count
  WHERE is_active = true;

  RETURN v_count;
END;
$$;

-- ==========================================
-- 9. Initialize RL Policy
-- ==========================================

INSERT INTO rl_policy (
  policy_version,
  learning_rate,
  discount_factor,
  epsilon,
  epsilon_decay,
  is_active
)
VALUES (
  1,
  0.1, -- Alpha: moderate learning rate
  0.95, -- Gamma: value future rewards highly
  0.3, -- Epsilon: 30% exploration initially
  0.995, -- Decay: slowly reduce exploration
  true
)
ON CONFLICT (policy_version) DO NOTHING;

-- ==========================================
-- 10. SETUP CRON JOBS
-- ==========================================

-- RL weight optimization - daily
SELECT cron.schedule(
  'rl_optimize_weights',
  '0 6 * * *',
  $$
  SELECT rl_optimize_weights();
  $$
);

-- Update Q-values - every 6 hours
SELECT cron.schedule(
  'rl_update_q_values',
  '30 */6 * * *',
  $$
  SELECT rl_update_q_values();
  $$
);

COMMENT ON TABLE rl_state_space IS 'Defines state space for reinforcement learning weight optimization';
COMMENT ON TABLE rl_action_history IS 'Records actions taken and their outcomes for learning';
COMMENT ON TABLE rl_q_table IS 'Stores learned Q-values (expected rewards) for state-action pairs';
COMMENT ON TABLE rl_policy IS 'Current RL policy with hyperparameters';
COMMENT ON FUNCTION rl_optimize_weights IS 'Main RL loop: observe state, take action, learn from rewards';
