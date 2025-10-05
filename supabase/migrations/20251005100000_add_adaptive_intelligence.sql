/*
  # Adaptive Intelligence System

  This migration creates the infrastructure for advanced adaptive intelligence features:

  1. New Tables
    - `bot_parameters`: Stores optimized parameters per bot per regime
    - `bot_parameter_optimization_history`: Tracks parameter optimization experiments
    - `bot_training_states`: Stores reinforcement learning model states
    - `bot_training_episodes`: Tracks training episodes and rewards
    - `bot_status_management`: Manages bot enable/disable states and cooldowns
    - `bot_admin_overrides`: Tracks manual admin interventions

  2. Security
    - Enable RLS on all tables
    - Authenticated users can read bot parameters and status
    - Only service role can update training states and parameters

  3. Indexes
    - Performance indexes for bot lookups, regime filtering, and date-based queries
*/

-- Bot Parameters Table: Stores optimized parameters per bot per regime
CREATE TABLE IF NOT EXISTS bot_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_name text NOT NULL,
  market_regime text NOT NULL CHECK (market_regime IN ('BULL', 'BEAR', 'SIDEWAYS', 'VOLATILE', 'ALL')),
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  performance_score numeric(5,2) DEFAULT 0.0,
  sample_size integer DEFAULT 0,
  last_optimized timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(bot_name, market_regime)
);

-- Parameter Optimization History: Tracks all optimization experiments
CREATE TABLE IF NOT EXISTS bot_parameter_optimization_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_name text NOT NULL,
  market_regime text NOT NULL,
  parameters_tested jsonb NOT NULL,
  backtest_results jsonb NOT NULL,
  accuracy_rate numeric(5,2) DEFAULT 0.0,
  profit_loss numeric(10,2) DEFAULT 0.0,
  sharpe_ratio numeric(5,2) DEFAULT 0.0,
  max_drawdown numeric(5,2) DEFAULT 0.0,
  trade_count integer DEFAULT 0,
  optimization_duration_ms integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Bot Training States: Stores reinforcement learning model states
CREATE TABLE IF NOT EXISTS bot_training_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_name text NOT NULL UNIQUE,
  model_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  q_table jsonb DEFAULT '{}'::jsonb,
  state_value_function jsonb DEFAULT '{}'::jsonb,
  policy_parameters jsonb DEFAULT '{}'::jsonb,
  total_episodes integer DEFAULT 0,
  total_rewards numeric(10,2) DEFAULT 0.0,
  avg_reward numeric(10,2) DEFAULT 0.0,
  learning_rate numeric(5,4) DEFAULT 0.001,
  epsilon numeric(5,4) DEFAULT 0.1,
  last_trained timestamptz DEFAULT now(),
  training_version integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Bot Training Episodes: Tracks individual training episodes
CREATE TABLE IF NOT EXISTS bot_training_episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_name text NOT NULL,
  episode_number integer NOT NULL,
  state_features jsonb NOT NULL,
  action_taken jsonb NOT NULL,
  reward numeric(10,4) NOT NULL,
  next_state_features jsonb,
  prediction_id uuid,
  market_regime text,
  profit_loss_percent numeric(10,4),
  episode_timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Bot Status Management: Manages bot enable/disable states
CREATE TABLE IF NOT EXISTS bot_status_management (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_name text NOT NULL UNIQUE,
  is_enabled boolean DEFAULT true,
  status_reason text,
  auto_disabled_at timestamptz,
  cooldown_until timestamptz,
  accuracy_rate numeric(5,2) DEFAULT 0.0,
  total_predictions integer DEFAULT 0,
  successful_predictions integer DEFAULT 0,
  failed_predictions integer DEFAULT 0,
  consecutive_poor_performance integer DEFAULT 0,
  last_performance_check timestamptz DEFAULT now(),
  last_status_change timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Bot Admin Overrides: Tracks manual admin interventions
CREATE TABLE IF NOT EXISTS bot_admin_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_name text NOT NULL,
  override_type text NOT NULL CHECK (override_type IN ('force_enable', 'force_disable', 'reset_cooldown', 'parameter_lock')),
  override_reason text NOT NULL,
  overridden_by uuid,
  override_metadata jsonb DEFAULT '{}'::jsonb,
  expires_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bot_params_name ON bot_parameters(bot_name);
CREATE INDEX IF NOT EXISTS idx_bot_params_regime ON bot_parameters(market_regime);
CREATE INDEX IF NOT EXISTS idx_bot_params_active ON bot_parameters(is_active);

CREATE INDEX IF NOT EXISTS idx_bot_param_history_name ON bot_parameter_optimization_history(bot_name);
CREATE INDEX IF NOT EXISTS idx_bot_param_history_regime ON bot_parameter_optimization_history(market_regime);
CREATE INDEX IF NOT EXISTS idx_bot_param_history_created ON bot_parameter_optimization_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bot_training_states_name ON bot_training_states(bot_name);
CREATE INDEX IF NOT EXISTS idx_bot_training_states_updated ON bot_training_states(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_bot_training_episodes_name ON bot_training_episodes(bot_name);
CREATE INDEX IF NOT EXISTS idx_bot_training_episodes_number ON bot_training_episodes(episode_number);
CREATE INDEX IF NOT EXISTS idx_bot_training_episodes_timestamp ON bot_training_episodes(episode_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_bot_status_name ON bot_status_management(bot_name);
CREATE INDEX IF NOT EXISTS idx_bot_status_enabled ON bot_status_management(is_enabled);
CREATE INDEX IF NOT EXISTS idx_bot_status_cooldown ON bot_status_management(cooldown_until);

CREATE INDEX IF NOT EXISTS idx_bot_admin_overrides_name ON bot_admin_overrides(bot_name);
CREATE INDEX IF NOT EXISTS idx_bot_admin_overrides_active ON bot_admin_overrides(is_active);
CREATE INDEX IF NOT EXISTS idx_bot_admin_overrides_type ON bot_admin_overrides(override_type);

-- Enable RLS
ALTER TABLE bot_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_parameter_optimization_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_training_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_training_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_status_management ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_admin_overrides ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow authenticated users to read
CREATE POLICY "Authenticated users can read bot parameters"
  ON bot_parameters FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read optimization history"
  ON bot_parameter_optimization_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read training states"
  ON bot_training_states FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read training episodes"
  ON bot_training_episodes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read bot status"
  ON bot_status_management FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read admin overrides"
  ON bot_admin_overrides FOR SELECT
  TO authenticated
  USING (true);

-- Service role can manage all tables (inserts/updates happen via edge functions)
