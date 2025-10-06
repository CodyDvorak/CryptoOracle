/*
  # Fix Bot Performance Summary Function
  
  Fixes type casting issues in the get_bot_performance_summary function
*/

-- Drop and recreate with proper type casting
DROP FUNCTION IF EXISTS get_bot_performance_summary(integer);

CREATE OR REPLACE FUNCTION get_bot_performance_summary(days_back integer DEFAULT 7)
RETURNS TABLE (
  bot_name text,
  total_predictions bigint,
  evaluated_predictions bigint,
  successful_predictions bigint,
  failed_predictions bigint,
  accuracy_rate numeric,
  avg_profit_loss numeric,
  evaluation_coverage numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bp.bot_name,
    COUNT(*)::bigint as total_predictions,
    COUNT(*) FILTER (WHERE bp.outcome_status IS NOT NULL)::bigint as evaluated_predictions,
    COUNT(*) FILTER (WHERE bp.outcome_status = 'success')::bigint as successful_predictions,
    COUNT(*) FILTER (WHERE bp.outcome_status = 'failed')::bigint as failed_predictions,
    CASE 
      WHEN COUNT(*) FILTER (WHERE bp.outcome_status IN ('success', 'failed')) > 0 
      THEN ROUND((COUNT(*) FILTER (WHERE bp.outcome_status = 'success')::numeric / 
                  COUNT(*) FILTER (WHERE bp.outcome_status IN ('success', 'failed'))::numeric) * 100, 2)
      ELSE 0::numeric
    END as accuracy_rate,
    ROUND(AVG(bp.profit_loss_percent::numeric) FILTER (WHERE bp.outcome_status IS NOT NULL), 2) as avg_profit_loss,
    CASE 
      WHEN COUNT(*) > 0 
      THEN ROUND((COUNT(*) FILTER (WHERE bp.outcome_status IS NOT NULL)::numeric / COUNT(*)::numeric) * 100, 2)
      ELSE 0::numeric
    END as evaluation_coverage
  FROM bot_predictions bp
  WHERE bp.timestamp >= NOW() - (days_back || ' days')::interval
  GROUP BY bp.bot_name
  ORDER BY accuracy_rate DESC NULLS LAST, total_predictions DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_bot_performance_summary TO authenticated;
