/*
  # Add Price History Table for Real-Time Tracking

  1. New Tables
    - `price_history`
      - `id` (bigint, primary key, auto-increment)
      - `symbol` (text, coin symbol like BTC, ETH)
      - `price` (numeric, USD price)
      - `timestamp` (timestamptz, when price was recorded)
      - `source` (text, data source: binance_ws, cmc, coingecko, etc)
      - `created_at` (timestamptz)

  2. Changes
    - Add indexes for fast lookups by symbol and timestamp
    - Enable RLS with permissive policies for reading
    - Partition ready for future scaling

  3. Security
    - Enable RLS
    - Allow authenticated users to read price history
    - Only system/service role can insert prices

  4. Performance
    - Index on (symbol, timestamp DESC) for bot performance queries
    - Index on (created_at) for cleanup operations
*/

-- Create price_history table
CREATE TABLE IF NOT EXISTS price_history (
  id bigserial PRIMARY KEY,
  symbol text NOT NULL,
  price numeric(20, 8) NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'binance_ws',
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_price_history_symbol_timestamp 
  ON price_history(symbol, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_price_history_created_at 
  ON price_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_price_history_symbol_source 
  ON price_history(symbol, source);

-- Enable RLS
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read price history
CREATE POLICY "Users can read price history"
  ON price_history
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role to insert prices
CREATE POLICY "Service role can insert prices"
  ON price_history
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Create function to clean old price history (keep last 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_price_history()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM price_history
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$;

-- Add comment
COMMENT ON TABLE price_history IS 'Real-time price tracking for accurate bot performance evaluation';
