import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ParameterSet {
  [key: string]: number | string;
}

interface BacktestResult {
  accuracy: number;
  profitLoss: number;
  sharpeRatio: number;
  maxDrawdown: number;
  tradeCount: number;
  winRate: number;
}

// Parameter ranges for different bot types
const PARAMETER_RANGES: Record<string, Record<string, number[]>> = {
  RSI: {
    period: [10, 12, 14, 16, 18, 20],
    overbought: [65, 70, 75, 80],
    oversold: [20, 25, 30, 35],
  },
  MACD: {
    fastPeriod: [8, 10, 12, 14],
    slowPeriod: [20, 24, 26, 28, 30],
    signalPeriod: [7, 9, 11],
  },
  EMA: {
    shortPeriod: [8, 10, 12, 15],
    longPeriod: [20, 25, 30, 35, 40],
  },
  SMA: {
    shortPeriod: [10, 15, 20, 25],
    longPeriod: [40, 50, 60, 70, 80, 100],
  },
  Bollinger: {
    period: [15, 20, 25, 30],
    stdDev: [1.5, 2.0, 2.5, 3.0],
  },
  Stochastic: {
    kPeriod: [10, 12, 14, 16],
    dPeriod: [3, 4, 5],
    smooth: [1, 2, 3],
  },
  ADX: {
    period: [10, 14, 18, 20, 25],
    threshold: [20, 25, 30, 35],
  },
  ATR: {
    period: [10, 14, 20, 25],
    multiplier: [1.5, 2.0, 2.5, 3.0],
  },
};

// Generate parameter combinations for a bot
function generateParameterCombinations(botName: string, maxCombinations = 20): ParameterSet[] {
  const botType = Object.keys(PARAMETER_RANGES).find(type => botName.includes(type));

  if (!botType) {
    return [{}];
  }

  const ranges = PARAMETER_RANGES[botType];
  const paramNames = Object.keys(ranges);
  const combinations: ParameterSet[] = [];

  // Generate smart combinations (not full cartesian product)
  for (let i = 0; i < maxCombinations; i++) {
    const params: ParameterSet = {};
    for (const paramName of paramNames) {
      const values = ranges[paramName];
      const index = Math.floor(Math.random() * values.length);
      params[paramName] = values[index];
    }
    combinations.push(params);
  }

  return combinations;
}

// Simulate backtest for parameter set
async function runBacktest(
  supabase: any,
  botName: string,
  parameters: ParameterSet,
  regime: string,
  historicalData: any[]
): Promise<BacktestResult> {
  // Fetch historical predictions for this bot
  const { data: predictions } = await supabase
    .from('bot_predictions')
    .select('*')
    .eq('bot_name', botName)
    .eq('market_regime', regime === 'ALL' ? undefined : regime)
    .limit(100);

  if (!predictions || predictions.length < 10) {
    return {
      accuracy: 0,
      profitLoss: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      tradeCount: 0,
      winRate: 0,
    };
  }

  let wins = 0;
  let losses = 0;
  let totalPL = 0;
  const plHistory: number[] = [];

  for (const pred of predictions) {
    if (pred.outcome_status === 'success') {
      wins++;
      const pl = pred.profit_loss_percent || 2.5;
      totalPL += pl;
      plHistory.push(pl);
    } else if (pred.outcome_status === 'failed') {
      losses++;
      const pl = pred.profit_loss_percent || -1.5;
      totalPL += pl;
      plHistory.push(pl);
    }
  }

  const tradeCount = wins + losses;
  const accuracy = tradeCount > 0 ? (wins / tradeCount) * 100 : 0;
  const winRate = tradeCount > 0 ? wins / tradeCount : 0;
  const avgPL = tradeCount > 0 ? totalPL / tradeCount : 0;

  // Calculate Sharpe Ratio
  const stdDev = calculateStdDev(plHistory);
  const sharpeRatio = stdDev > 0 ? (avgPL / stdDev) * Math.sqrt(252) : 0;

  // Calculate Max Drawdown
  const maxDrawdown = calculateMaxDrawdown(plHistory);

  return {
    accuracy,
    profitLoss: totalPL,
    sharpeRatio,
    maxDrawdown,
    tradeCount,
    winRate,
  };
}

