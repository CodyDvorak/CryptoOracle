/*
  # Add Portfolio and Alert Features

  ## New Tables

  ### 1. portfolios
  User portfolio tracking with holdings and performance
  - `id` (uuid, primary key) - Unique portfolio identifier
  - `user_id` (uuid, foreign key) - Portfolio owner
  - `holdings` (jsonb) - Array of holdings with quantity and buy price
  - `total_value` (float) - Current total portfolio value
  - `total_cost` (float) - Total cost basis
  - `total_profit_loss` (float) - Total unrealized P/L
  - `total_profit_loss_pct` (float) - Total P/L percentage
  - `created_at` (timestamptz) - Portfolio creation time
  - `updated_at` (timestamptz) - Last update time

  ### 2. alerts
  Price and pattern alerts with notification settings
  - `id` (text, primary key) - Unique alert identifier
  - `user_id` (uuid, foreign key) - Alert owner
  - `symbol` (text) - Coin symbol to monitor
  - `alert_type` (text) - Type: 'price_above', 'price_below', 'percent_change', 'ai_pattern'
  - `condition` (jsonb) - Alert condition parameters
  - `notification_channels` (jsonb) - Array of channels: ['email', 'in_app']
  - `status` (text) - Status: 'active', 'triggered', 'paused'
  - `triggered_count` (integer) - Number of times triggered
  - `created_at` (timestamptz) - Alert creation time
  - `last_checked` (timestamptz) - Last check time
  - `last_triggered` (timestamptz) - Last trigger time

  ### 3. notifications
  In-app notifications for users
  - `id` (uuid, primary key) - Unique notification identifier
  - `user_id` (uuid, foreign key) - Notification recipient
  - `type` (text) - Notification type: 'alert', 'scan_complete', 'info'
  - `title` (text) - Notification title
  - `message` (text) - Notification message
  - `data` (jsonb) - Additional data payload
  - `read` (boolean) - Read status
  - `created_at` (timestamptz) - Creation time

  ## Security
  - Enable RLS on all tables
  - Users can only access their own portfolios, alerts, and notifications
*/

-- Create portfolios table
CREATE TABLE IF NOT EXISTS portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  holdings jsonb DEFAULT '[]'::jsonb,
  total_value float DEFAULT 0,
  total_cost float DEFAULT 0,
  total_profit_loss float DEFAULT 0,
  total_profit_loss_pct float DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  alert_type text NOT NULL,
  condition jsonb NOT NULL,
  notification_channels jsonb DEFAULT '["in_app"]'::jsonb,
  status text DEFAULT 'active',
  triggered_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  last_checked timestamptz,
  last_triggered timestamptz
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_portfolios_user_id ON portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_symbol ON alerts(symbol);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Enable Row Level Security
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for portfolios table
CREATE POLICY "Users can view own portfolio"
  ON portfolios FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own portfolio"
  ON portfolios FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own portfolio"
  ON portfolios FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own portfolio"
  ON portfolios FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for alerts table
CREATE POLICY "Users can view own alerts"
  ON alerts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own alerts"
  ON alerts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own alerts"
  ON alerts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own alerts"
  ON alerts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for notifications table
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);
