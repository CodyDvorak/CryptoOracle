/*
  # Ensemble Correlation Analysis

  ## Overview
  Analyzes correlations between bots to:
  - Identify redundant bots (high correlation = similar predictions)
  - Reward diversity (uncorrelated bots provide unique insights)
  - Optimize ensemble composition
  - Detect bot clusters and specializations

  ## Key Concepts
  - **High correlation** (>0.8): Bots making similar predictions → Redundant
  - **Low correlation** (<0.3): Bots providing unique insights → Valuable
  - **Negative correlation** (<-0.3): Contrarian relationships → Interesting
  - **Diversity bonus**: Uncorrelated bots get weight boost

  ## New Tables
  - `bot_correlation_matrix` - Pairwise correlation between all bots
  - `bot_clusters` - Groups of similar bots
  - `ensemble_diversity_metrics` - Overall ensemble health

  ## New Functions
  - `calculate_bot_correlations()` - Computes correlation matrix
  - `identify_bot_clusters()` - Groups similar bots
  - `apply_diversity_bonus()` - Boosts weights of unique bots
*/

-- ==========================================
-- 1. BOT CORRELATION MATRIX TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS bot_correlation_matrix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_name_a text NOT NULL,
  bot_name_b text NOT NULL,

  -- Correlation metrics
  correlation_coefficient numeric, -- -1 to 1 (Pearson correlation)
  agreement_rate numeric, -- % of times bots agree on direction
  disagreement_rate numeric, -- % of times bots disagree

  -- Sample details
  sample_size integer, -- Number of predictions used
  confidence_a_avg numeric,
  confidence_b_avg numeric,

  -- Correlation strength classification
  correlation_strength text, -- 'STRONG_POSITIVE', 'WEAK', 'STRONG_NEGATIVE'

  -- Time-based correlation
  correlation_7d numeric, -- Recent correlation (last 7 days)
  correlation_30d numeric, -- Monthly correlation
  correlation_all_time numeric, -- Historical correlation

  last_calculated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),

  UNIQUE(bot_name_a, bot_name_b)
);

CREATE INDEX IF NOT EXISTS idx_correlation_bot_a ON bot_correlation_matrix(bot_name_a);
CREATE INDEX IF NOT EXISTS idx_correlation_bot_b ON bot_correlation_matrix(bot_name_b);
CREATE INDEX IF NOT EXISTS idx_correlation_coefficient ON bot_correlation_matrix(correlation_coefficient);
CREATE INDEX IF NOT EXISTS idx_correlation_strength ON bot_correlation_matrix(correlation_strength);

ALTER TABLE bot_correlation_matrix ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view correlation matrix"
  ON bot_correlation_matrix FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage correlation matrix"
  ON bot_correlation_matrix FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==========================================
-- 2. BOT CLUSTERS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS bot_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id integer NOT NULL,
  cluster_name text, -- e.g., "Trend Followers", "Mean Reversion Group"
  bot_name text NOT NULL,

  -- Cluster membership strength
  membership_score numeric, -- 0-1, how strongly bot belongs to cluster
  is_cluster_leader boolean DEFAULT false, -- Best bot in cluster

  -- Cluster characteristics
  cluster_avg_correlation numeric, -- Avg correlation within cluster
  cluster_size integer, -- Number of bots in cluster

  -- Performance
  cluster_accuracy numeric,
  cluster_sharpe_ratio numeric,

  identified_at timestamptz DEFAULT now(),
  last_updated timestamptz DEFAULT now(),

  UNIQUE(cluster_id, bot_name)
);

CREATE INDEX IF NOT EXISTS idx_clusters_id ON bot_clusters(cluster_id);
CREATE INDEX IF NOT EXISTS idx_clusters_bot ON bot_clusters(bot_name);
CREATE INDEX IF NOT EXISTS idx_clusters_leader ON bot_clusters(is_cluster_leader);

ALTER TABLE bot_clusters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view bot clusters"
  ON bot_clusters FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage bot clusters"
  ON bot_clusters FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==========================================