function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  return Math.sqrt(variance);
}

function calculateMaxDrawdown(plHistory: number[]): number {
  let peak = 0;
  let maxDD = 0;
  let cumulative = 0;

  for (const pl of plHistory) {
    cumulative += pl;
    if (cumulative > peak) peak = cumulative;
    const drawdown = peak - cumulative;
    if (drawdown > maxDD) maxDD = drawdown;
  }

  return maxDD;
}

// Calculate composite score for parameter set
function calculateScore(result: BacktestResult): number {
  // Weighted scoring: accuracy (40%), profit (30%), sharpe (20%), drawdown (10%)
  const accuracyScore = result.accuracy * 0.4;
  const profitScore = Math.max(0, Math.min(100, result.profitLoss * 2)) * 0.3;
  const sharpeScore = Math.max(0, Math.min(100, result.sharpeRatio * 20)) * 0.2;
  const drawdownScore = Math.max(0, 100 - result.maxDrawdown * 2) * 0.1;

  return accuracyScore + profitScore + sharpeScore + drawdownScore;
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
    const action = url.searchParams.get('action') || 'optimize';
    const botName = url.searchParams.get('bot');
    const regime = url.searchParams.get('regime') || 'ALL';

    // Get optimal parameters for a specific bot
    if (action === 'get') {
      const { data } = await supabase
        .from('bot_parameters')
        .select('*')
        .eq('bot_name', botName)
        .eq('market_regime', regime)
        .eq('is_active', true)
        .maybeSingle();

      return new Response(JSON.stringify({
        success: true,
        parameters: data?.parameters || {},
        performance_score: data?.performance_score || 0,
        last_optimized: data?.last_optimized,
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }

    // Run optimization
    if (action === 'optimize') {
      const startTime = Date.now();

      // Get list of bots to optimize
      const { data: botList } = await supabase
        .from('bot_predictions')
        .select('bot_name')
        .limit(1000);

      const uniqueBots = botName
        ? [botName]
        : [...new Set(botList?.map((b: any) => b.bot_name) || [])].slice(0, 10);

      const regimes = regime === 'ALL' ? ['BULL', 'BEAR', 'SIDEWAYS', 'VOLATILE'] : [regime];

      const optimizationResults = [];

      for (const bot of uniqueBots) {
        for (const reg of regimes) {
          console.log(`Optimizing ${bot} for ${reg} regime...`);

          const paramCombinations = generateParameterCombinations(bot, 15);
          let bestParams = {};
          let bestScore = 0;
          let bestResult: BacktestResult | null = null;

          for (const params of paramCombinations) {
            const result = await runBacktest(supabase, bot, params, reg, []);
            const score = calculateScore(result);

            // Save optimization attempt
            await supabase.from('bot_parameter_optimization_history').insert({
              bot_name: bot,
              market_regime: reg,
              parameters_tested: params,
              backtest_results: result,
              accuracy_rate: result.accuracy,
              profit_loss: result.profitLoss,
              sharpe_ratio: result.sharpeRatio,
              max_drawdown: result.maxDrawdown,
              trade_count: result.tradeCount,
              optimization_duration_ms: Date.now() - startTime,
            });

            if (score > bestScore) {
              bestScore = score;
              bestParams = params;
              bestResult = result;
            }
          }

          // Save best parameters
          if (bestResult && bestResult.tradeCount >= 10) {
            await supabase.from('bot_parameters').upsert({
              bot_name: bot,
              market_regime: reg,
              parameters: bestParams,
              performance_score: bestScore,
              sample_size: bestResult.tradeCount,
              last_optimized: new Date().toISOString(),
              is_active: true,
            }, {
              onConflict: 'bot_name,market_regime',
            });

            optimizationResults.push({
              bot,
              regime: reg,
              score: bestScore,
              parameters: bestParams,
              accuracy: bestResult.accuracy,
            });
          }
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: `Optimized ${uniqueBots.length} bots across ${regimes.length} regimes`,
        results: optimizationResults,
        duration_ms: Date.now() - startTime,
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
    console.error('Parameter optimization error:', error);
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
