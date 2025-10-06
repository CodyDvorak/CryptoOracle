import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

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

    // Always calculate fresh data from ALL predictions in the database
    // This ensures pending count includes all historical pending predictions
    const { data: predictions, error: predsError } = await supabase
      .from('bot_predictions')
      .select('*');

    if (predsError) throw predsError;

    const botStats = new Map();

    predictions.forEach(pred => {
      if (!botStats.has(pred.bot_name)) {
        botStats.set(pred.bot_name, {
          bot_name: pred.bot_name,
          total_predictions: 0,
          successful_predictions: 0,
          failed_predictions: 0,
          pending_predictions: 0,
          accuracy_rate: 0,
          avg_profit_loss: 0,
          total_profit_loss: 0,
          win_loss_ratio: 0,
          total_confidence: 0,
          confidence_count: 0,
          avg_confidence: 0,
          regime_stats: {
            BULL: { total: 0, success: 0, failed: 0 },
            BEAR: { total: 0, success: 0, failed: 0 },
            SIDEWAYS: { total: 0, success: 0, failed: 0 },
          },
        });
      }

      const stats = botStats.get(pred.bot_name);
      stats.total_predictions++;

      if (pred.confidence_score) {
        stats.total_confidence += pred.confidence_score;
        stats.confidence_count++;
      }

      const regime = pred.market_regime || 'SIDEWAYS';
      if (stats.regime_stats[regime]) {
        stats.regime_stats[regime].total++;
      }

      if (pred.outcome_status === 'success') {
        stats.successful_predictions++;
        stats.total_profit_loss += pred.profit_loss_percent || 0;
        if (stats.regime_stats[regime]) {
          stats.regime_stats[regime].success++;
        }
      } else if (pred.outcome_status === 'failed') {
        stats.failed_predictions++;
        stats.total_profit_loss += pred.profit_loss_percent || 0;
        if (stats.regime_stats[regime]) {
          stats.regime_stats[regime].failed++;
        }
      } else {
        stats.pending_predictions++;
      }
    });

    const performanceData = Array.from(botStats.values()).map(stats => {
      const completed = stats.successful_predictions + stats.failed_predictions;
      stats.accuracy_rate = completed > 0 ? (stats.successful_predictions / completed) * 100 : 0;
      stats.avg_profit_loss = completed > 0 ? stats.total_profit_loss / completed : 0;
      stats.win_loss_ratio = stats.failed_predictions > 0 
        ? stats.successful_predictions / stats.failed_predictions 
        : stats.successful_predictions > 0 ? stats.successful_predictions : 0;
      stats.avg_confidence = stats.confidence_count > 0
        ? stats.total_confidence / stats.confidence_count
        : 0;

      const market_regime_performance = {};
      Object.entries(stats.regime_stats).forEach(([regime, regimeData]: [string, any]) => {
        if (regimeData.total > 0) {
          const regimeCompleted = regimeData.success + regimeData.failed;
          market_regime_performance[regime] = {
            accuracy: regimeCompleted > 0 ? regimeData.success / regimeCompleted : 0,
            total: regimeData.total,
            success: regimeData.success,
            failed: regimeData.failed,
          };
        }
      });

      delete stats.total_profit_loss;
      delete stats.total_confidence;
      delete stats.confidence_count;
      delete stats.regime_stats;

      return {
        ...stats,
        market_regime_performance,
      };
    });

    performanceData.sort((a, b) => b.accuracy_rate - a.accuracy_rate);

    for (const botData of performanceData) {
      await supabase
        .from('bot_performance')
        .upsert(
          {
            bot_name: botData.bot_name,
            total_predictions: botData.total_predictions,
            successful_predictions: botData.successful_predictions,
            failed_predictions: botData.failed_predictions,
            pending_predictions: botData.pending_predictions,
            accuracy_rate: botData.accuracy_rate,
            avg_profit_loss: botData.avg_profit_loss,
            last_updated: new Date().toISOString(),
          },
          { onConflict: 'bot_name' }
        );
    }

    return new Response(
      JSON.stringify({
        bots: performanceData,
        totalBots: performanceData.length,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
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