-- 3. ENSEMBLE DIVERSITY METRICS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS ensemble_diversity_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  measurement_date date NOT NULL UNIQUE DEFAULT CURRENT_DATE,

  -- Overall diversity
  avg_pairwise_correlation numeric, -- Lower = more diverse
  diversity_score numeric, -- 0-100, higher = more diverse
  redundancy_score numeric, -- 0-100, higher = more redundant

  -- Cluster analysis
  number_of_clusters integer,
  largest_cluster_size integer,
  smallest_cluster_size integer,

  -- Unique contributors
  highly_unique_bots integer, -- Bots with low correlation to others
  highly_redundant_bots integer, -- Bots with high correlation to many

  -- Performance diversity
  strategy_type_distribution jsonb, -- Distribution across trend/reversal/volatility
  regime_specialization_spread numeric, -- How specialized bots are per regime

  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diversity_date ON ensemble_diversity_metrics(measurement_date DESC);

ALTER TABLE ensemble_diversity_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view diversity metrics"
  ON ensemble_diversity_metrics FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage diversity metrics"
  ON ensemble_diversity_metrics FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==========================================
-- 4. FUNCTION: Calculate Bot Correlations
-- ==========================================

CREATE OR REPLACE FUNCTION calculate_bot_correlations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bot_a record;
  v_bot_b record;
  v_correlation numeric;
  v_agreement_rate numeric;
  v_sample_size integer;
  v_count integer := 0;
BEGIN
  -- Calculate correlation for each pair of bots
  FOR v_bot_a IN
    SELECT DISTINCT bot_name FROM bot_predictions
    ORDER BY bot_name
  LOOP
    FOR v_bot_b IN
      SELECT DISTINCT bot_name FROM bot_predictions
      WHERE bot_name > v_bot_a.bot_name -- Only calculate upper triangle
      ORDER BY bot_name
    LOOP

      -- Calculate correlation based on prediction directions and outcomes
      WITH paired_predictions AS (
        SELECT
          a.run_id,
          a.coin_symbol,
          a.position_direction as dir_a,
          b.position_direction as dir_b,
          a.confidence_score as conf_a,
          b.confidence_score as conf_b,
          CASE
            WHEN a.position_direction = b.position_direction THEN 1
            ELSE -1
          END as agreement_score
        FROM bot_predictions a
        JOIN bot_predictions b
          ON a.run_id = b.run_id
          AND a.coin_symbol = b.coin_symbol
        WHERE a.bot_name = v_bot_a.bot_name
          AND b.bot_name = v_bot_b.bot_name
      )
      SELECT
        AVG(agreement_score) as correlation,
        COUNT(*) FILTER (WHERE agreement_score = 1)::numeric / COUNT(*) as agreement,
        COUNT(*) as sample_size
      INTO v_correlation, v_agreement_rate, v_sample_size
      FROM paired_predictions;

      IF v_sample_size >= 10 THEN -- Need minimum sample size
        INSERT INTO bot_correlation_matrix (
          bot_name_a,
          bot_name_b,
          correlation_coefficient,
          agreement_rate,
          disagreement_rate,
          sample_size,
          correlation_strength,
          correlation_all_time
        )
        VALUES (
          v_bot_a.bot_name,
          v_bot_b.bot_name,
          v_correlation,
          v_agreement_rate,
          1 - v_agreement_rate,
          v_sample_size,
          CASE
            WHEN v_correlation > 0.8 THEN 'STRONG_POSITIVE'
            WHEN v_correlation > 0.5 THEN 'MODERATE_POSITIVE'
            WHEN v_correlation > -0.3 THEN 'WEAK'
            WHEN v_correlation > -0.8 THEN 'MODERATE_NEGATIVE'
            ELSE 'STRONG_NEGATIVE'
          END,
          v_correlation
        )
        ON CONFLICT (bot_name_a, bot_name_b)
        DO UPDATE SET
          correlation_coefficient = EXCLUDED.correlation_coefficient,
          agreement_rate = EXCLUDED.agreement_rate,
          disagreement_rate = EXCLUDED.disagreement_rate,
          sample_size = EXCLUDED.sample_size,
          correlation_strength = EXCLUDED.correlation_strength,
          correlation_all_time = EXCLUDED.correlation_all_time,
          last_calculated = now();

        v_count := v_count + 1;
      END IF;

    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ==========================================
-- 5. FUNCTION: Identify Bot Clusters
-- ==========================================

CREATE OR REPLACE FUNCTION identify_bot_clusters()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cluster_id integer := 1;
  v_bot record;
  v_similar_bots text[];
  v_cluster_count integer := 0;
