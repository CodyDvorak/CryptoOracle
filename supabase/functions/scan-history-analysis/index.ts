import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get('days') || '7');
    const coinSymbol = url.searchParams.get('coin');

    const analysis = await analyzeHistory(supabase, days, coinSymbol);

    return new Response(
      JSON.stringify(analysis),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('History analysis error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function analyzeHistory(supabase: any, days: number, coinSymbol?: string) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  let query = supabase
    .from('recommendations')
    .select('*')
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: false });

  if (coinSymbol) {
    query = query.eq('coin_symbol', coinSymbol);
  }

  const { data: recommendations, error } = await query;

  if (error) throw error;

  const regimeTrends = analyzeRegimeTrends(recommendations, days);
  const signalPersistence = analyzeSignalPersistence(recommendations);
  const topCoins = identifyTopCoins(recommendations);
  const confidenceTrends = analyzeConfidenceTrends(recommendations, days);
  const marketOverview = generateMarketOverview(recommendations);

  return {
    period: {
      days,
      startDate: startDate.toISOString(),
      endDate: new Date().toISOString(),
      totalScans: recommendations.length,
    },
    regimeTrends,
    signalPersistence,
    topCoins,
    confidenceTrends,
    marketOverview,
    coinSpecific: coinSymbol ? analyzeCoinHistory(recommendations, coinSymbol) : null,
  };
}

