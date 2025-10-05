/*
  # Enable Realtime for Scan Tables

  This migration enables realtime subscriptions for the core scan tables
  so that the UI can receive instant updates when scans complete.

  1. Changes
    - Add scan_runs to realtime publication
    - Add recommendations to realtime publication
    - Add bot_predictions to realtime publication
  
  2. Impact
    - Dashboard will receive WebSocket updates when scans complete
    - Auto-refresh will work instantly (no polling needed)
    - "Start Scan" button will update state automatically
*/

-- Enable realtime for scan_runs table
ALTER PUBLICATION supabase_realtime ADD TABLE scan_runs;

-- Enable realtime for recommendations table
ALTER PUBLICATION supabase_realtime ADD TABLE recommendations;

-- Enable realtime for bot_predictions table
ALTER PUBLICATION supabase_realtime ADD TABLE bot_predictions;