BEGIN
  -- Clear existing clusters
  DELETE FROM bot_clusters;

  -- Simple clustering: group bots with high correlation (>0.7)
  FOR v_bot IN
    SELECT DISTINCT bot_name FROM bot_predictions
    ORDER BY bot_name
  LOOP
    -- Check if bot is already in a cluster
    IF EXISTS (SELECT 1 FROM bot_clusters WHERE bot_name = v_bot.bot_name) THEN
      CONTINUE;
    END IF;

    -- Find bots highly correlated with this bot
    SELECT ARRAY_AGG(bot_name_b)
    INTO v_similar_bots
    FROM bot_correlation_matrix
    WHERE bot_name_a = v_bot.bot_name
      AND correlation_coefficient > 0.7
    UNION
    SELECT ARRAY_AGG(bot_name_a)
    FROM bot_correlation_matrix
    WHERE bot_name_b = v_bot.bot_name
      AND correlation_coefficient > 0.7;

    -- Create cluster if similar bots found
    IF v_similar_bots IS NOT NULL AND array_length(v_similar_bots, 1) > 0 THEN
      -- Add the main bot
      INSERT INTO bot_clusters (cluster_id, bot_name, membership_score, is_cluster_leader)
      VALUES (v_cluster_id, v_bot.bot_name, 1.0, true);

      -- Add similar bots
      INSERT INTO bot_clusters (cluster_id, bot_name, membership_score)
      SELECT v_cluster_id, unnest(v_similar_bots), 0.8;

      v_cluster_id := v_cluster_id + 1;
      v_cluster_count := v_cluster_count + 1;
    END IF;
  END LOOP;

  -- Update cluster sizes
  UPDATE bot_clusters bc
  SET cluster_size = (
    SELECT COUNT(*)
    FROM bot_clusters bc2
    WHERE bc2.cluster_id = bc.cluster_id
  );

  RETURN v_cluster_count;
END;
$$;

-- ==========================================
-- 6. FUNCTION: Apply Diversity Bonus
-- ==========================================

CREATE OR REPLACE FUNCTION apply_diversity_bonus()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bot record;
  v_avg_correlation numeric;
  v_diversity_bonus numeric;
BEGIN
  -- For each bot, calculate average correlation with all other bots
  FOR v_bot IN
    SELECT DISTINCT bot_name FROM bot_predictions
  LOOP

    -- Calculate average correlation
    SELECT AVG(ABS(correlation_coefficient))
    INTO v_avg_correlation
    FROM (
      SELECT correlation_coefficient
      FROM bot_correlation_matrix
      WHERE bot_name_a = v_bot.bot_name OR bot_name_b = v_bot.bot_name
    ) correlations;

    IF v_avg_correlation IS NULL THEN
      CONTINUE;
    END IF;

    -- Calculate diversity bonus (inverse of correlation)
    -- Low correlation (unique bot) = high bonus
    -- High correlation (redundant bot) = low/negative bonus
    v_diversity_bonus := CASE
      WHEN v_avg_correlation < 0.3 THEN 1.20 -- 20% bonus for highly unique
      WHEN v_avg_correlation < 0.5 THEN 1.10 -- 10% bonus for moderately unique
      WHEN v_avg_correlation < 0.7 THEN 1.00 -- No change
      WHEN v_avg_correlation < 0.85 THEN 0.90 -- -10% for somewhat redundant
      ELSE 0.80 -- -20% for highly redundant
    END;

    -- Apply diversity bonus to bot weight
    UPDATE bot_accuracy_metrics
    SET
      current_weight = current_weight * v_diversity_bonus,
      weight_history = weight_history || jsonb_build_object(
        'timestamp', now(),
        'adjustment_type', 'diversity_bonus',
        'avg_correlation', v_avg_correlation,
        'diversity_multiplier', v_diversity_bonus
      ),
      last_updated = now()
    WHERE bot_name = v_bot.bot_name
      AND market_regime = 'ALL';

  END LOOP;
END;
$$;

-- ==========================================
-- 7. FUNCTION: Calculate Ensemble Diversity
-- ==========================================

CREATE OR REPLACE FUNCTION calculate_ensemble_diversity()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_avg_correlation numeric;
  v_num_clusters integer;
  v_unique_bots integer;
  v_redundant_bots integer;
