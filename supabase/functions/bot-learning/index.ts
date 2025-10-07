import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface BotPerformanceUpdate {
  botName: string;
  wasCorrect: boolean;
  profitLoss: number;
  marketRegime: string;
  confidence: number;
  predictionId: string;
}

interface BotMetrics {
  bot_name: string;
  total_predictions: number;
  successful_predictions: number;
  failed_predictions: number;
  accuracy_rate: number;
  avg_confidence: number;
}

/**
 * Bot Learning Edge Function
 *
 * Handles real-time bot performance updates and learning.
 * Provides API endpoints for bot metrics, outcomes evaluation, and weight adjustments.
 */

function generateInsights(bot: BotMetrics, historicalData: any[]): any[] {
  const insights = [];

  const completed = bot.successful_predictions + bot.failed_predictions;
  if (completed === 0) return insights;

  if (bot.accuracy_rate >= 60) {
    insights.push({
      bot_name: bot.bot_name,
      insight_type: 'strength',
      insight_text: `Consistently strong performance with ${bot.accuracy_rate.toFixed(1)}% accuracy. This bot excels in current market conditions.`,
      confidence_score: Math.min(95, bot.accuracy_rate + 20),
      metadata: { accuracy: bot.accuracy_rate, sample_size: completed }
    });
  }

  if (bot.accuracy_rate < 40 && completed >= 10) {
    insights.push({
      bot_name: bot.bot_name,
      insight_type: 'weakness',
      insight_text: `Underperforming with ${bot.accuracy_rate.toFixed(1)}% accuracy. Consider adjusting parameters or market regime filters.`,
      confidence_score: 85,
      metadata: { accuracy: bot.accuracy_rate, sample_size: completed }
    });
  }

  if (historicalData.length >= 2) {
    const recent = historicalData[0];
    const previous = historicalData[1];

    if (recent.accuracy_rate > previous.accuracy_rate + 10) {
      insights.push({
        bot_name: bot.bot_name,
        insight_type: 'trend',
        insight_text: `Performance improving rapidly - accuracy increased from ${previous.accuracy_rate.toFixed(1)}% to ${recent.accuracy_rate.toFixed(1)}%. Bot is adapting well.`,
        confidence_score: 75,
        metadata: {
          previous_accuracy: previous.accuracy_rate,
          current_accuracy: recent.accuracy_rate,
          improvement: recent.accuracy_rate - previous.accuracy_rate
        }
      });
    } else if (recent.accuracy_rate < previous.accuracy_rate - 10) {
      insights.push({
        bot_name: bot.bot_name,
        insight_type: 'trend',
        insight_text: `Performance declining - accuracy dropped from ${previous.accuracy_rate.toFixed(1)}% to ${recent.accuracy_rate.toFixed(1)}%. Market conditions may have changed.`,
        confidence_score: 75,
        metadata: {
          previous_accuracy: previous.accuracy_rate,
          current_accuracy: recent.accuracy_rate,
          decline: previous.accuracy_rate - recent.accuracy_rate
        }
      });
    }
  }

  if (bot.avg_confidence > 0.8 && bot.accuracy_rate > 55) {
    insights.push({
      bot_name: bot.bot_name,
      insight_type: 'recommendation',
      insight_text: `High confidence (${(bot.avg_confidence * 100).toFixed(0)}%) combined with strong accuracy makes this bot reliable for current market conditions.`,
      confidence_score: 90,
      metadata: { confidence: bot.avg_confidence, accuracy: bot.accuracy_rate }
    });
  }

  if (bot.avg_confidence < 0.65 || (bot.accuracy_rate < 45 && completed >= 15)) {
    const reason = bot.avg_confidence < 0.65
      ? 'low confidence scores suggest uncertainty'
      : 'poor accuracy indicates misalignment with market';

    insights.push({
      bot_name: bot.bot_name,
      insight_type: 'recommendation',
      insight_text: `Reduce reliance on this bot - ${reason}. Consider parameter optimization or disabling temporarily.`,
      confidence_score: 80,
      metadata: { confidence: bot.avg_confidence, accuracy: bot.accuracy_rate }
    });
  }

  return insights;
}

