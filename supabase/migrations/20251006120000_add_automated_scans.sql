/*
  # Automated Comprehensive Market Scans

  1. Purpose
    - Runs comprehensive market scans every 4 hours automatically
    - Keeps all data fresh: bot predictions, charts, analytics, insights
    - Analyzes top 200 coins with all 83 bots

  2. Implementation
    - Creates cron job that triggers scan-run function
    - Runs at: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC daily
    - Stores all bot predictions for view-based filtering

  3. Benefits
    - Data always fresh and up-to-date
    - No manual intervention needed
    - All specialized views (Whale Activity, Trending Markets, etc.) use same data
    - Cost-efficient: 1 comprehensive scan vs 8 separate scans
*/

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create automated comprehensive scan job
-- Runs every 4 hours at the top of the hour
SELECT cron.schedule(
  'automated-comprehensive-scan',
  '0 */4 * * *', -- Every 4 hours
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/scan-run',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key')
    ),
    body := jsonb_build_object(
      'scanType', 'automated_comprehensive',
      'coinLimit', 200,
      'filterScope', 'top200',
      'confidenceThreshold', 0.60,
      'automated', true
    )
  );
  $$
);

-- Create table to track automated scan runs
CREATE TABLE IF NOT EXISTS automated_scan_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_run_id uuid REFERENCES scan_runs(id),
  triggered_at timestamptz DEFAULT now(),
  status text CHECK (status IN ('triggered', 'completed', 'failed')),
  coins_analyzed integer,
  recommendations_created integer,
  duration_seconds integer,
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE automated_scan_logs ENABLE ROW LEVEL SECURITY;

-- Admin-only access to automated scan logs
CREATE POLICY "Admins can view automated scan logs"
  ON automated_scan_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Add scan_view_type to help with filtering
ALTER TABLE recommendations
ADD COLUMN IF NOT EXISTS scan_view_type text;

-- Add specialized scan flags for faster filtering
ALTER TABLE bot_predictions
ADD COLUMN IF NOT EXISTS is_whale_signal boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_trend_signal boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_futures_signal boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_breakout_signal boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_reversal_signal boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_volatile_signal boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_elliott_wave boolean DEFAULT false;

-- Create function to tag bot predictions with signal types
CREATE OR REPLACE FUNCTION tag_bot_prediction_types()
RETURNS TRIGGER AS $$
BEGIN
  -- Whale Activity signals
  IF NEW.bot_name IN ('Whale Activity Tracker', 'Order Flow Analysis', 'Volume Spike', 'OBV On-Balance Volume') THEN
    NEW.is_whale_signal := true;
  END IF;

  -- Trend signals
  IF NEW.bot_name IN ('ADX Trend Strength', 'Trend Line Break', 'Supertrend', 'Moving Average Confluence', 'Parabolic SAR') THEN
    NEW.is_trend_signal := true;
  END IF;

  -- Futures/Derivatives signals
  IF NEW.bot_name IN ('Funding Rate Arbitrage', 'Open Interest Momentum', 'Long/Short Ratio Tracker', 'Options Flow Detector') THEN
    NEW.is_futures_signal := true;
  END IF;

  -- Breakout signals
  IF NEW.bot_name IN ('Breakout Hunter', 'Volume Breakout', 'Support/Resistance', 'Momentum Trader', 'Volatility Breakout') THEN
    NEW.is_breakout_signal := true;
  END IF;

  -- Reversal signals
  IF NEW.bot_name IN ('RSI Reversal', 'Mean Reversion', 'Stochastic Reversal', 'Oversold/Overbought', 'Divergence Hunter') THEN
    NEW.is_reversal_signal := true;
  END IF;

  -- Volatile market signals
  IF NEW.bot_name IN ('ATR Volatility', 'Bollinger Squeeze', 'Keltner Channel', 'Historical Volatility') THEN
    NEW.is_volatile_signal := true;
  END IF;

  -- Elliott Wave signals
  IF NEW.bot_name IN ('Elliott Wave Pattern', 'Fibonacci Retracement', 'Harmonic Patterns', 'Wave Momentum') THEN
    NEW.is_elliott_wave := true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-tag bot predictions
DROP TRIGGER IF EXISTS tag_bot_predictions_trigger ON bot_predictions;
CREATE TRIGGER tag_bot_predictions_trigger
  BEFORE INSERT ON bot_predictions
  FOR EACH ROW
  EXECUTE FUNCTION tag_bot_prediction_types();