BEGIN
  -- Calculate average pairwise correlation
  SELECT AVG(ABS(correlation_coefficient))
  INTO v_avg_correlation
  FROM bot_correlation_matrix;

  -- Count clusters
  SELECT COUNT(DISTINCT cluster_id)
  INTO v_num_clusters
  FROM bot_clusters;

  -- Count highly unique bots (avg correlation < 0.3)
  SELECT COUNT(DISTINCT bot_name)
  INTO v_unique_bots
  FROM (
    SELECT bot_name_a as bot_name, AVG(ABS(correlation_coefficient)) as avg_corr
    FROM bot_correlation_matrix
    GROUP BY bot_name_a
    HAVING AVG(ABS(correlation_coefficient)) < 0.3
    UNION
    SELECT bot_name_b as bot_name, AVG(ABS(correlation_coefficient)) as avg_corr
    FROM bot_correlation_matrix
    GROUP BY bot_name_b
    HAVING AVG(ABS(correlation_coefficient)) < 0.3
  ) unique_bots;

  -- Count highly redundant bots (avg correlation > 0.8)
  SELECT COUNT(DISTINCT bot_name)
  INTO v_redundant_bots
  FROM (
    SELECT bot_name_a as bot_name, AVG(ABS(correlation_coefficient)) as avg_corr
    FROM bot_correlation_matrix
    GROUP BY bot_name_a
    HAVING AVG(ABS(correlation_coefficient)) > 0.8
    UNION
    SELECT bot_name_b as bot_name, AVG(ABS(correlation_coefficient)) as avg_corr
    FROM bot_correlation_matrix
    GROUP BY bot_name_b
    HAVING AVG(ABS(correlation_coefficient)) > 0.8
  ) redundant_bots;

  -- Insert diversity metrics
  INSERT INTO ensemble_diversity_metrics (
    measurement_date,
    avg_pairwise_correlation,
    diversity_score,
    redundancy_score,
    number_of_clusters,
    highly_unique_bots,
    highly_redundant_bots
  )
  VALUES (
    CURRENT_DATE,
    v_avg_correlation,
    (1 - COALESCE(v_avg_correlation, 0.5)) * 100, -- Diversity score
    COALESCE(v_avg_correlation, 0.5) * 100, -- Redundancy score
    v_num_clusters,
    v_unique_bots,
    v_redundant_bots
  )
  ON CONFLICT (measurement_date)
  DO UPDATE SET
    avg_pairwise_correlation = EXCLUDED.avg_pairwise_correlation,
    diversity_score = EXCLUDED.diversity_score,
    redundancy_score = EXCLUDED.redundancy_score,
    number_of_clusters = EXCLUDED.number_of_clusters,
    highly_unique_bots = EXCLUDED.highly_unique_bots,
    highly_redundant_bots = EXCLUDED.highly_redundant_bots;

END;
$$;

-- ==========================================
-- 8. SETUP CRON JOBS
-- ==========================================

-- Calculate bot correlations daily
SELECT cron.schedule(
  'calculate_bot_correlations',
  '0 4 * * *',
  $$
  SELECT calculate_bot_correlations();
  $$
);

-- Identify clusters daily
SELECT cron.schedule(
  'identify_bot_clusters',
  '15 4 * * *',
  $$
  SELECT identify_bot_clusters();
  $$
);

-- Apply diversity bonus daily
SELECT cron.schedule(
  'apply_diversity_bonus',
  '30 4 * * *',
  $$
  SELECT apply_diversity_bonus();
  $$
);

-- Calculate ensemble diversity daily
SELECT cron.schedule(
  'calculate_ensemble_diversity',
  '45 4 * * *',
  $$
  SELECT calculate_ensemble_diversity();
  $$
);

COMMENT ON TABLE bot_correlation_matrix IS 'Pairwise correlation between all bots to identify redundancy and diversity';
COMMENT ON TABLE bot_clusters IS 'Groups of similar bots based on correlation analysis';
COMMENT ON TABLE ensemble_diversity_metrics IS 'Overall ensemble health and diversity metrics';
COMMENT ON FUNCTION calculate_bot_correlations IS 'Computes correlation matrix for all bot pairs';
COMMENT ON FUNCTION apply_diversity_bonus IS 'Applies weight bonus to unique bots and penalty to redundant bots';
