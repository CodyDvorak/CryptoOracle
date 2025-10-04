-- Bot AI Learning System
-- Tracks bot performance trends and AI-generated insights for continuous improvement

-- bot_learning_insights: Stores AI-generated insights about bot performance
CREATE TABLE IF NOT EXISTS bot_learning_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_name text NOT NULL,
  insight_type text NOT NULL CHECK (insight_type IN ('strength', 'weakness', 'trend', 'recommendation')),
  insight_text text NOT NULL,
  confidence_score numeric(5,2) DEFAULT 0.0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- bot_learning_metrics: Daily aggregated metrics for tracking bot improvement
CREATE TABLE IF NOT EXISTS bot_learning_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_name text NOT NULL,
  metric_date date NOT NULL,
  total_predictions integer DEFAULT 0,
  successful_predictions integer DEFAULT 0,
  failed_predictions integer DEFAULT 0,
  avg_confidence numeric(5,2) DEFAULT 0.0,
  performance_trend text CHECK (performance_trend IN ('improving', 'declining', 'stable')),
  learning_score numeric(5,2) DEFAULT 0.0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(bot_name, metric_date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bot_insights_name ON bot_learning_insights(bot_name);
CREATE INDEX IF NOT EXISTS idx_bot_insights_created ON bot_learning_insights(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_insights_type ON bot_learning_insights(insight_type);

CREATE INDEX IF NOT EXISTS idx_bot_metrics_name ON bot_learning_metrics(bot_name);
CREATE INDEX IF NOT EXISTS idx_bot_metrics_date ON bot_learning_metrics(metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_bot_metrics_trend ON bot_learning_metrics(performance_trend);

-- Enable RLS
ALTER TABLE bot_learning_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_learning_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can read bot insights"
  ON bot_learning_insights FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can read bot metrics"
  ON bot_learning_metrics FOR SELECT
  TO authenticated
  USING (true);