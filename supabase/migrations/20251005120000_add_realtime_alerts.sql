/*
  # Real-Time Alerts System

  This migration adds infrastructure for real-time whale alerts and market alerts:

  1. New Tables
    - `whale_alerts`: Tracks large cryptocurrency transactions
    - `market_alerts`: Stores breaking news and critical market events

  2. Security
    - Enable RLS on all tables
    - Authenticated users can read alerts
    - Service role manages inserts via edge functions

  3. Indexes
    - Performance indexes for timestamp-based queries
    - Coin symbol indexes for filtering

  4. Realtime
    - Enable realtime for INSERT operations
*/

-- Whale Alerts Table
CREATE TABLE IF NOT EXISTS whale_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coin_symbol text NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('BUY', 'SELL', 'TRANSFER')),
  amount numeric(20,4) NOT NULL,
  usd_value numeric(20,2),
  from_address text,
  to_address text,
  transaction_hash text,
  blockchain text,
  detected_at timestamptz DEFAULT now(),
  source text DEFAULT 'whale_watch',
  created_at timestamptz DEFAULT now()
);

-- Market Alerts Table
CREATE TABLE IF NOT EXISTS market_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL CHECK (alert_type IN ('breaking_news', 'regulatory', 'technical', 'critical')),
  alert_message text NOT NULL,
  coin_symbols text[] DEFAULT '{}',
  severity text CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  source text,
  source_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  triggered_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_whale_alerts_coin ON whale_alerts(coin_symbol);
CREATE INDEX IF NOT EXISTS idx_whale_alerts_detected ON whale_alerts(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_whale_alerts_amount ON whale_alerts(amount DESC);

CREATE INDEX IF NOT EXISTS idx_market_alerts_type ON market_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_market_alerts_triggered ON market_alerts(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_alerts_severity ON market_alerts(severity);

-- Enable RLS
ALTER TABLE whale_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can read whale alerts"
  ON whale_alerts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read market alerts"
  ON market_alerts FOR SELECT
  TO authenticated
  USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE whale_alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE market_alerts;
