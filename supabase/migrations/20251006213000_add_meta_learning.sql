/*
  # Meta-Learning System

  ## Overview
  Meta-learning is "learning to learn" - the system learns which bots to trust
  in which situations, beyond just their historical accuracy.

  ## Key Concepts
  - **Context-Aware Trust**: Learn which bots perform best in specific contexts
  - **Situation Detection**: Identify market situations and bot specializations
  - **Adaptive Weighting**: Dynamically adjust bot weights based on current situation
  - **Pattern Recognition**: Identify when bots tend to succeed/fail

  ## Meta-Learning Components
  1. **Situation Fingerprints**: Characterize current market conditions
  2. **Bot Expertise Maps**: Track which bots excel in which situations
  3. **Trust Scores**: Dynamic confidence in each bot for current situation
  4. **Ensemble Selection**: Choose optimal bot subset for current context

  ## New Tables
  - `meta_situations` - Defined market situations
  - `bot_expertise_map` - Bot performance per situation
  - `meta_learning_episodes` - Learning episodes and outcomes
  - `dynamic_trust_scores` - Real-time trust scores per bot

  ## New Functions
  - `identify_current_situation()` - Fingerprint current market state
  - `calculate_trust_scores()` - Compute trust for each bot
  - `meta_learn_from_episode()` - Update expertise from outcomes
  - `select_optimal_ensemble()` - Choose best bots for situation
*/

-- ==========================================
-- 1. META SITUATIONS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS meta_situations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  situation_name text NOT NULL UNIQUE,
  situation_fingerprint jsonb NOT NULL,

  -- Situation characteristics
  market_regime text NOT NULL,
  volatility_level text, -- 'LOW', 'MEDIUM', 'HIGH', 'EXTREME'
  trend_strength numeric, -- 0-1
  volume_profile text, -- 'LOW', 'NORMAL', 'HIGH', 'SPIKE'
  price_momentum text, -- 'STRONG_UP', 'WEAK_UP', 'NEUTRAL', 'WEAK_DOWN', 'STRONG_DOWN'

  -- Context
  correlation_with_btc numeric,
  correlation_with_market numeric,
  time_of_day_category text, -- 'ASIAN_HOURS', 'EUROPEAN_HOURS', 'US_HOURS'

  -- Tracking
  times_encountered integer DEFAULT 0,
  last_seen timestamptz DEFAULT now(),

  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meta_sit_name ON meta_situations(situation_name);
CREATE INDEX IF NOT EXISTS idx_meta_sit_regime ON meta_situations(market_regime);
CREATE INDEX IF NOT EXISTS idx_meta_sit_fp ON meta_situations USING gin(situation_fingerprint);

ALTER TABLE meta_situations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view meta situations"
  ON meta_situations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage meta situations"
  ON meta_situations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==========================================
-- 2. BOT EXPERTISE MAP TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS bot_expertise_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_name text NOT NULL,
  situation_id uuid REFERENCES meta_situations(id) ON DELETE CASCADE,

  -- Expertise metrics in this situation
  expertise_score numeric DEFAULT 0, -- 0-100
  predictions_in_situation integer DEFAULT 0,
  accuracy_in_situation numeric DEFAULT 0,
  avg_confidence_in_situation numeric DEFAULT 0,

  -- Performance breakdown
  sharpe_in_situation numeric,
  max_profit_in_situation numeric,
  max_loss_in_situation numeric,

  -- Reliability
  consistency_score numeric, -- How consistent performance is
  false_positive_rate numeric, -- High confidence but wrong
  false_negative_rate numeric, -- Low confidence but right

  -- Comparison to overall
  outperformance_vs_average numeric, -- How much better than bot's average

  last_updated timestamptz DEFAULT now(),

  UNIQUE(bot_name, situation_id)
);

CREATE INDEX IF NOT EXISTS idx_expertise_bot ON bot_expertise_map(bot_name);
CREATE INDEX IF NOT EXISTS idx_expertise_situation ON bot_expertise_map(situation_id);
CREATE INDEX IF NOT EXISTS idx_expertise_score ON bot_expertise_map(expertise_score DESC);

ALTER TABLE bot_expertise_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view expertise map"
  ON bot_expertise_map FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage expertise map"
  ON bot_expertise_map FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==========================================
