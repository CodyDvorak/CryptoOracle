import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface StateFeatures {
  trend: number;
  volatility: number;
  volume: number;
  momentum: number;
  regime: string;
  priceLevel: number;
}

interface Action {
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  confidence: number;
  parameters: Record<string, number>;
}

interface QTable {
  [stateKey: string]: {
    [action: string]: number;
  };
}

interface TrainingState {
  qTable: QTable;
  episodeCount: number;
  totalReward: number;
  learningRate: number;
  epsilon: number;
  gamma: number;
}

// Initialize Q-Learning state for a bot
function initializeTrainingState(botName: string): TrainingState {
  return {
    qTable: {},
    episodeCount: 0,
    totalReward: 0,
    learningRate: 0.1,
    epsilon: 0.2,
    gamma: 0.95,
  };
}

// Extract state features from market data
function extractStateFeatures(prediction: any, marketData: any): StateFeatures {
  const regime = prediction.market_regime || 'SIDEWAYS';
  const priceChange = ((prediction.target_price - prediction.entry_price) / prediction.entry_price) * 100;

  return {
    trend: priceChange > 2 ? 1 : priceChange < -2 ? -1 : 0,
    volatility: Math.abs(priceChange) > 5 ? 1 : 0,
    volume: 0.5,
    momentum: prediction.position_direction === 'LONG' ? 1 : -1,
    regime,
    priceLevel: prediction.entry_price,
  };
}

// Convert state features to string key for Q-table
function stateToKey(state: StateFeatures): string {
  return `${state.regime}_${state.trend}_${state.volatility}_${state.momentum}`;
}

// Calculate reward from prediction outcome
function calculateReward(prediction: any): number {
  if (!prediction.outcome_status) return 0;

  const profitLoss = prediction.profit_loss_percent || 0;

  if (prediction.outcome_status === 'success') {
    // Positive reward proportional to profit
    return Math.max(1, profitLoss * 2);
  } else if (prediction.outcome_status === 'failed') {
    // Negative reward proportional to loss
    return Math.min(-1, profitLoss * 2);
  }

  return 0;
}

// Select action using epsilon-greedy policy
function selectAction(state: StateFeatures, qTable: QTable, epsilon: number): string {
  const stateKey = stateToKey(state);

  // Exploration
  if (Math.random() < epsilon) {
    const actions = ['LONG_HIGH', 'LONG_MED', 'LONG_LOW', 'SHORT_HIGH', 'SHORT_MED', 'SHORT_LOW', 'NEUTRAL'];
    return actions[Math.floor(Math.random() * actions.length)];
  }

  // Exploitation - choose best action
  if (!qTable[stateKey]) {
    qTable[stateKey] = {};
  }

  const stateActions = qTable[stateKey];
  const actions = Object.keys(stateActions);

  if (actions.length === 0) {
    return 'NEUTRAL';
  }

  let bestAction = actions[0];
  let bestValue = stateActions[bestAction];

  for (const action of actions) {
    if (stateActions[action] > bestValue) {
      bestValue = stateActions[action];
      bestAction = action;
    }
  }

  return bestAction;
}

// Update Q-value using Q-learning formula
function updateQValue(
  qTable: QTable,
  state: StateFeatures,
  action: string,
  reward: number,
  nextState: StateFeatures | null,
  learningRate: number,
  gamma: number
): void {
  const stateKey = stateToKey(state);

  if (!qTable[stateKey]) {
    qTable[stateKey] = {};
  }

  if (!qTable[stateKey][action]) {
    qTable[stateKey][action] = 0;
  }

  let maxNextQ = 0;
  if (nextState) {
    const nextStateKey = stateToKey(nextState);
    if (qTable[nextStateKey]) {
      const nextQValues = Object.values(qTable[nextStateKey]);
      maxNextQ = nextQValues.length > 0 ? Math.max(...nextQValues) : 0;
    }
  }

  // Q(s,a) = Q(s,a) + α * [r + γ * max(Q(s',a')) - Q(s,a)]
  const currentQ = qTable[stateKey][action];
  const tdTarget = reward + gamma * maxNextQ;
  const tdError = tdTarget - currentQ;
  qTable[stateKey][action] = currentQ + learningRate * tdError;
}

