/*
  # Bot Guardrails System

  1. Purpose
    - Implements conservative TP/SL limits for new/unproven bots
    - Reduces risk until bots establish track record
    - Gradually relaxes limits as bots prove themselves

  2. Bot Maturity Tiers
    - NOVICE: < 10 evaluated predictions (max ±3% TP/SL)
    - LEARNING: 10-49 evaluated, <50% accuracy (max ±5% TP/SL)
    - INTERMEDIATE: 50-99 evaluated OR 50-69% accuracy (max ±8% TP/SL)
    - PROVEN: 100+ evaluated AND 60%+ accuracy (max ±12% TP/SL)
    - EXPERT: 200+ evaluated AND 70%+ accuracy (unlimited)

  3. Benefits
    - Protects users from wild predictions by unproven bots
    - Allows proven bots to operate without restrictions
    - Automatic progression as bots improve
*/

-- Create bot maturity tracking table
CREATE TABLE IF NOT EXISTS bot_maturity_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_name text UNIQUE NOT NULL,
  maturity_tier text NOT NULL CHECK (maturity_tier IN ('NOVICE', 'LEARNING', 'INTERMEDIATE', 'PROVEN', 'EXPERT')),
  total_evaluated bigint DEFAULT 0,
  successful_predictions bigint DEFAULT 0,
  failed_predictions bigint DEFAULT 0,
  current_accuracy numeric DEFAULT 0,
  max_tp_percentage numeric NOT NULL,
  max_sl_percentage numeric NOT NULL,
  last_evaluated_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_maturity_name ON bot_maturity_status(bot_name);
CREATE INDEX IF NOT EXISTS idx_bot_maturity_tier ON bot_maturity_status(maturity_tier);

ALTER TABLE bot_maturity_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view bot maturity status"
  ON bot_maturity_status
  FOR SELECT
  TO authenticated
  USING (true);

-- Function to calculate bot maturity tier
CREATE OR REPLACE FUNCTION calculate_bot_maturity_tier(
  evaluated_count bigint,
  accuracy_rate numeric
)
RETURNS TABLE (
  tier text,
  max_tp numeric,
  max_sl numeric
) AS $$
BEGIN
  -- EXPERT: 200+ evaluated AND 70%+ accuracy (unlimited)
  IF evaluated_count >= 200 AND accuracy_rate >= 70 THEN
    RETURN QUERY SELECT 'EXPERT'::text, 999::numeric, 999::numeric;
  
  -- PROVEN: 100+ evaluated AND 60%+ accuracy (max ±12%)
  ELSIF evaluated_count >= 100 AND accuracy_rate >= 60 THEN
    RETURN QUERY SELECT 'PROVEN'::text, 12::numeric, 12::numeric;
  
  -- INTERMEDIATE: 50-99 evaluated OR 50-69% accuracy (max ±8%)
  ELSIF evaluated_count >= 50 OR (evaluated_count >= 20 AND accuracy_rate >= 50) THEN
    RETURN QUERY SELECT 'INTERMEDIATE'::text, 8::numeric, 8::numeric;
  
  -- LEARNING: 10-49 evaluated, <50% accuracy (max ±5%)
  ELSIF evaluated_count >= 10 THEN
    RETURN QUERY SELECT 'LEARNING'::text, 5::numeric, 5::numeric;
  
  -- NOVICE: < 10 evaluated (max ±3%)
  ELSE
    RETURN QUERY SELECT 'NOVICE'::text, 3::numeric, 3::numeric;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update all bot maturity statuses
CREATE OR REPLACE FUNCTION update_bot_maturity_statuses()
RETURNS void AS $$
DECLARE
  bot_record RECORD;
  maturity RECORD;