-- 3. META LEARNING EPISODES TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS meta_learning_episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_number serial,

  -- Situation
  situation_id uuid REFERENCES meta_situations(id),
  situation_fingerprint jsonb,

  -- Bots selected for this episode
  selected_bots jsonb, -- Array of bot names and their trust scores

  -- Outcome
  collective_accuracy numeric,
  collective_profit_loss numeric,
  consensus_confidence numeric,

  -- What we learned
  learning_insights jsonb, -- Which bots performed well/poorly
  trust_adjustments jsonb, -- How trust scores were updated

  episode_timestamp timestamptz DEFAULT now(),
  outcome_evaluated_at timestamptz,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_episode_number ON meta_learning_episodes(episode_number DESC);
CREATE INDEX IF NOT EXISTS idx_episode_situation ON meta_learning_episodes(situation_id);
CREATE INDEX IF NOT EXISTS idx_episode_timestamp ON meta_learning_episodes(episode_timestamp DESC);

ALTER TABLE meta_learning_episodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view learning episodes"
  ON meta_learning_episodes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage learning episodes"
  ON meta_learning_episodes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==========================================
-- 4. DYNAMIC TRUST SCORES TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS dynamic_trust_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_name text NOT NULL,
  situation_id uuid REFERENCES meta_situations(id),

  -- Current trust score (0-1)
  trust_score numeric DEFAULT 0.5,

  -- Components of trust
  historical_performance_trust numeric, -- Based on past accuracy
  consistency_trust numeric, -- Based on reliable performance
  situation_expertise_trust numeric, -- Based on situation-specific expertise
  diversity_trust numeric, -- Based on providing unique insights

  -- Combined trust calculation
  trust_calculation_method text DEFAULT 'WEIGHTED_AVERAGE',
  trust_components_weights jsonb,

  -- Metadata
  confidence_in_trust numeric, -- How confident we are in this score
  sample_size integer, -- How many predictions used to calculate

  calculated_at timestamptz DEFAULT now(),
  valid_until timestamptz, -- Trust score expires after time

  created_at timestamptz DEFAULT now(),

  UNIQUE(bot_name, situation_id)
);

CREATE INDEX IF NOT EXISTS idx_trust_bot ON dynamic_trust_scores(bot_name);
CREATE INDEX IF NOT EXISTS idx_trust_situation ON dynamic_trust_scores(situation_id);
CREATE INDEX IF NOT EXISTS idx_trust_score ON dynamic_trust_scores(trust_score DESC);
CREATE INDEX IF NOT EXISTS idx_trust_valid ON dynamic_trust_scores(valid_until);

ALTER TABLE dynamic_trust_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view trust scores"
  ON dynamic_trust_scores FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage trust scores"
  ON dynamic_trust_scores FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==========================================
-- 5. FUNCTION: Identify Current Situation
-- ==========================================

CREATE OR REPLACE FUNCTION identify_current_situation()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_situation_id uuid;
  v_fingerprint jsonb;
  v_regime text;
  v_volatility text;
  v_volume text;
  v_momentum text;
BEGIN
  -- Get current market characteristics from latest scan
  SELECT
    market_regime,
    CASE
      WHEN regime_confidence > 0.8 THEN 'HIGH'
      WHEN regime_confidence > 0.5 THEN 'MEDIUM'
      ELSE 'LOW'
    END as volatility_level
  INTO v_regime, v_volatility
  FROM recommendations
  ORDER BY created_at DESC
  LIMIT 1;

  -- Create situation fingerprint
  v_fingerprint := jsonb_build_object(
    'market_regime', COALESCE(v_regime, 'UNKNOWN'),
    'volatility_level', COALESCE(v_volatility, 'UNKNOWN'),
    'timestamp', now()
  );

  -- Find or create situation
  SELECT id INTO v_situation_id
  FROM meta_situations
  WHERE market_regime = COALESCE(v_regime, 'UNKNOWN')
    AND volatility_level = COALESCE(v_volatility, 'UNKNOWN')
  LIMIT 1;

  IF v_situation_id IS NULL THEN
    -- Create new situation
    INSERT INTO meta_situations (
      situation_name,
      situation_fingerprint,
      market_regime,
      volatility_level,
      times_encountered
    )
    VALUES (
      COALESCE(v_regime, 'UNKNOWN') || '_' || COALESCE(v_volatility, 'UNKNOWN'),
      v_fingerprint,
      COALESCE(v_regime, 'UNKNOWN'),
      COALESCE(v_volatility, 'UNKNOWN'),
      1
    )
    RETURNING id INTO v_situation_id;
  ELSE
    -- Update encounter count
    UPDATE meta_situations
    SET
      times_encountered = times_encountered + 1,
      last_seen = now()
    WHERE id = v_situation_id;
  END IF;

  RETURN v_situation_id;
