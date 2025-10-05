/*
  # Add Market Correlation Analysis Tables

  1. New Tables
    - `market_correlations`
      - `id` (uuid, primary key)
      - `base_asset` (text) - The primary asset (e.g., BTC)
      - `correlated_asset` (text) - The correlated asset (e.g., ETH)
      - `correlation_coefficient` (numeric) - Value between -1 and 1
      - `timeframe` (text) - 1h, 4h, 1d, 1w
      - `period_days` (integer) - Number of days analyzed
      - `strength` (text) - STRONG, MODERATE, WEAK
      - `direction` (text) - POSITIVE, NEGATIVE
      - `updated_at` (timestamptz)
      - `created_at` (timestamptz)

    - `correlation_snapshots`
      - `id` (uuid, primary key)
      - `snapshot_date` (timestamptz)
      - `btc_dominance` (numeric)
      - `market_sentiment` (text)
      - `top_correlations` (jsonb)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on tables
    - Allow public read access (authenticated users)
*/

CREATE TABLE IF NOT EXISTS market_correlations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_asset text NOT NULL,
  correlated_asset text NOT NULL,
  correlation_coefficient numeric NOT NULL CHECK (correlation_coefficient >= -1 AND correlation_coefficient <= 1),
  timeframe text NOT NULL CHECK (timeframe IN ('1h', '4h', '1d', '1w')),
  period_days integer NOT NULL,
  strength text NOT NULL CHECK (strength IN ('STRONG', 'MODERATE', 'WEAK')),
  direction text NOT NULL CHECK (direction IN ('POSITIVE', 'NEGATIVE')),
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(base_asset, correlated_asset, timeframe)
);

CREATE INDEX IF NOT EXISTS idx_market_correlations_base ON market_correlations(base_asset);
CREATE INDEX IF NOT EXISTS idx_market_correlations_correlated ON market_correlations(correlated_asset);
CREATE INDEX IF NOT EXISTS idx_market_correlations_strength ON market_correlations(strength);

ALTER TABLE market_correlations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view correlations"
  ON market_correlations FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS correlation_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date timestamptz NOT NULL DEFAULT now(),
  btc_dominance numeric,
  market_sentiment text CHECK (market_sentiment IN ('BULLISH', 'BEARISH', 'NEUTRAL')),
  top_correlations jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_correlation_snapshots_date ON correlation_snapshots(snapshot_date DESC);

ALTER TABLE correlation_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view snapshots"
  ON correlation_snapshots FOR SELECT
  TO authenticated
  USING (true);
