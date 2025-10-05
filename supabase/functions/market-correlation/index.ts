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
    const action = url.searchParams.get('action') || 'get';

    if (action === 'get') {
      return await getCorrelations(supabase);
    } else if (action === 'calculate') {
      return await calculateCorrelations(supabase);
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Market correlation error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function getCorrelations(supabase: any) {
  const { data: correlations, error } = await supabase
    .from('market_correlations')
    .select('*')
    .order('correlation_coefficient', { ascending: false })
    .limit(50);

  if (error) throw error;

  const { data: snapshot } = await supabase
    .from('correlation_snapshots')
    .select('*')
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  return new Response(
    JSON.stringify({
      correlations: correlations || [],
      snapshot: snapshot || null,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function calculateCorrelations(supabase: any) {
  console.log('Calculating market correlations...');

  const baseAssets = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP'];
  const correlatedAssets = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'MATIC', 'DOT', 'AVAX'];
  const timeframes = ['1h', '4h', '1d', '1w'];

  const correlations = [];

  for (const base of baseAssets) {
    for (const corr of correlatedAssets) {
      if (base === corr) continue;

      for (const timeframe of timeframes) {
        const coefficient = await fetchCorrelation(base, corr, timeframe);

        if (coefficient !== null) {
          const absCoeff = Math.abs(coefficient);
          let strength = 'WEAK';
          if (absCoeff >= 0.7) strength = 'STRONG';
          else if (absCoeff >= 0.4) strength = 'MODERATE';

          const direction = coefficient >= 0 ? 'POSITIVE' : 'NEGATIVE';

          correlations.push({
            base_asset: base,
            correlated_asset: corr,
            correlation_coefficient: coefficient,
            timeframe,
            period_days: timeframe === '1h' ? 7 : timeframe === '4h' ? 14 : timeframe === '1d' ? 30 : 90,
            strength,
            direction,
          });
        }
      }
    }
  }

  for (const correlation of correlations) {
    await supabase
      .from('market_correlations')
      .upsert(correlation, {
        onConflict: 'base_asset,correlated_asset,timeframe',
      });
  }

  const btcData = await fetchPriceData('BTC', '1d');
  const totalMarketCap = await fetchTotalMarketCap();
  const btcMarketCap = btcData?.marketCap || 0;
  const btcDominance = totalMarketCap > 0 ? (btcMarketCap / totalMarketCap) * 100 : 0;

  const strongPositive = correlations.filter(
    (c) => c.strength === 'STRONG' && c.direction === 'POSITIVE'
  );
  const marketSentiment = strongPositive.length > correlations.length * 0.6 ? 'BULLISH' : 'NEUTRAL';

  await supabase.from('correlation_snapshots').insert({
    btc_dominance: btcDominance,
    market_sentiment: marketSentiment,
    top_correlations: correlations.slice(0, 10),
  });

  console.log(`Calculated ${correlations.length} correlations`);

  return new Response(
    JSON.stringify({
      success: true,
      calculated: correlations.length,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function fetchCorrelation(base: string, corr: string, timeframe: string): Promise<number | null> {
  try {
    const baseData = await fetchPriceData(base, timeframe);
    const corrData = await fetchPriceData(corr, timeframe);

    if (!baseData?.prices || !corrData?.prices || baseData.prices.length < 10 || corrData.prices.length < 10) {
      return null;
    }

    const basePrices = baseData.prices.slice(0, Math.min(baseData.prices.length, corrData.prices.length));
    const corrPrices = corrData.prices.slice(0, Math.min(baseData.prices.length, corrData.prices.length));

    return calculatePearsonCorrelation(basePrices, corrPrices);
  } catch (error) {
    console.error(`Error fetching correlation ${base}-${corr}:`, error);
    return null;
  }
}

async function fetchPriceData(symbol: string, timeframe: string): Promise<any> {
  try {
    const coinId = symbol.toLowerCase();
    const days = timeframe === '1h' ? '1' : timeframe === '4h' ? '7' : timeframe === '1d' ? '30' : '90';

    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=${timeframe === '1h' ? 'hourly' : 'daily'}`
    );

    if (!response.ok) return null;

    const data = await response.json();
    const prices = data.prices?.map((p: any) => p[1]) || [];

    return { prices, marketCap: data.market_caps?.[0]?.[1] || 0 };
  } catch (error) {
    return null;
  }
}

async function fetchTotalMarketCap(): Promise<number> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/global');
    if (!response.ok) return 0;
    const data = await response.json();
    return data.data?.total_market_cap?.usd || 0;
  } catch (error) {
    return 0;
  }
}

function calculatePearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0 || n !== y.length) return 0;

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) return 0;

  return numerator / denominator;
}