BEGIN
  -- Get performance stats for all bots
  FOR bot_record IN 
    SELECT 
      bp.bot_name,
      COUNT(*) FILTER (WHERE bp.outcome_status IS NOT NULL)::bigint as evaluated_count,
      COUNT(*) FILTER (WHERE bp.outcome_status = 'success')::bigint as success_count,
      COUNT(*) FILTER (WHERE bp.outcome_status = 'failed')::bigint as failed_count,
      CASE 
        WHEN COUNT(*) FILTER (WHERE bp.outcome_status IN ('success', 'failed')) > 0 
        THEN ROUND((COUNT(*) FILTER (WHERE bp.outcome_status = 'success')::numeric / 
                    COUNT(*) FILTER (WHERE bp.outcome_status IN ('success', 'failed'))::numeric) * 100, 2)
        ELSE 0
      END as accuracy,
      MAX(bp.outcome_checked_at) as last_checked
    FROM bot_predictions bp
    GROUP BY bp.bot_name
  LOOP
    -- Calculate maturity tier
    SELECT * INTO maturity 
    FROM calculate_bot_maturity_tier(bot_record.evaluated_count, bot_record.accuracy);
    
    -- Upsert bot maturity status
    INSERT INTO bot_maturity_status (
      bot_name,
      maturity_tier,
      total_evaluated,
      successful_predictions,
      failed_predictions,
      current_accuracy,
      max_tp_percentage,
      max_sl_percentage,
      last_evaluated_at,
      updated_at
    ) VALUES (
      bot_record.bot_name,
      maturity.tier,
      bot_record.evaluated_count,
      bot_record.success_count,
      bot_record.failed_count,
      bot_record.accuracy,
      maturity.max_tp,
      maturity.max_sl,
      bot_record.last_checked,
      NOW()
    )
    ON CONFLICT (bot_name) 
    DO UPDATE SET
      maturity_tier = EXCLUDED.maturity_tier,
      total_evaluated = EXCLUDED.total_evaluated,
      successful_predictions = EXCLUDED.successful_predictions,
      failed_predictions = EXCLUDED.failed_predictions,
      current_accuracy = EXCLUDED.current_accuracy,
      max_tp_percentage = EXCLUDED.max_tp_percentage,
      max_sl_percentage = EXCLUDED.max_sl_percentage,
      last_evaluated_at = EXCLUDED.last_evaluated_at,
      updated_at = NOW();
  END LOOP;
  
  RAISE NOTICE 'Updated bot maturity statuses';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get bot guardrail limits