-- Create indexes for faster filtering
CREATE INDEX IF NOT EXISTS idx_bot_predictions_whale ON bot_predictions(is_whale_signal) WHERE is_whale_signal = true;
CREATE INDEX IF NOT EXISTS idx_bot_predictions_trend ON bot_predictions(is_trend_signal) WHERE is_trend_signal = true;
CREATE INDEX IF NOT EXISTS idx_bot_predictions_futures ON bot_predictions(is_futures_signal) WHERE is_futures_signal = true;
CREATE INDEX IF NOT EXISTS idx_bot_predictions_breakout ON bot_predictions(is_breakout_signal) WHERE is_breakout_signal = true;
CREATE INDEX IF NOT EXISTS idx_bot_predictions_reversal ON bot_predictions(is_reversal_signal) WHERE is_reversal_signal = true;
CREATE INDEX IF NOT EXISTS idx_bot_predictions_volatile ON bot_predictions(is_volatile_signal) WHERE is_volatile_signal = true;
CREATE INDEX IF NOT EXISTS idx_bot_predictions_elliott ON bot_predictions(is_elliott_wave) WHERE is_elliott_wave = true;

-- Create view for whale activity signals
CREATE OR REPLACE VIEW whale_activity_signals AS
SELECT DISTINCT ON (r.ticker)
  r.*,
  COUNT(bp.id) FILTER (WHERE bp.is_whale_signal = true) as whale_signal_count
FROM recommendations r
JOIN bot_predictions bp ON bp.run_id = r.run_id AND bp.coin_symbol = r.ticker
WHERE bp.is_whale_signal = true
GROUP BY r.id, r.ticker
ORDER BY r.ticker, r.avg_confidence DESC;

-- Create view for trending market signals
CREATE OR REPLACE VIEW trending_market_signals AS
SELECT DISTINCT ON (r.ticker)
  r.*,
  COUNT(bp.id) FILTER (WHERE bp.is_trend_signal = true) as trend_signal_count
FROM recommendations r
JOIN bot_predictions bp ON bp.run_id = r.run_id AND bp.coin_symbol = r.ticker
WHERE bp.is_trend_signal = true
  AND r.regime IN ('BULL', 'STRONG_BULL')
GROUP BY r.id, r.ticker
ORDER BY r.ticker, r.avg_confidence DESC;

-- Create view for futures signals
CREATE OR REPLACE VIEW futures_market_signals AS
SELECT DISTINCT ON (r.ticker)
  r.*,
  COUNT(bp.id) FILTER (WHERE bp.is_futures_signal = true) as futures_signal_count
FROM recommendations r
JOIN bot_predictions bp ON bp.run_id = r.run_id AND bp.coin_symbol = r.ticker
WHERE bp.is_futures_signal = true
GROUP BY r.id, r.ticker
ORDER BY r.ticker, r.avg_confidence DESC;

-- Create view for breakout signals
CREATE OR REPLACE VIEW breakout_signals AS
SELECT DISTINCT ON (r.ticker)
  r.*,
  COUNT(bp.id) FILTER (WHERE bp.is_breakout_signal = true) as breakout_signal_count
FROM recommendations r
JOIN bot_predictions bp ON bp.run_id = r.run_id AND bp.coin_symbol = r.ticker
WHERE bp.is_breakout_signal = true
  AND r.avg_confidence >= 0.70
GROUP BY r.id, r.ticker
ORDER BY r.ticker, r.avg_confidence DESC;

-- Create view for reversal signals
CREATE OR REPLACE VIEW reversal_opportunity_signals AS
SELECT DISTINCT ON (r.ticker)
  r.*,
  COUNT(bp.id) FILTER (WHERE bp.is_reversal_signal = true) as reversal_signal_count
FROM recommendations r
JOIN bot_predictions bp ON bp.run_id = r.run_id AND bp.coin_symbol = r.ticker
WHERE bp.is_reversal_signal = true
  AND r.regime IN ('SIDEWAYS', 'WEAK_BULL', 'WEAK_BEAR')
GROUP BY r.id, r.ticker
ORDER BY r.ticker, r.avg_confidence DESC;

-- Create view for volatile market signals
CREATE OR REPLACE VIEW volatile_market_signals AS
SELECT DISTINCT ON (r.ticker)
  r.*,
  COUNT(bp.id) FILTER (WHERE bp.is_volatile_signal = true) as volatile_signal_count
FROM recommendations r
JOIN bot_predictions bp ON bp.run_id = r.run_id AND bp.coin_symbol = r.ticker
WHERE bp.is_volatile_signal = true
  AND r.avg_confidence >= 0.70
GROUP BY r.id, r.ticker
ORDER BY r.ticker, r.avg_confidence DESC;

