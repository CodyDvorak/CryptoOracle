/*
  # Add Bot Performance History Tracking

  1. New Tables
    - `bot_performance_history`
      - `id` (uuid, primary key)
      - `bot_name` (text, indexed)
      - `accuracy_rate` (numeric)
      - `total_predictions` (integer)
      - `correct_predictions` (integer)
      - `avg_confidence` (numeric)
      - `market_regime` (text)
      - `recorded_at` (timestamptz)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `bot_performance_history` table
    - Add policy for authenticated users to read performance history

  3. Important Notes
    - Historical tracking for bot accuracy over time
    - Enables trend analysis and performance visualization
    - Automatically captures daily snapshots
*/

CREATE TABLE IF NOT EXISTS bot_performance_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_name text NOT NULL,
  accuracy_rate numeric NOT NULL DEFAULT 0,
  total_predictions integer NOT NULL DEFAULT 0,
  correct_predictions integer NOT NULL DEFAULT 0,
  avg_confidence numeric NOT NULL DEFAULT 0,
  market_regime text DEFAULT 'UNKNOWN',
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_performance_history_bot_name ON bot_performance_history(bot_name);
CREATE INDEX IF NOT EXISTS idx_bot_performance_history_recorded_at ON bot_performance_history(recorded_at DESC);

ALTER TABLE bot_performance_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read bot performance history"
  ON bot_performance_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert bot performance history"
  ON bot_performance_history FOR INSERT
  TO service_role
  WITH CHECK (true);