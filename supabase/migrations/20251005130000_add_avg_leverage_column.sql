/*
  # Add Average Leverage Column

  1. Changes
    - Add `avg_leverage` column to `scan_recommendations` table
    - Default value of 3.0 for existing records
    - Allow null for records without leverage data

  2. Purpose
    - Store aggregated leverage recommendations from bots
    - Display average leverage on recommendation cards
*/

-- Add avg_leverage column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scan_recommendations' AND column_name = 'avg_leverage'
  ) THEN
    ALTER TABLE scan_recommendations ADD COLUMN avg_leverage numeric(4,2) DEFAULT 3.0;
  END IF;
END $$;
