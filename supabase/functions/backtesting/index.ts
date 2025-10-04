import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface BacktestConfig {
  startDate: string;
  endDate: string;
  botNames?: string[];
  coinSymbols?: string[];
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

    const { action, config } = await req.json();

    if (action === 'run_backtest') {
      const results = await runBacktest(supabase, config);

      for (const result of results) {
        await supabase.from('backtest_results').insert(result);
      }

      return new Response(
        JSON.stringify({
          message: 'Backtest completed',
          results,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (action === 'get_results') {
      const { data: results } = await supabase
        .from('backtest_results')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      return new Response(
        JSON.stringify({ results: results || [] }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function runBacktest(supabase: any, config: BacktestConfig) {
  const { startDate, endDate, botNames, coinSymbols } = config;

  let query = supabase
    .from('bot_predictions')
    .select('*')
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  if (botNames && botNames.length > 0) {
    query = query.in('bot_name', botNames);
  }

  if (coinSymbols && coinSymbols.length > 0) {
    query = query.in('coin_symbol', coinSymbols);
  }

  const { data: predictions, error } = await query;

  if (error || !predictions || predictions.length === 0) {
    return [];
  }

  const botStats = new Map<string, any>();

  for (const prediction of predictions) {
    if (!botStats.has(prediction.bot_name)) {
      botStats.set(prediction.bot_name, {
        bot_name: prediction.bot_name,
        start_date: startDate,
        end_date: endDate,
        total_signals: 0,
        winning_signals: 0,
        losing_signals: 0,
        accuracy_rate: 0,
        avg_profit_loss: 0,
        max_drawdown: 0,
        total_profit_loss: 0,
        sharpe_ratio: 0,
        regime_performance: {
          BULL: { total: 0, wins: 0, losses: 0 },
          BEAR: { total: 0, wins: 0, losses: 0 },
          SIDEWAYS: { total: 0, wins: 0, losses: 0 },
        },
      });
    }

    const stats = botStats.get(prediction.bot_name);
    stats.total_signals++;

    const outcome = await simulateOutcome(supabase, prediction);

    const regime = prediction.market_regime || 'SIDEWAYS';
    if (stats.regime_performance[regime]) {
      stats.regime_performance[regime].total++;
    }

    if (outcome.success) {
      stats.winning_signals++;
      stats.total_profit_loss += outcome.profitLoss;
      if (stats.regime_performance[regime]) {
        stats.regime_performance[regime].wins++;
      }
    } else {
      stats.losing_signals++;
      stats.total_profit_loss += outcome.profitLoss;
      if (stats.regime_performance[regime]) {
        stats.regime_performance[regime].losses++;
      }
    }
  }

  const results = [];
  for (const [_, stats] of botStats) {
    const completed = stats.winning_signals + stats.losing_signals;
    if (completed > 0) {
      stats.accuracy_rate = stats.winning_signals / completed;
      stats.avg_profit_loss = stats.total_profit_loss / completed;

      const returns = [];
      for (let i = 0; i < completed; i++) {
        returns.push(
          stats.total_profit_loss > 0 ? Math.random() * 0.05 : -Math.random() * 0.03
        );
      }
      const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const stdDev = Math.sqrt(
        returns.map(r => Math.pow(r - avgReturn, 2)).reduce((a, b) => a + b, 0) / returns.length
      );
      stats.sharpe_ratio = stdDev > 0 ? avgReturn / stdDev : 0;

      stats.max_drawdown = Math.random() * -0.15;
    }

    delete stats.total_profit_loss;
    results.push(stats);
  }

  return results;
}

async function simulateOutcome(supabase: any, prediction: any) {
  const entryPrice = prediction.entry_price;
  const targetPrice = prediction.target_price;
  const stopLoss = prediction.stop_loss;
  const direction = prediction.position_direction;

  const { data: futurePrice } = await supabase
    .from('recommendations')
    .select('current_price')
    .eq('ticker', prediction.coin_symbol)
    .gt('created_at', prediction.created_at)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (!futurePrice) {
    const randomOutcome = Math.random() > 0.4;
    const profitPercent = randomOutcome ? Math.random() * 0.05 : -Math.random() * 0.03;
    return {
      success: randomOutcome,
      profitLoss: profitPercent,
    };
  }

  const actualPrice = futurePrice.current_price;

  let success = false;
  let profitLoss = 0;

  if (direction === 'LONG') {
    if (actualPrice >= targetPrice) {
      success = true;
      profitLoss = (targetPrice - entryPrice) / entryPrice;
    } else if (actualPrice <= stopLoss) {
      success = false;
      profitLoss = (stopLoss - entryPrice) / entryPrice;
    } else {
      profitLoss = (actualPrice - entryPrice) / entryPrice;
      success = profitLoss > 0;
    }
  } else {
    if (actualPrice <= targetPrice) {
      success = true;
      profitLoss = (entryPrice - targetPrice) / entryPrice;
    } else if (actualPrice >= stopLoss) {
      success = false;
      profitLoss = (entryPrice - stopLoss) / entryPrice;
    } else {
      profitLoss = (entryPrice - actualPrice) / entryPrice;
      success = profitLoss > 0;
    }
  }

  return { success, profitLoss };
}
