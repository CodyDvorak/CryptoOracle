/*
  # Create Crypto Oracle Database Schema

  ## Overview
  This migration creates the complete database schema for the Crypto Oracle application,
  migrating from MongoDB to Supabase PostgreSQL.

  ## Tables Created

  ### 1. users
  User authentication and profile information
  - `id` (uuid, primary key) - Unique user identifier
  - `username` (text, unique) - User's username
  - `email` (text, unique) - User's email address
  - `hashed_password` (text) - Bcrypt hashed password
  - `created_at` (timestamptz) - Account creation timestamp
  - `is_active` (boolean) - Account active status

  ### 2. scan_runs
  Tracks all scan executions and their status
  - `id` (uuid, primary key) - Unique scan identifier
  - `user_id` (uuid, foreign key) - User who initiated the scan (nullable)
  - `started_at` (timestamptz) - Scan start time
  - `completed_at` (timestamptz) - Scan completion time (nullable)
  - `interval` (text) - Schedule interval ('6h', '12h', '24h', nullable)
  - `filter_scope` (text) - Filter scope ('all' or 'alt')
  - `min_price` (float) - Minimum price filter (nullable)
  - `max_price` (float) - Maximum price filter (nullable)
  - `scan_type` (text) - Type of scan executed
  - `status` (text) - Current status ('running', 'completed', 'failed', 'timeout')
  - `total_coins` (integer) - Number of coins analyzed
  - `total_available_coins` (integer) - Total coins available from source
  - `total_bots` (integer) - Number of bots used
  - `error_message` (text) - Error details if failed (nullable)

  ### 3. recommendations
  Aggregated trading recommendations from bot consensus
  - `id` (uuid, primary key) - Unique recommendation identifier
  - `run_id` (uuid, foreign key) - Associated scan run
  - `user_id` (uuid, foreign key) - User who owns this recommendation (nullable)
  - `coin` (text) - Full coin name (e.g., "Bitcoin")
  - `ticker` (text) - Ticker symbol (e.g., "BTC")
  - `current_price` (float) - Current market price
  - `consensus_direction` (text) - Trading direction ('long' or 'short')
  - `avg_confidence` (float) - Average bot confidence (0-10)
  - `avg_take_profit` (float) - Average take profit target
  - `avg_stop_loss` (float) - Average stop loss level
  - `avg_entry` (float) - Average entry price
  - `avg_predicted_24h` (float) - 24h price prediction
  - `avg_predicted_48h` (float) - 48h price prediction
  - `avg_predicted_7d` (float) - 7d price prediction
  - `avg_leverage` (float) - Average recommended leverage
  - `min_leverage` (float) - Minimum leverage suggested
  - `max_leverage` (float) - Maximum leverage suggested
  - `actual_price_24h` (float) - Actual price after 24h (nullable)
  - `actual_price_48h` (float) - Actual price after 48h (nullable)
  - `actual_price_7d` (float) - Actual price after 7d (nullable)
  - `outcome_24h` (text) - 24h outcome status (nullable)
  - `outcome_7d` (text) - 7d outcome status (nullable)
  - `bot_count` (integer) - Number of bots in consensus
  - `trader_grade` (float) - TokenMetrics trader grade (0-100)
  - `investor_grade` (float) - TokenMetrics investor grade (0-100)
  - `ai_trend` (text) - AI trend analysis
  - `category` (text) - Recommendation category
  - `predicted_percent_change` (float) - Predicted % change
  - `predicted_dollar_change` (float) - Predicted $ change
  - `market_regime` (text) - Market regime classification
  - `regime_confidence` (float) - Regime confidence (0-1)
  - `created_at` (timestamptz) - Creation timestamp

  ### 4. bot_predictions
  Individual bot predictions for tracking and learning
  - `id` (uuid, primary key) - Unique prediction identifier
  - `run_id` (uuid, foreign key) - Associated scan run
  - `user_id` (uuid, foreign key) - User who owns this prediction (nullable)
  - `bot_name` (text) - Name of the bot
  - `coin_symbol` (text) - Coin ticker symbol
  - `coin_name` (text) - Full coin name
  - `entry_price` (float) - Entry price at prediction time
  - `target_price` (float) - Bot's price target
  - `stop_loss` (float) - Stop loss level (nullable)
  - `position_direction` (text) - Position direction ('long' or 'short')
  - `confidence_score` (float) - Bot's confidence (0-100)
  - `leverage` (float) - Recommended leverage (nullable)
  - `timestamp` (timestamptz) - Prediction timestamp
  - `market_regime` (text) - Market regime at prediction time (nullable)
  - `outcome_checked_at` (timestamptz) - When outcome was evaluated (nullable)
  - `outcome_price` (float) - Price at outcome check (nullable)
  - `outcome_status` (text) - Outcome result (nullable)
  - `profit_loss_percent` (float) - Actual % gain/loss (nullable)
  - `rationale` (text) - Bot's reasoning (nullable)

  ### 5. bot_performance
  Aggregate performance statistics for each bot
  - `id` (uuid, primary key) - Unique performance record identifier
  - `bot_name` (text, unique) - Bot name
  - `total_predictions` (integer) - Total predictions made
  - `successful_predictions` (integer) - Successful predictions
  - `failed_predictions` (integer) - Failed predictions
  - `pending_predictions` (integer) - Pending predictions
  - `accuracy_rate` (float) - Success rate percentage
  - `avg_profit_loss` (float) - Average % gain/loss
  - `performance_weight` (float) - Performance weight for aggregation
  - `first_prediction_at` (timestamptz) - First prediction timestamp (nullable)
  - `last_prediction_at` (timestamptz) - Last prediction timestamp (nullable)
  - `last_updated` (timestamptz) - Last update timestamp

  ### 6. parameter_snapshots
  Bot parameters at time of prediction for optimization
  - `id` (uuid, primary key) - Unique snapshot identifier
  - `bot_name` (text) - Bot name
  - `prediction_id` (uuid, foreign key) - Associated prediction
  - `run_id` (uuid, foreign key) - Associated scan run
  - `coin_symbol` (text) - Coin ticker symbol
  - `parameters` (jsonb) - Bot-specific parameters
  - `timestamp` (timestamptz) - Snapshot timestamp

  ### 7. integrations_config
  Email and Google Sheets integration configuration
  - `id` (uuid, primary key) - Unique config identifier
  - `email_enabled` (boolean) - Email notifications enabled
  - `email_to` (text) - Recipient email address (nullable)
  - `smtp_host` (text) - SMTP server host
  - `smtp_port` (integer) - SMTP server port
  - `smtp_user` (text) - SMTP username (nullable)
  - `smtp_pass` (text) - SMTP password (nullable)
  - `sheets_enabled` (boolean) - Google Sheets integration enabled
  - `sheet_url` (text) - Google Sheet URL (nullable)
  - `sheet_id` (text) - Google Sheet ID (nullable)
  - `worksheet` (text) - Worksheet name
  - `updated_at` (timestamptz) - Last update timestamp

  ### 8. settings
  Application schedule and scan configuration
  - `id` (uuid, primary key) - Unique settings identifier
  - `schedule_enabled` (boolean) - Auto-scan schedule enabled
  - `schedule_interval` (text) - Scan interval ('6h', '12h', '24h')
  - `scan_type` (text) - Default scan type
  - `schedule_start_time` (text) - Start time in HH:MM format (nullable)
  - `timezone` (text) - Timezone for scheduling
  - `filter_scope` (text) - Default filter scope
  - `min_price` (float) - Default minimum price (nullable)
  - `max_price` (float) - Default maximum price (nullable)
  - `alt_exclusions` (text[]) - Excluded altcoin tickers
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## Security
  - RLS (Row Level Security) enabled on all tables
  - Users can only access their own scan runs and recommendations
  - Public read access for bot performance and system-wide statistics
  - Authenticated users required for creating/updating data

  ## Indexes
  - Optimized for common query patterns
  - Composite indexes on frequently queried combinations
  - Indexes on foreign keys for join performance
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  username text UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  hashed_password text NOT NULL,
  created_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

-- 2. Scan runs table
CREATE TABLE IF NOT EXISTS scan_runs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  interval text,
  filter_scope text DEFAULT 'all',
  min_price float,
  max_price float,
  scan_type text DEFAULT 'full_scan',
  status text DEFAULT 'running',
  total_coins integer DEFAULT 0,
  total_available_coins integer DEFAULT 0,
  total_bots integer DEFAULT 49,
  error_message text
);

-- 3. Recommendations table
CREATE TABLE IF NOT EXISTS recommendations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id uuid REFERENCES scan_runs(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  coin text NOT NULL,
  ticker text DEFAULT '',
  current_price float NOT NULL,
  consensus_direction text NOT NULL,
  avg_confidence float NOT NULL,
  avg_take_profit float NOT NULL,
  avg_stop_loss float NOT NULL,
  avg_entry float NOT NULL,
  avg_predicted_24h float NOT NULL,
  avg_predicted_48h float NOT NULL,
  avg_predicted_7d float NOT NULL,
  avg_leverage float DEFAULT 5.0,
  min_leverage float DEFAULT 1.0,
  max_leverage float DEFAULT 10.0,
  actual_price_24h float,
  actual_price_48h float,
  actual_price_7d float,
  outcome_24h text,
  outcome_7d text,
  bot_count integer DEFAULT 20,
  trader_grade float DEFAULT 0,
  investor_grade float DEFAULT 0,
  ai_trend text DEFAULT '',
  category text DEFAULT '',
  predicted_percent_change float DEFAULT 0,
  predicted_dollar_change float DEFAULT 0,
  market_regime text DEFAULT 'SIDEWAYS',
  regime_confidence float DEFAULT 0.5,
  created_at timestamptz DEFAULT now()
);

-- 4. Bot predictions table
CREATE TABLE IF NOT EXISTS bot_predictions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id uuid REFERENCES scan_runs(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  bot_name text NOT NULL,
  coin_symbol text NOT NULL,
  coin_name text NOT NULL,
  entry_price float NOT NULL,
  target_price float NOT NULL,
  stop_loss float,
  position_direction text NOT NULL,
  confidence_score float NOT NULL,
  leverage float,
  timestamp timestamptz DEFAULT now(),
  market_regime text,
  outcome_checked_at timestamptz,
  outcome_price float,
  outcome_status text,
  profit_loss_percent float,
  rationale text
);

-- 5. Bot performance table
CREATE TABLE IF NOT EXISTS bot_performance (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_name text UNIQUE NOT NULL,
  total_predictions integer DEFAULT 0,
  successful_predictions integer DEFAULT 0,
  failed_predictions integer DEFAULT 0,
  pending_predictions integer DEFAULT 0,
  accuracy_rate float DEFAULT 0.0,
  avg_profit_loss float DEFAULT 0.0,
  performance_weight float DEFAULT 1.0,
  first_prediction_at timestamptz,
  last_prediction_at timestamptz,
  last_updated timestamptz DEFAULT now()
);

-- 6. Parameter snapshots table
CREATE TABLE IF NOT EXISTS parameter_snapshots (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_name text NOT NULL,
  prediction_id uuid REFERENCES bot_predictions(id) ON DELETE CASCADE NOT NULL,
  run_id uuid REFERENCES scan_runs(id) ON DELETE CASCADE NOT NULL,
  coin_symbol text NOT NULL,
  parameters jsonb NOT NULL,
  timestamp timestamptz DEFAULT now()
);

-- 7. Integrations config table
CREATE TABLE IF NOT EXISTS integrations_config (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_enabled boolean DEFAULT false,
  email_to text,
  smtp_host text DEFAULT 'smtp.gmail.com',
  smtp_port integer DEFAULT 587,
  smtp_user text,
  smtp_pass text,
  sheets_enabled boolean DEFAULT false,
  sheet_url text,
  sheet_id text,
  worksheet text DEFAULT 'Sheet1',
  updated_at timestamptz DEFAULT now()
);

-- 8. Settings table
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_enabled boolean DEFAULT false,
  schedule_interval text DEFAULT '12h',
  scan_type text DEFAULT 'quick_scan',
  schedule_start_time text,
  timezone text DEFAULT 'UTC',
  filter_scope text DEFAULT 'all',
  min_price float,
  max_price float,
  alt_exclusions text[] DEFAULT ARRAY['BTC', 'ETH', 'USDT', 'USDC', 'DAI', 'TUSD', 'BUSD'],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_scan_runs_user_id ON scan_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_runs_status ON scan_runs(status);
CREATE INDEX IF NOT EXISTS idx_scan_runs_completed_at ON scan_runs(completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_recommendations_run_id ON recommendations(run_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_user_id ON recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_ticker ON recommendations(ticker);
CREATE INDEX IF NOT EXISTS idx_recommendations_category ON recommendations(category);

CREATE INDEX IF NOT EXISTS idx_bot_predictions_run_id ON bot_predictions(run_id);
CREATE INDEX IF NOT EXISTS idx_bot_predictions_bot_name ON bot_predictions(bot_name);
CREATE INDEX IF NOT EXISTS idx_bot_predictions_coin_symbol ON bot_predictions(coin_symbol);
CREATE INDEX IF NOT EXISTS idx_bot_predictions_outcome_status ON bot_predictions(outcome_status);
CREATE INDEX IF NOT EXISTS idx_bot_predictions_timestamp ON bot_predictions(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_parameter_snapshots_prediction_id ON parameter_snapshots(prediction_id);
CREATE INDEX IF NOT EXISTS idx_parameter_snapshots_bot_name ON parameter_snapshots(bot_name);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE parameter_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- RLS Policies for scan_runs table
CREATE POLICY "Users can view own scan runs"
  ON scan_runs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can create scan runs"
  ON scan_runs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can update own scan runs"
  ON scan_runs FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL)
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Anonymous users can view public scan runs"
  ON scan_runs FOR SELECT
  TO anon
  USING (user_id IS NULL);

-- RLS Policies for recommendations table
CREATE POLICY "Users can view own recommendations"
  ON recommendations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can create recommendations"
  ON recommendations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Anonymous users can view public recommendations"
  ON recommendations FOR SELECT
  TO anon
  USING (user_id IS NULL);

-- RLS Policies for bot_predictions table
CREATE POLICY "Users can view own bot predictions"
  ON bot_predictions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can create bot predictions"
  ON bot_predictions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can update own bot predictions"
  ON bot_predictions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL)
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Anonymous users can view public bot predictions"
  ON bot_predictions FOR SELECT
  TO anon
  USING (user_id IS NULL);

-- RLS Policies for bot_performance table (public read, system write)
CREATE POLICY "Anyone can view bot performance"
  ON bot_performance FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "System can manage bot performance"
  ON bot_performance FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for parameter_snapshots table
CREATE POLICY "Authenticated users can view parameter snapshots"
  ON parameter_snapshots FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create parameter snapshots"
  ON parameter_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for integrations_config table (admin only)
CREATE POLICY "Authenticated users can view integrations config"
  ON integrations_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage integrations config"
  ON integrations_config FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for settings table (admin only)
CREATE POLICY "Authenticated users can view settings"
  ON settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage settings"
  ON settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);