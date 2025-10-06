import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface BotPrediction {
  id: string;
  bot_name: string;
  coin_symbol: string;
  entry_price: number;
  target_price: number;
  stop_loss: number;
  position_direction: 'LONG' | 'SHORT';
  confidence_score: number;
  created_at: string;
}

async function getCurrentPrice(symbol: string): Promise<number | null> {
  const cmcApiKey = Deno.env.get('COINMARKETCAP_API_KEY') || '';
  const coinGeckoApiKey = Deno.env.get('COINGECKO_API_KEY') || '';
  const cryptoCompareApiKey = Deno.env.get('CRYPTOCOMPARE_API_KEY') || '';

  let price = await getCurrentPriceFromCMC(symbol, cmcApiKey);
  if (price) return price;

  price = await getCurrentPriceFromCoinGecko(symbol, coinGeckoApiKey);
  if (price) return price;

  price = await getCurrentPriceFromCryptoCompare(symbol, cryptoCompareApiKey);
  return price;
}

async function getCurrentPriceFromCMC(symbol: string, apiKey: string): Promise<number | null> {
  try {
    const response = await fetch(
      `https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?symbol=${symbol.toUpperCase()}`,
      {
        headers: {
          'X-CMC_PRO_API_KEY': apiKey,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    return data.data?.[symbol.toUpperCase()]?.[0]?.quote?.USD?.price || null;
  } catch (error) {
    console.error(`CMC price fetch failed for ${symbol}:`, error);
    return null;
  }
}

async function getCurrentPriceFromCoinGecko(symbol: string, apiKey: string): Promise<number | null> {
  try {
    const headers: any = { 'Accept': 'application/json' };
    if (apiKey) {
      headers['x-cg-pro-api-key'] = apiKey;
    }

    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${symbol.toLowerCase()}&vs_currencies=usd`,
      { headers }
    );

    if (!response.ok) return null;

    const data = await response.json();
    return data[symbol.toLowerCase()]?.usd || null;
  } catch (error) {
    console.error(`CoinGecko price fetch failed for ${symbol}:`, error);
    return null;
  }
}

async function getCurrentPriceFromCryptoCompare(symbol: string, apiKey: string): Promise<number | null> {
  try {
    const response = await fetch(
      `https://min-api.cryptocompare.com/data/price?fsym=${symbol.toUpperCase()}&tsyms=USD`,
      {
        headers: {
          'authorization': `Apikey ${apiKey}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    return data.USD || null;
  } catch (error) {
    console.error(`CryptoCompare price fetch failed for ${symbol}:`, error);
    return null;
  }
}

async function evaluatePredictionWithHistory(
  prediction: BotPrediction,
  currentPrice: number,
  supabase: any
): Promise<{ success: boolean; reason: string; exitPrice?: number }> {
  const { position_direction, entry_price, target_price, stop_loss, coin_symbol, created_at } = prediction;

  const { data: priceHistory, error } = await supabase
    .from('price_history')
    .select('price, timestamp')
    .eq('symbol', coin_symbol)
    .gte('timestamp', created_at)
    .order('timestamp', { ascending: true });

  if (error || !priceHistory || priceHistory.length === 0) {
    return evaluatePredictionSnapshot(prediction, currentPrice);
  }

  if (position_direction === 'LONG') {
    const targetHit = priceHistory.find((p: any) => p.price >= target_price);
    if (targetHit) {
      return { success: true, reason: 'Target reached', exitPrice: targetHit.price };
    }

    const stopLossHit = priceHistory.find((p: any) => p.price <= stop_loss);
    if (stopLossHit) {
      return { success: false, reason: 'Stop loss hit', exitPrice: stopLossHit.price };
    }

    return { success: currentPrice > entry_price, reason: 'In progress - evaluating current position' };
  } else {
    const targetHit = priceHistory.find((p: any) => p.price <= target_price);
    if (targetHit) {
      return { success: true, reason: 'Target reached', exitPrice: targetHit.price };
    }

    const stopLossHit = priceHistory.find((p: any) => p.price >= stop_loss);
    if (stopLossHit) {
      return { success: false, reason: 'Stop loss hit', exitPrice: stopLossHit.price };
    }

    return { success: currentPrice < entry_price, reason: 'In progress - evaluating current position' };
  }
}

function evaluatePredictionSnapshot(prediction: BotPrediction, currentPrice: number): { success: boolean; reason: string } {
  const { position_direction, entry_price, target_price, stop_loss } = prediction;

  if (position_direction === 'LONG') {
    if (currentPrice >= target_price) {
      return { success: true, reason: 'Target reached' };
    } else if (currentPrice <= stop_loss) {
      return { success: false, reason: 'Stop loss hit' };
    } else {
      return { success: currentPrice > entry_price, reason: 'In progress - evaluating current position' };
    }
  } else {
    if (currentPrice <= target_price) {
      return { success: true, reason: 'Target reached' };
    } else if (currentPrice >= stop_loss) {
      return { success: false, reason: 'Stop loss hit' };
    } else {
      return { success: currentPrice < entry_price, reason: 'In progress - evaluating current position' };
    }
  }
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
    const hoursAgo = parseInt(url.searchParams.get('hours') || '24');

    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hoursAgo);

    const { data: predictions, error } = await supabase
      .from('bot_predictions')
      .select('*')
      .gte('timestamp', cutoffDate.toISOString())
      .is('outcome_status', null)
      .order('timestamp', { ascending: false });

    if (error) throw error;

    if (!predictions || predictions.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No predictions to evaluate',
        evaluated: 0
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }

    console.log(`Evaluating ${predictions.length} predictions...`);

    const uniqueSymbols = [...new Set(predictions.map(p => p.coin_symbol))];
    const priceCache: Record<string, number | null> = {};

    for (const symbol of uniqueSymbols) {
      priceCache[symbol] = await getCurrentPrice(symbol);
      await new Promise(resolve => setTimeout(resolve, 1200));
    }

    const botResults: Record<string, { successful: number; failed: number; neutral: number }> = {};
    const updatedPredictions = [];

    for (const prediction of predictions) {
      const currentPrice = priceCache[prediction.coin_symbol];

      if (!currentPrice) continue;

      const result = await evaluatePredictionWithHistory(prediction, currentPrice, supabase);

      if (!botResults[prediction.bot_name]) {
        botResults[prediction.bot_name] = { successful: 0, failed: 0, neutral: 0 };
      }

      let outcomeStatus = null;
      let profitLossPercent = 0;
      const exitPrice = result.exitPrice || currentPrice;

      if (result.success && result.reason === 'Target reached') {
        botResults[prediction.bot_name].successful++;
        outcomeStatus = 'success';
        profitLossPercent = prediction.position_direction === 'LONG'
          ? ((exitPrice - prediction.entry_price) / prediction.entry_price) * 100
          : ((prediction.entry_price - exitPrice) / prediction.entry_price) * 100;
      } else if (!result.success && result.reason === 'Stop loss hit') {
        botResults[prediction.bot_name].failed++;
        outcomeStatus = 'failed';
        profitLossPercent = prediction.position_direction === 'LONG'
          ? ((exitPrice - prediction.entry_price) / prediction.entry_price) * 100
          : ((prediction.entry_price - exitPrice) / prediction.entry_price) * 100;
      } else {
        botResults[prediction.bot_name].neutral++;
      }

      if (outcomeStatus) {
        updatedPredictions.push({
          id: prediction.id,
          outcome_status: outcomeStatus,
          outcome_price: exitPrice,
          outcome_checked_at: new Date().toISOString(),
          profit_loss_percent: profitLossPercent
        });
      }
    }

    for (const update of updatedPredictions) {
      await supabase
        .from('bot_predictions')
        .update({
          outcome_status: update.outcome_status,
          outcome_price: update.outcome_price,
          outcome_checked_at: update.outcome_checked_at,
          profit_loss_percent: update.profit_loss_percent
        })
        .eq('id', update.id);
    }

    const metricsToUpdate = [];
    const today = new Date().toISOString().split('T')[0];

    for (const [botName, results] of Object.entries(botResults)) {
      const total = results.successful + results.failed + results.neutral;
      const accuracyRate = total > 0
        ? ((results.successful / (results.successful + results.failed)) * 100).toFixed(2)
        : '0.00';

      const { data: existingMetric } = await supabase
        .from('bot_learning_metrics')
        .select('*')
        .eq('bot_name', botName)
        .eq('metric_date', today)
        .maybeSingle();

      if (existingMetric) {
        await supabase
          .from('bot_learning_metrics')
          .update({
            total_predictions: existingMetric.total_predictions + total,
            successful_predictions: existingMetric.successful_predictions + results.successful,
            failed_predictions: existingMetric.failed_predictions + results.failed,
            avg_confidence: existingMetric.avg_confidence,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingMetric.id);
      } else {
        metricsToUpdate.push({
          bot_name: botName,
          metric_date: today,
          total_predictions: total,
          successful_predictions: results.successful,
          failed_predictions: results.failed,
          avg_confidence: 0.70,
          performance_trend: 'stable',
          learning_score: parseFloat(accuracyRate)
        });
      }
    }

    if (metricsToUpdate.length > 0) {
      await supabase.from('bot_learning_metrics').insert(metricsToUpdate);
    }

    return new Response(JSON.stringify({
      success: true,
      evaluated: predictions.length,
      updated: updatedPredictions.length,
      unique_bots: Object.keys(botResults).length,
      bot_results: botResults,
      message: 'Bot performance evaluation completed'
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Performance evaluator error:', error);
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