// Train bot on historical episodes
async function trainBot(supabase: any, botName: string): Promise<any> {
  // Load or initialize training state
  const { data: existingState } = await supabase
    .from('bot_training_states')
    .select('*')
    .eq('bot_name', botName)
    .maybeSingle();

  let trainingState: TrainingState = existingState
    ? {
        qTable: existingState.q_table || {},
        episodeCount: existingState.total_episodes || 0,
        totalReward: existingState.total_rewards || 0,
        learningRate: existingState.learning_rate || 0.1,
        epsilon: existingState.epsilon || 0.2,
        gamma: 0.95,
      }
    : initializeTrainingState(botName);

  // Fetch historical predictions for training
  const { data: predictions } = await supabase
    .from('bot_predictions')
    .select('*')
    .eq('bot_name', botName)
    .not('outcome_status', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200);

  if (!predictions || predictions.length < 5) {
    return {
      success: false,
      message: 'Not enough training data',
      episodes: 0,
    };
  }

  let episodeRewards = [];

  // Train on historical episodes
  for (let i = 0; i < predictions.length - 1; i++) {
    const prediction = predictions[i];
    const nextPrediction = predictions[i + 1];

    const state = extractStateFeatures(prediction, {});
    const nextState = extractStateFeatures(nextPrediction, {});
    const reward = calculateReward(prediction);

    // Determine action from prediction
    const action = `${prediction.position_direction}_${
      prediction.confidence_score > 0.8 ? 'HIGH' :
      prediction.confidence_score > 0.6 ? 'MED' : 'LOW'
    }`;

    // Update Q-value
    updateQValue(
      trainingState.qTable,
      state,
      action,
      reward,
      nextState,
      trainingState.learningRate,
      trainingState.gamma
    );

    trainingState.episodeCount++;
    trainingState.totalReward += reward;
    episodeRewards.push(reward);

    // Save episode to database
    await supabase.from('bot_training_episodes').insert({
      bot_name: botName,
      episode_number: trainingState.episodeCount,
      state_features: state,
      action_taken: { action, direction: prediction.position_direction },
      reward,
      next_state_features: nextState,
      prediction_id: prediction.id,
      market_regime: prediction.market_regime,
      profit_loss_percent: prediction.profit_loss_percent,
    });
  }

  // Decay epsilon (exploration rate)
  trainingState.epsilon = Math.max(0.05, trainingState.epsilon * 0.99);

  // Calculate average reward
  const avgReward = episodeRewards.length > 0
    ? episodeRewards.reduce((sum, r) => sum + r, 0) / episodeRewards.length
    : 0;

  // Save training state
  await supabase.from('bot_training_states').upsert({
    bot_name: botName,
    q_table: trainingState.qTable,
    model_state: {
      stateCount: Object.keys(trainingState.qTable).length,
      actionCoverage: calculateActionCoverage(trainingState.qTable),
    },
    total_episodes: trainingState.episodeCount,
    total_rewards: trainingState.totalReward,
    avg_reward: avgReward,
    learning_rate: trainingState.learningRate,
    epsilon: trainingState.epsilon,
    last_trained: new Date().toISOString(),
    training_version: (existingState?.training_version || 0) + 1,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: 'bot_name',
  });

  return {
    success: true,
    bot_name: botName,
    episodes_trained: predictions.length,
    total_episodes: trainingState.episodeCount,
    avg_reward: avgReward,
    epsilon: trainingState.epsilon,
    q_table_size: Object.keys(trainingState.qTable).length,
  };
}

function calculateActionCoverage(qTable: QTable): number {
  let totalActions = 0;
  let coveredActions = 0;

  for (const stateKey in qTable) {
    const actions = qTable[stateKey];
    totalActions += 7;
    coveredActions += Object.keys(actions).length;
  }

  return totalActions > 0 ? (coveredActions / totalActions) * 100 : 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'train';
    const botName = url.searchParams.get('bot');

    // Get training state
    if (action === 'get') {
      const { data } = await supabase
        .from('bot_training_states')
        .select('*')
        .eq('bot_name', botName)
        .maybeSingle();

      return new Response(JSON.stringify({
        success: true,
        training_state: data,
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }

    // Train all bots or specific bot
    if (action === 'train') {
      const startTime = Date.now();

      if (botName) {
        const result = await trainBot(supabase, botName);
        return new Response(JSON.stringify({
          ...result,
          duration_ms: Date.now() - startTime,
        }), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      }

      // Train multiple bots
      const { data: botList } = await supabase
        .from('bot_predictions')
        .select('bot_name')
        .limit(1000);

      const uniqueBots = [...new Set(botList?.map((b: any) => b.bot_name) || [])].slice(0, 10);
      const results = [];

      for (const bot of uniqueBots) {
        try {
          const result = await trainBot(supabase, bot);
          results.push(result);
        } catch (err) {
          console.error(`Failed to train ${bot}:`, err);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        bots_trained: results.filter(r => r.success).length,
        results,
        duration_ms: Date.now() - startTime,
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }

    // Get recommended action for current state
    if (action === 'predict') {
      const stateStr = url.searchParams.get('state');
      if (!stateStr || !botName) {
        throw new Error('Bot name and state required for prediction');
      }

      const state: StateFeatures = JSON.parse(stateStr);

      const { data: trainingState } = await supabase
        .from('bot_training_states')
        .select('*')
        .eq('bot_name', botName)
        .maybeSingle();

      if (!trainingState) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Bot not trained yet',
        }), {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      }

      const recommendedAction = selectAction(
        state,
        trainingState.q_table || {},
        0.05
      );

      return new Response(JSON.stringify({
        success: true,
        recommended_action: recommendedAction,
        q_values: trainingState.q_table[stateToKey(state)] || {},
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Invalid action',
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Reinforcement learning error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