CREATE OR REPLACE FUNCTION get_bot_guardrail_limits(p_bot_name text)
RETURNS TABLE (
  bot_name text,
  maturity_tier text,
  max_tp_percentage numeric,
  max_sl_percentage numeric,
  current_accuracy numeric,
  total_evaluated bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bms.bot_name,
    bms.maturity_tier,
    bms.max_tp_percentage,
    bms.max_sl_percentage,
    bms.current_accuracy,
    bms.total_evaluated
  FROM bot_maturity_status bms
  WHERE bms.bot_name = p_bot_name;
  
  -- If bot not found, return NOVICE defaults
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      p_bot_name,
      'NOVICE'::text,
      3::numeric,
      3::numeric,
      0::numeric,
      0::bigint;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to apply guardrails to bot predictions
CREATE OR REPLACE FUNCTION apply_bot_guardrails()
RETURNS TRIGGER AS $$
DECLARE
  guardrails RECORD;
  tp_percentage numeric;
  sl_percentage numeric;
  capped_tp numeric;
  capped_sl numeric;
BEGIN
  -- Get bot guardrail limits
  SELECT * INTO guardrails FROM get_bot_guardrail_limits(NEW.bot_name);
  
  -- Calculate current TP/SL percentages
  IF NEW.position_direction = 'LONG' THEN
    tp_percentage := ABS(((NEW.target_price - NEW.entry_price) / NEW.entry_price) * 100);
    sl_percentage := ABS(((NEW.stop_loss - NEW.entry_price) / NEW.entry_price) * 100);
  ELSE
    tp_percentage := ABS(((NEW.entry_price - NEW.target_price) / NEW.entry_price) * 100);
    sl_percentage := ABS(((NEW.entry_price - NEW.stop_loss) / NEW.entry_price) * 100);
  END IF;
  
  -- Cap TP if exceeds limit
  IF tp_percentage > guardrails.max_tp_percentage THEN
    capped_tp := guardrails.max_tp_percentage;
    IF NEW.position_direction = 'LONG' THEN
      NEW.target_price := NEW.entry_price * (1 + (capped_tp / 100));
    ELSE
      NEW.target_price := NEW.entry_price * (1 - (capped_tp / 100));
    END IF;
  END IF;
  
  -- Cap SL if exceeds limit
  IF sl_percentage > guardrails.max_sl_percentage THEN
    capped_sl := guardrails.max_sl_percentage;
    IF NEW.position_direction = 'LONG' THEN
      NEW.stop_loss := NEW.entry_price * (1 - (capped_sl / 100));
    ELSE
      NEW.stop_loss := NEW.entry_price * (1 + (capped_sl / 100));
    END IF;
  END IF;
  
  -- Store maturity tier in metadata
  NEW.confidence_score := LEAST(NEW.confidence_score, 0.85);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to apply guardrails on new predictions
DROP TRIGGER IF EXISTS apply_bot_guardrails_trigger ON bot_predictions;
CREATE TRIGGER apply_bot_guardrails_trigger
  BEFORE INSERT ON bot_predictions
  FOR EACH ROW
  EXECUTE FUNCTION apply_bot_guardrails();

-- Create cron job to update bot maturity every hour (right after bot evaluation)
SELECT cron.schedule(
  'update-bot-maturity',
  '30 * * * *', -- Every hour at 30 minutes past (15 mins after bot evaluation)
  $$
  SELECT update_bot_maturity_statuses();
  $$
);

-- Initialize bot maturity for all existing bots
SELECT update_bot_maturity_statuses();

-- Create view for bot maturity dashboard
CREATE OR REPLACE VIEW bot_maturity_dashboard AS
SELECT 
  bms.bot_name,
  bms.maturity_tier,
  bms.total_evaluated,
  bms.successful_predictions,
  bms.failed_predictions,
  bms.current_accuracy,
  bms.max_tp_percentage,
  bms.max_sl_percentage,
  bms.last_evaluated_at,
  CASE bms.maturity_tier
    WHEN 'NOVICE' THEN '🆕 Novice (< 10 trades)'
    WHEN 'LEARNING' THEN '📚 Learning (10-49 trades)'
    WHEN 'INTERMEDIATE' THEN '⚡ Intermediate (50-99 trades)'
    WHEN 'PROVEN' THEN '✅ Proven (100+ trades, 60%+ win rate)'
    WHEN 'EXPERT' THEN '🏆 Expert (200+ trades, 70%+ win rate)'
  END as tier_description,
  CASE 
    WHEN bms.maturity_tier = 'EXPERT' THEN 'No limits - fully trusted'
    ELSE 'Max ±' || bms.max_tp_percentage || '% TP/SL'
  END as guardrail_info
FROM bot_maturity_status bms
ORDER BY 
  CASE bms.maturity_tier
    WHEN 'EXPERT' THEN 1
    WHEN 'PROVEN' THEN 2
    WHEN 'INTERMEDIATE' THEN 3
    WHEN 'LEARNING' THEN 4
    WHEN 'NOVICE' THEN 5
  END,
  bms.current_accuracy DESC;

GRANT SELECT ON bot_maturity_dashboard TO authenticated;
GRANT EXECUTE ON FUNCTION get_bot_guardrail_limits TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_bot_maturity_tier TO authenticated;

-- Add comments
COMMENT ON TABLE bot_maturity_status IS 'Tracks bot maturity tiers and guardrail limits based on performance history';
COMMENT ON FUNCTION update_bot_maturity_statuses IS 'Updates all bot maturity tiers based on current performance';
COMMENT ON FUNCTION apply_bot_guardrails IS 'Trigger function that caps TP/SL based on bot maturity tier';
