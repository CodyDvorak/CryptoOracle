/*
  # Add Alerts and Multi-Timeframe Features

  1. New Tables
    - `user_alerts`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `alert_type` (text: price, signal, regime_change, high_confidence)
      - `coin_symbol` (text, optional)
      - `threshold_value` (numeric, optional)
      - `is_active` (boolean)
      - `last_triggered` (timestamptz)
      - `created_at` (timestamptz)

    - `timeframe_analyses`
      - `id` (uuid, primary key)
      - `run_id` (uuid, foreign key to scan_runs)
      - `coin_symbol` (text)
      - `timeframe` (text: 1h, 4h, 1d, 1w)
      - `regime` (text: BULL, BEAR, SIDEWAYS)
      - `confidence` (numeric)
      - `reasons` (jsonb)
      - `created_at` (timestamptz)

    - `social_sentiment`
      - `id` (uuid, primary key)
      - `coin_symbol` (text)
      - `source` (text: reddit, cryptopanic, newsapi)
      - `sentiment_score` (numeric -1 to 1)
      - `volume` (integer)
      - `summary` (text)
      - `fetched_at` (timestamptz)

    - `onchain_data`
      - `id` (uuid, primary key)
      - `coin_symbol` (text)
      - `whale_transactions` (jsonb)
      - `exchange_flows` (jsonb)
      - `network_activity` (jsonb)
      - `fetched_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- User Alerts Table
CREATE TABLE IF NOT EXISTS user_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  alert_type text NOT NULL CHECK (alert_type IN ('price', 'signal', 'regime_change', 'high_confidence')),
  coin_symbol text,
  threshold_value numeric,
  is_active boolean DEFAULT true,
  last_triggered timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alerts"
  ON user_alerts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own alerts"
  ON user_alerts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own alerts"
  ON user_alerts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own alerts"
  ON user_alerts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Timeframe Analyses Table
CREATE TABLE IF NOT EXISTS timeframe_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES scan_runs(id) ON DELETE CASCADE NOT NULL,
  coin_symbol text NOT NULL,
  timeframe text NOT NULL CHECK (timeframe IN ('1h', '4h', '1d', '1w')),
  regime text NOT NULL CHECK (regime IN ('BULL', 'BEAR', 'SIDEWAYS')),
  confidence numeric NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  reasons jsonb DEFAULT '[]'::jsonb,
  alignment_score numeric,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE timeframe_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view timeframe analyses"
  ON timeframe_analyses FOR SELECT
  TO authenticated
  USING (true);

-- Social Sentiment Table
CREATE TABLE IF NOT EXISTS social_sentiment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coin_symbol text NOT NULL,
  source text NOT NULL CHECK (source IN ('reddit', 'cryptopanic', 'newsapi', 'twitter')),
  sentiment_score numeric NOT NULL CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
  volume integer DEFAULT 0,
  summary text,
  raw_data jsonb,
  fetched_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_sentiment_coin ON social_sentiment(coin_symbol);
CREATE INDEX IF NOT EXISTS idx_social_sentiment_fetched ON social_sentiment(fetched_at DESC);

ALTER TABLE social_sentiment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view social sentiment"
  ON social_sentiment FOR SELECT
  TO authenticated
  USING (true);

-- On-Chain Data Table
CREATE TABLE IF NOT EXISTS onchain_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coin_symbol text NOT NULL,
  whale_transactions jsonb DEFAULT '[]'::jsonb,
  exchange_inflows numeric DEFAULT 0,
  exchange_outflows numeric DEFAULT 0,
  net_flow numeric DEFAULT 0,
  active_addresses integer DEFAULT 0,
  transaction_volume numeric DEFAULT 0,
  hash_rate numeric,
  raw_data jsonb,
  fetched_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onchain_coin ON onchain_data(coin_symbol);
CREATE INDEX IF NOT EXISTS idx_onchain_fetched ON onchain_data(fetched_at DESC);

ALTER TABLE onchain_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view onchain data"
  ON onchain_data FOR SELECT
  TO authenticated
  USING (true);

-- Backtesting Results Table
CREATE TABLE IF NOT EXISTS backtest_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  total_signals integer DEFAULT 0,
  winning_signals integer DEFAULT 0,
  losing_signals integer DEFAULT 0,
  accuracy_rate numeric,
  avg_profit_loss numeric,
  max_drawdown numeric,
  sharpe_ratio numeric,
  regime_performance jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_backtest_bot ON backtest_results(bot_name);
CREATE INDEX IF NOT EXISTS idx_backtest_date ON backtest_results(start_date, end_date);

ALTER TABLE backtest_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view backtest results"
  ON backtest_results FOR SELECT
  TO authenticated
  USING (true);

-- Add multi-timeframe columns to recommendations
ALTER TABLE recommendations
ADD COLUMN IF NOT EXISTS timeframe_alignment_score numeric,
ADD COLUMN IF NOT EXISTS dominant_timeframe_regime text,
ADD COLUMN IF NOT EXISTS confidence_boost numeric DEFAULT 1.0;

-- Add sentiment and onchain columns
ALTER TABLE recommendations
ADD COLUMN IF NOT EXISTS social_sentiment_score numeric,
ADD COLUMN IF NOT EXISTS onchain_signal text,
ADD COLUMN IF NOT EXISTS ai_analysis text;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_alerts_user ON user_alerts(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON user_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_timeframe_run ON timeframe_analyses(run_id, coin_symbol);
