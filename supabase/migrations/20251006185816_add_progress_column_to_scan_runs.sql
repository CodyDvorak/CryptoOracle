/*
  # Add progress column to scan_runs table

  1. Changes
    - Add `progress` column to `scan_runs` table to track scan completion percentage
    - Default value is 0
    - Progress ranges from 0-100
  
  2. Security
    - No RLS changes needed (inherits existing policies)
*/

-- Add progress column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scan_runs' AND column_name = 'progress'
  ) THEN
    ALTER TABLE scan_runs ADD COLUMN progress integer DEFAULT 0;
  END IF;
END $$;
