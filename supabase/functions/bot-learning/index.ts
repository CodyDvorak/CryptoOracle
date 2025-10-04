import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface BotMetrics {
  bot_name: string;
  total_predictions: number;
  successful_predictions: number;
  failed_predictions: number;
  accuracy_rate: number;
  avg_confidence: number;
}

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
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const pathname = url.pathname;

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
