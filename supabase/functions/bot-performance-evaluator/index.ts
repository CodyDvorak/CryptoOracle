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
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${symbol.toLowerCase()}&vs_currencies=usd`
    );

    if (!response.ok) return null;

    const data = await response.json();
    return data[symbol.toLowerCase()]?.usd || null;
  } catch (error) {
    console.error(`Failed to fetch price for ${symbol}:`, error);
    return null;
  }
}

function evaluatePrediction(prediction: BotPrediction, currentPrice: number): { success: boolean; reason: string } {
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
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: false });

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

    for (const prediction of predictions) {
      const currentPrice = priceCache[prediction.coin_symbol];

      if (!currentPrice) continue;

      const result = evaluatePrediction(prediction, currentPrice);

      if (!botResults[prediction.bot_name]) {
        botResults[prediction.bot_name] = { successful: 0, failed: 0, neutral: 0 };
      }

      if (result.success && result.reason === 'Target reached') {
        botResults[prediction.bot_name].successful++;
      } else if (!result.success && result.reason === 'Stop loss hit') {
        botResults[prediction.bot_name].failed++;
      } else {
        botResults[prediction.bot_name].neutral++;
      }
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