END;
$$;

-- ==========================================
-- 6. FUNCTION: Calculate Trust Scores
-- ==========================================

CREATE OR REPLACE FUNCTION calculate_trust_scores(p_situation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bot record;
  v_hist_trust numeric;
  v_consistency_trust numeric;
  v_expertise_trust numeric;
  v_diversity_trust numeric;
  v_final_trust numeric;
BEGIN
  FOR v_bot IN
    SELECT DISTINCT bot_name FROM bot_predictions
  LOOP
    -- Historical performance trust (30% weight)
    SELECT COALESCE(last_30_days_accuracy, accuracy_rate, 0.5)
    INTO v_hist_trust
    FROM bot_accuracy_metrics
    WHERE bot_name = v_bot.bot_name AND market_regime = 'ALL';

    -- Consistency trust (25% weight)
    SELECT COALESCE(1.0 - consistency_score, 0.5)
    INTO v_consistency_trust
    FROM bot_advanced_metrics
    WHERE bot_name = v_bot.bot_name AND market_regime = 'ALL';

    -- Situation expertise trust (30% weight)
    SELECT COALESCE(expertise_score / 100.0, 0.5)
    INTO v_expertise_trust
    FROM bot_expertise_map
    WHERE bot_name = v_bot.bot_name AND situation_id = p_situation_id;

    -- Diversity trust (15% weight)
    SELECT CASE
      WHEN AVG(ABS(correlation_coefficient)) < 0.3 THEN 1.0
      WHEN AVG(ABS(correlation_coefficient)) < 0.7 THEN 0.7
      ELSE 0.4
    END
    INTO v_diversity_trust
    FROM bot_correlation_matrix
    WHERE bot_name_a = v_bot.bot_name OR bot_name_b = v_bot.bot_name;

    -- Weighted average trust score
    v_final_trust :=
      COALESCE(v_hist_trust, 0.5) * 0.30 +
      COALESCE(v_consistency_trust, 0.5) * 0.25 +
      COALESCE(v_expertise_trust, 0.5) * 0.30 +
      COALESCE(v_diversity_trust, 0.5) * 0.15;

    -- Insert or update trust score
    INSERT INTO dynamic_trust_scores (
      bot_name,
      situation_id,
      trust_score,
      historical_performance_trust,
      consistency_trust,
      situation_expertise_trust,
      diversity_trust,
      trust_components_weights,
      calculated_at,
      valid_until
    )
    VALUES (
      v_bot.bot_name,
      p_situation_id,
      v_final_trust,
      v_hist_trust,
      v_consistency_trust,
      v_expertise_trust,
      v_diversity_trust,
      jsonb_build_object(
        'historical', 0.30,
        'consistency', 0.25,
        'expertise', 0.30,
        'diversity', 0.15
      ),
      now(),
      now() + interval '24 hours'
    )
    ON CONFLICT (bot_name, situation_id)
    DO UPDATE SET
      trust_score = EXCLUDED.trust_score,
      historical_performance_trust = EXCLUDED.historical_performance_trust,
      consistency_trust = EXCLUDED.consistency_trust,
      situation_expertise_trust = EXCLUDED.situation_expertise_trust,
      diversity_trust = EXCLUDED.diversity_trust,
      calculated_at = now(),
      valid_until = now() + interval '24 hours';

  END LOOP;
END;
$$;

-- ==========================================
-- 7. FUNCTION: Meta Learn from Episode
-- ==========================================

CREATE OR REPLACE FUNCTION meta_learn_from_episode()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_episode record;
  v_bot_name text;
  v_situation_id uuid;
BEGIN
  -- Find recent episodes that haven't been learned from yet
  FOR v_episode IN
    SELECT
      mle.id,
      mle.situation_id,
      mle.selected_bots,
      mle.collective_accuracy,
      mle.collective_profit_loss
    FROM meta_learning_episodes mle
    WHERE mle.outcome_evaluated_at IS NOT NULL
      AND mle.learning_insights IS NULL
    LIMIT 10
  LOOP

    v_situation_id := v_episode.situation_id;

    -- Update expertise for each bot that participated
    FOR v_bot_name IN
      SELECT jsonb_array_elements_text(v_episode.selected_bots)
    LOOP

      -- Update bot expertise map
      INSERT INTO bot_expertise_map (
        bot_name,
        situation_id,
        expertise_score,
        predictions_in_situation,
        accuracy_in_situation
      )
      SELECT
        v_bot_name,
        v_situation_id,
        v_episode.collective_accuracy * 100,
        1,
        v_episode.collective_accuracy
      ON CONFLICT (bot_name, situation_id)
      DO UPDATE SET
        expertise_score = (
          bot_expertise_map.expertise_score * bot_expertise_map.predictions_in_situation +
          v_episode.collective_accuracy * 100
        ) / (bot_expertise_map.predictions_in_situation + 1),
        predictions_in_situation = bot_expertise_map.predictions_in_situation + 1,
        accuracy_in_situation = (
          bot_expertise_map.accuracy_in_situation * bot_expertise_map.predictions_in_situation +
          v_episode.collective_accuracy
        ) / (bot_expertise_map.predictions_in_situation + 1),
        last_updated = now();

    END LOOP;

    -- Mark episode as learned from
    UPDATE meta_learning_episodes
    SET learning_insights = jsonb_build_object(
      'learned_at', now(),
      'accuracy', v_episode.collective_accuracy,
      'insights', 'Expertise maps updated for participating bots'
    )
    WHERE id = v_episode.id;

  END LOOP;
END;
$$;

-- ==========================================
-- 8. FUNCTION: Select Optimal Ensemble
-- ==========================================

CREATE OR REPLACE FUNCTION select_optimal_ensemble(
  p_situation_id uuid,
  p_max_bots integer DEFAULT 20
)
RETURNS TABLE (
  bot_name text,
  trust_score numeric,
  weight_multiplier numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Select top N bots by trust score for this situation
  RETURN QUERY
  SELECT
    dts.bot_name,
    dts.trust_score,
    CASE
      WHEN dts.trust_score > 0.8 THEN 1.5
      WHEN dts.trust_score > 0.6 THEN 1.2
      WHEN dts.trust_score > 0.4 THEN 1.0
      ELSE 0.7
    END as weight_multiplier
  FROM dynamic_trust_scores dts
  WHERE dts.situation_id = p_situation_id
    AND dts.valid_until > now()
  ORDER BY dts.trust_score DESC
  LIMIT p_max_bots;
END;
$$;

-- ==========================================
-- 9. SETUP CRON JOBS
-- ==========================================

-- Calculate trust scores every 6 hours
SELECT cron.schedule(
  'calculate_meta_trust_scores',
  '0 */6 * * *',
  $$
  DO $$
  DECLARE
    v_situation_id uuid;
  BEGIN
    v_situation_id := identify_current_situation();
    PERFORM calculate_trust_scores(v_situation_id);
  END $$;
  $$
);

-- Meta learn from episodes daily
SELECT cron.schedule(
  'meta_learn_from_episodes',
  '15 5 * * *',
  $$
  SELECT meta_learn_from_episode();
  $$
);

COMMENT ON TABLE meta_situations IS 'Defined market situations for meta-learning context awareness';
COMMENT ON TABLE bot_expertise_map IS 'Maps bot performance to specific market situations';
COMMENT ON TABLE meta_learning_episodes IS 'Learning episodes tracking ensemble performance';
COMMENT ON TABLE dynamic_trust_scores IS 'Real-time trust scores for each bot in current situation';
COMMENT ON FUNCTION identify_current_situation IS 'Fingerprints current market state and identifies situation';
COMMENT ON FUNCTION calculate_trust_scores IS 'Computes dynamic trust scores based on multiple factors';
COMMENT ON FUNCTION meta_learn_from_episode IS 'Updates bot expertise from episode outcomes';
COMMENT ON FUNCTION select_optimal_ensemble IS 'Selects best bots for current situation';