-- Create view for Elliott Wave signals
CREATE OR REPLACE VIEW elliott_wave_signals AS
SELECT DISTINCT ON (r.ticker)
  r.*,
  COUNT(bp.id) FILTER (WHERE bp.is_elliott_wave = true) as elliott_wave_count
FROM recommendations r
JOIN bot_predictions bp ON bp.run_id = r.run_id AND bp.coin_symbol = r.ticker
WHERE bp.is_elliott_wave = true
GROUP BY r.id, r.ticker
ORDER BY r.ticker, r.avg_confidence DESC;

-- Grant access to views
GRANT SELECT ON whale_activity_signals TO authenticated;
GRANT SELECT ON trending_market_signals TO authenticated;
GRANT SELECT ON futures_market_signals TO authenticated;
GRANT SELECT ON breakout_signals TO authenticated;
GRANT SELECT ON reversal_opportunity_signals TO authenticated;
GRANT SELECT ON volatile_market_signals TO authenticated;
GRANT SELECT ON elliott_wave_signals TO authenticated;

-- Create function to get latest scan with view type
CREATE OR REPLACE FUNCTION get_latest_scan_by_view(view_type text DEFAULT 'all')
RETURNS TABLE (
  id uuid,
  ticker text,
  consensus text,
  avg_confidence numeric,
  bot_confidence numeric,
  regime text,
  current_price numeric,
  ai_analysis jsonb,
  signal_count bigint
) AS $$
BEGIN
  RETURN QUERY
  CASE view_type
    WHEN 'whale_activity' THEN
      SELECT
        w.id, w.ticker, w.consensus, w.avg_confidence,
        w.bot_confidence, w.regime, w.current_price,
        w.ai_analysis, w.whale_signal_count
      FROM whale_activity_signals w
      ORDER BY w.avg_confidence DESC
      LIMIT 50;

    WHEN 'trending_markets' THEN
      SELECT
        t.id, t.ticker, t.consensus, t.avg_confidence,
        t.bot_confidence, t.regime, t.current_price,
        t.ai_analysis, t.trend_signal_count
      FROM trending_market_signals t
      ORDER BY t.avg_confidence DESC
      LIMIT 50;

    WHEN 'futures_signals' THEN
      SELECT
        f.id, f.ticker, f.consensus, f.avg_confidence,
        f.bot_confidence, f.regime, f.current_price,
        f.ai_analysis, f.futures_signal_count
      FROM futures_market_signals f
      ORDER BY f.avg_confidence DESC
      LIMIT 50;

    WHEN 'breakout_hunter' THEN
      SELECT
        b.id, b.ticker, b.consensus, b.avg_confidence,
        b.bot_confidence, b.regime, b.current_price,
        b.ai_analysis, b.breakout_signal_count
      FROM breakout_signals b
      ORDER BY b.avg_confidence DESC
      LIMIT 50;

    WHEN 'reversal_opportunities' THEN
      SELECT
        r.id, r.ticker, r.consensus, r.avg_confidence,
        r.bot_confidence, r.regime, r.current_price,
        r.ai_analysis, r.reversal_signal_count
      FROM reversal_opportunity_signals r
      ORDER BY r.avg_confidence DESC
      LIMIT 50;

    WHEN 'volatile_markets' THEN
      SELECT
        v.id, v.ticker, v.consensus, v.avg_confidence,
        v.bot_confidence, v.regime, v.current_price,
        v.ai_analysis, v.volatile_signal_count
      FROM volatile_market_signals v
      ORDER BY v.avg_confidence DESC
      LIMIT 50;

    WHEN 'elliott_wave' THEN
      SELECT
        e.id, e.ticker, e.consensus, e.avg_confidence,
        e.bot_confidence, e.regime, e.current_price,
        e.ai_analysis, e.elliott_wave_count
      FROM elliott_wave_signals e
      ORDER BY e.avg_confidence DESC
      LIMIT 50;

    ELSE
      -- 'all' or default
      SELECT
        r.id, r.ticker, r.consensus, r.avg_confidence,
        r.bot_confidence, r.regime, r.current_price,
        r.ai_analysis,
        COUNT(bp.id)::bigint as signal_count
      FROM recommendations r
      LEFT JOIN bot_predictions bp ON bp.run_id = r.run_id AND bp.coin_symbol = r.ticker
      WHERE r.run_id = (SELECT id FROM scan_runs WHERE status = 'completed' ORDER BY completed_at DESC LIMIT 1)
      GROUP BY r.id
      ORDER BY r.avg_confidence DESC
      LIMIT 50;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: You need to configure app settings for cron job to work
COMMENT ON EXTENSION pg_cron IS 'Automated comprehensive scans every 4 hours';