function analyzeRegimeTrends(recommendations: any[], days: number) {
  const regimeCounts: Record<string, number[]> = {
    BULL: new Array(days).fill(0),
    BEAR: new Array(days).fill(0),
    SIDEWAYS: new Array(days).fill(0),
  };

  const today = new Date();

  recommendations.forEach((rec) => {
    const recDate = new Date(rec.created_at);
    const daysDiff = Math.floor((today.getTime() - recDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff >= 0 && daysDiff < days && rec.regime) {
      regimeCounts[rec.regime][days - daysDiff - 1]++;
    }
  });

  const latestRegimes = recommendations.slice(0, 50).map((r) => r.regime);
  const bullishCount = latestRegimes.filter((r) => r === 'BULL').length;
  const bearishCount = latestRegimes.filter((r) => r === 'BEAR').length;
  const sidewaysCount = latestRegimes.filter((r) => r === 'SIDEWAYS').length;

  const total = latestRegimes.length;
  const bullishPercentage = (bullishCount / total) * 100;
  const bearishPercentage = (bearishCount / total) * 100;
  const sidewaysPercentage = (sidewaysCount / total) * 100;

  let trend = 'Mixed';
  if (bullishPercentage > 60) trend = 'Increasingly Bullish';
  else if (bearishPercentage > 60) trend = 'Increasingly Bearish';
  else if (sidewaysPercentage > 50) trend = 'Consolidating';

  return {
    daily: regimeCounts,
    current: {
      bullish: bullishPercentage.toFixed(1) + '%',
      bearish: bearishPercentage.toFixed(1) + '%',
      sideways: sidewaysPercentage.toFixed(1) + '%',
    },
    trend,
    interpretation:
      trend === 'Increasingly Bullish'
        ? 'Market is showing more bullish setups. Good for trend-following strategies.'
        : trend === 'Increasingly Bearish'
        ? 'Market is showing more bearish pressure. Consider short positions or defensive plays.'
        : trend === 'Consolidating'
        ? 'Market is range-bound. Focus on mean-reversion strategies.'
        : 'Market is uncertain. Wait for clearer direction.',
  };
}

function analyzeSignalPersistence(recommendations: any[]) {
  const coinAppearances: Record<string, number[]> = {};

  recommendations.forEach((rec, index) => {
    if (!coinAppearances[rec.coin_symbol]) {
      coinAppearances[rec.coin_symbol] = [];
    }
    coinAppearances[rec.coin_symbol].push(index);
  });

  const persistentCoins = Object.entries(coinAppearances)
    .filter(([_, indices]) => indices.length >= 3)
    .map(([symbol, indices]) => {
      const recentAppearances = indices.filter((i) => i < 20).length;
      return {
        symbol,
        totalAppearances: indices.length,
        recentAppearances,
        isPersistent: recentAppearances >= 2,
      };
    })
    .sort((a, b) => b.totalAppearances - a.totalAppearances)
    .slice(0, 10);

  return {
    coins: persistentCoins,
    interpretation:
      persistentCoins.length > 0
        ? `${persistentCoins.length} coins showing persistent signals. These may have stronger conviction.`
        : 'No coins showing persistent signals. Market conditions may be volatile.',
  };
}

function identifyTopCoins(recommendations: any[]) {
  const coinStats: Record<
    string,
    {
      symbol: string;
      count: number;
      avgConfidence: number;
      longSignals: number;
      shortSignals: number;
      regimes: string[];
    }
  > = {};

  recommendations.forEach((rec) => {
    if (!coinStats[rec.coin_symbol]) {
      coinStats[rec.coin_symbol] = {
        symbol: rec.coin_symbol,
        count: 0,
        avgConfidence: 0,
        longSignals: 0,
        shortSignals: 0,
        regimes: [],
      };
    }

    const stats = coinStats[rec.coin_symbol];
    stats.count++;
    stats.avgConfidence += rec.bot_confidence || 0;
    stats.regimes.push(rec.regime);

    if (rec.consensus === 'LONG') stats.longSignals++;
    else if (rec.consensus === 'SHORT') stats.shortSignals++;
  });

  return Object.values(coinStats)
    .map((stats) => ({
      ...stats,
      avgConfidence: stats.avgConfidence / stats.count,
      dominantRegime: getMostCommon(stats.regimes),
      bias: stats.longSignals > stats.shortSignals ? 'BULLISH' : stats.shortSignals > stats.longSignals ? 'BEARISH' : 'NEUTRAL',
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

function analyzeConfidenceTrends(recommendations: any[], days: number) {
  const confidenceByDay: number[][] = new Array(days).fill(null).map(() => []);
  const today = new Date();

  recommendations.forEach((rec) => {
    const recDate = new Date(rec.created_at);
    const daysDiff = Math.floor((today.getTime() - recDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff >= 0 && daysDiff < days && rec.bot_confidence) {
      confidenceByDay[days - daysDiff - 1].push(rec.bot_confidence);
    }
  });

  const avgConfidenceByDay = confidenceByDay.map((day) => {
    if (day.length === 0) return 0;
    return day.reduce((sum, conf) => sum + conf, 0) / day.length;
  });

  const recentAvg = avgConfidenceByDay.slice(-3).reduce((a, b) => a + b, 0) / 3;
  const previousAvg = avgConfidenceByDay.slice(-6, -3).reduce((a, b) => a + b, 0) / 3;
  const change = ((recentAvg - previousAvg) / previousAvg) * 100;

  let trend = 'Stable';
  if (change > 5) trend = 'Increasing';
  else if (change < -5) trend = 'Decreasing';

  return {
    daily: avgConfidenceByDay,
    current: (recentAvg * 100).toFixed(1) + '%',
    trend,
    change: change.toFixed(1) + '%',
    interpretation:
      trend === 'Increasing'
        ? 'Bot confidence is improving. Signals are getting stronger.'
        : trend === 'Decreasing'
        ? 'Bot confidence is weakening. Market may be more uncertain.'
        : 'Bot confidence is stable.',
  };
}

function generateMarketOverview(recommendations: any[]) {
  const latest = recommendations.slice(0, 50);

  const avgConfidence = latest.reduce((sum, r) => sum + (r.bot_confidence || 0), 0) / latest.length;

  const regimes = latest.map((r) => r.regime);
  const bullCount = regimes.filter((r) => r === 'BULL').length;
  const bearCount = regimes.filter((r) => r === 'BEAR').length;

  const directions = latest.map((r) => r.consensus);
  const longCount = directions.filter((d) => d === 'LONG').length;
  const shortCount = directions.filter((d) => d === 'SHORT').length;

  let marketSentiment = 'NEUTRAL';
  if (bullCount > bearCount * 1.5) marketSentiment = 'BULLISH';
  else if (bearCount > bullCount * 1.5) marketSentiment = 'BEARISH';

  let tradingBias = 'NEUTRAL';
  if (longCount > shortCount * 1.5) tradingBias = 'LONG';
  else if (shortCount > longCount * 1.5) tradingBias = 'SHORT';

  return {
    marketSentiment,
    tradingBias,
    avgConfidence: (avgConfidence * 100).toFixed(1) + '%',
    signalQuality: avgConfidence > 0.75 ? 'HIGH' : avgConfidence > 0.6 ? 'MEDIUM' : 'LOW',
    totalSignals: latest.length,
    summary: `Market is ${marketSentiment.toLowerCase()} with ${tradingBias.toLowerCase()} bias. Signal quality: ${avgConfidence > 0.75 ? 'high' : avgConfidence > 0.6 ? 'medium' : 'low'}.`,
  };
}

function analyzeCoinHistory(recommendations: any[], coinSymbol: string) {
  const coinRecs = recommendations.filter((r) => r.coin_symbol === coinSymbol);

  if (coinRecs.length === 0) {
    return { message: 'No historical data for this coin' };
  }

  const avgConfidence = coinRecs.reduce((sum, r) => sum + (r.bot_confidence || 0), 0) / coinRecs.length;

  const regimes = coinRecs.map((r) => r.regime);
  const dominantRegime = getMostCommon(regimes);

  const directions = coinRecs.map((r) => r.consensus);
  const longCount = directions.filter((d) => d === 'LONG').length;
  const shortCount = directions.filter((d) => d === 'SHORT').length;

  return {
    appearances: coinRecs.length,
    avgConfidence: (avgConfidence * 100).toFixed(1) + '%',
    dominantRegime,
    signalBias: longCount > shortCount ? 'BULLISH' : shortCount > longCount ? 'BEARISH' : 'NEUTRAL',
    longSignals: longCount,
    shortSignals: shortCount,
    latestSignal: coinRecs[0],
  };
}

function getMostCommon(arr: string[]): string {
  const counts: Record<string, number> = {};
  arr.forEach((item) => {
    counts[item] = (counts[item] || 0) + 1;
  });
  return Object.keys(counts).reduce((a, b) => (counts[a] > counts[b] ? a : b));
}