function calculateLearningScore(bot: BotMetrics, historicalData: any[]): number {
  let score = 50;

  score += (bot.accuracy_rate - 50);

  if (historicalData.length >= 2) {
    const recent = historicalData[0];
    const previous = historicalData[1];
    const improvement = recent.accuracy_rate - previous.accuracy_rate;
    score += improvement * 2;
  }

  const completed = bot.successful_predictions + bot.failed_predictions;
  if (completed > 20) score += 10;
  if (completed > 50) score += 10;

  if (bot.avg_confidence > 0.75) score += 10;
  if (bot.avg_confidence < 0.60) score -= 10;

  return Math.max(0, Math.min(100, score));
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
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });

    const url = new URL(req.url);
    const pathname = url.pathname;

    // NEW ENDPOINTS FOR LEARNING SYSTEM

    // Update bot performance (called after predictions are evaluated)
    if (pathname.endsWith('/update') && req.method === 'POST') {
      const updates: BotPerformanceUpdate[] = await req.json();

      for (const update of updates) {
        await supabase.from('bot_performance_history').insert({
          bot_name: update.botName,
          was_correct: update.wasCorrect,
          confidence_score: update.confidence,
          profit_loss: update.profitLoss,
          market_regime: update.marketRegime,
          prediction_id: update.predictionId,
          recorded_at: new Date().toISOString(),
        });
      }

      await supabase.rpc('update_bot_accuracy_metrics');

      return new Response(
        JSON.stringify({
          success: true,
          message: `Updated performance for ${updates.length} bots`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Trigger outcome evaluation
    if (pathname.endsWith('/evaluate') && req.method === 'POST') {
      const { timeframe = '24h' } = await req.json();

      const { data: count } = await supabase.rpc('evaluate_pending_outcomes', {
        p_timeframe: timeframe,
      });

      return new Response(
        JSON.stringify({
          success: true,
          evaluated: count,
          timeframe,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get bot accuracy metrics
    if (pathname.endsWith('/accuracy-metrics') && req.method === 'GET') {
      const botName = url.searchParams.get('bot');
      const regime = url.searchParams.get('regime') || 'ALL';

      let query = supabase
        .from('bot_accuracy_metrics')
        .select('*')
        .order('accuracy_rate', { ascending: false });

      if (botName) query = query.eq('bot_name', botName);
      if (regime) query = query.eq('market_regime', regime);

      const { data, error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({ success: true, metrics: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get top performing bots
    if (pathname.endsWith('/top-performers') && req.method === 'GET') {
      const regime = url.searchParams.get('regime') || 'ALL';
      const limit = parseInt(url.searchParams.get('limit') || '10');

      const { data, error } = await supabase
        .from('bot_accuracy_metrics')
        .select('*')
        .eq('market_regime', regime)
        .eq('is_enabled', true)
        .gte('total_predictions', 20)
        .order('last_30_days_accuracy', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, topPerformers: data, regime }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get poor performing bots
    if (pathname.endsWith('/poor-performers') && req.method === 'GET') {
      const { data, error } = await supabase
        .from('bot_accuracy_metrics')
        .select('*')
        .eq('is_enabled', true)
        .gte('total_predictions', 50)
        .lt('accuracy_rate', 0.40)
        .order('accuracy_rate', { ascending: true })
        .limit(20);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, poorPerformers: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Manually adjust bot weight
    if (pathname.endsWith('/adjust-weight') && req.method === 'POST') {
      const { botName, regime, newWeight, reason } = await req.json();

      const { data: bot } = await supabase
        .from('bot_accuracy_metrics')
        .select('*')
        .eq('bot_name', botName)
        .eq('market_regime', regime)
        .single();

      if (!bot) {
        return new Response(
          JSON.stringify({ error: 'Bot not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabase
        .from('bot_accuracy_metrics')
        .update({
          current_weight: newWeight,
          weight_history: [
            ...(bot.weight_history || []),
            {
              timestamp: new Date().toISOString(),
              old_weight: bot.current_weight,
              new_weight: newWeight,
              reason,
              manual: true,
            },
          ],
          last_updated: new Date().toISOString(),
        })
        .eq('bot_name', botName)
        .eq('market_regime', regime);

      if (error) throw error;

      return new Response(
        JSON.stringify({
          success: true,
          message: `Updated weight for ${botName} in ${regime} to ${newWeight}`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Toggle bot enabled/disabled
    if (pathname.endsWith('/toggle-bot') && req.method === 'POST') {
      const { botName, regime, enabled, reason } = await req.json();

      const { error } = await supabase
        .from('bot_accuracy_metrics')
        .update({
          is_enabled: enabled,
          auto_disabled_at: enabled ? null : new Date().toISOString(),
          auto_disabled_reason: enabled ? null : reason,
          last_updated: new Date().toISOString(),
        })
        .eq('bot_name', botName)
        .eq('market_regime', regime);

      if (error) throw error;

      await supabase
        .from('bot_status_management')
        .upsert({
          bot_name: botName,
          is_enabled: enabled,
          disabled_reason: enabled ? null : reason,
          last_modified: new Date().toISOString(),
        });

      return new Response(
        JSON.stringify({
          success: true,
          message: `${enabled ? 'Enabled' : 'Disabled'} ${botName}`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // EXISTING ENDPOINTS BELOW

    if (pathname.endsWith('/insights')) {
      const { data: insights } = await supabase
        .from('bot_learning_insights')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      return new Response(JSON.stringify({
        success: true,
        insights: insights || []
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }

    if (pathname.endsWith('/metrics')) {
      const { data: metrics } = await supabase
        .from('bot_learning_metrics')
        .select('*')
        .order('metric_date', { ascending: false })
        .limit(50);

      return new Response(JSON.stringify({
        success: true,
        metrics: metrics || []
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }

    const { data: botStats } = await supabase
      .rpc('get_bot_performance');

    if (!botStats || botStats.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No bot data to analyze yet',
        insights_generated: 0
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }

    const allInsights = [];
    const allMetrics = [];

    for (const bot of botStats) {
      const { data: historical } = await supabase
        .from('bot_learning_metrics')
        .select('*')
        .eq('bot_name', bot.bot_name)
        .order('metric_date', { ascending: false })
        .limit(5);

      const insights = generateInsights(bot, historical || []);
      allInsights.push(...insights);

      const performanceTrend = historical && historical.length >= 2
        ? historical[0].accuracy_rate > historical[1].accuracy_rate + 5 ? 'improving'
        : historical[0].accuracy_rate < historical[1].accuracy_rate - 5 ? 'declining'
        : 'stable'
        : 'stable';

      const learningScore = calculateLearningScore(bot, historical || []);

      allMetrics.push({
        bot_name: bot.bot_name,
        metric_date: new Date().toISOString().split('T')[0],
        total_predictions: bot.total_predictions || 0,
        successful_predictions: bot.successful_predictions || 0,
        failed_predictions: bot.failed_predictions || 0,
        avg_confidence: bot.avg_confidence || 0,
        performance_trend: performanceTrend,
        learning_score: learningScore
      });
    }

    if (allInsights.length > 0) {
      await supabase.from('bot_learning_insights').insert(allInsights);
    }

    if (allMetrics.length > 0) {
      for (const metric of allMetrics) {
        await supabase
          .from('bot_learning_metrics')
          .upsert(metric, {
            onConflict: 'bot_name,metric_date',
            ignoreDuplicates: false
          });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      insights_generated: allInsights.length,
      metrics_updated: allMetrics.length,
      message: 'AI learning analysis completed successfully'
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Bot learning error:', error);
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
