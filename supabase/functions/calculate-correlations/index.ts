import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
import { PriceDataService } from './price-data-service.ts';
import { CorrelationCalculator } from './correlation-calculator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

// Top coins to analyze
const TOP_COINS = [
  'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX',
  'DOT', 'MATIC', 'LINK', 'UNI', 'LTC', 'ATOM', 'XLM', 'TRX',
  'NEAR', 'ALGO', 'VET', 'FIL'
];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔄 Starting correlation calculation...');

    // Parse request parameters
    const url = new URL(req.url);
    const periodDays = parseInt(url.searchParams.get('days') || '30');
    const timeframe = url.searchParams.get('timeframe') || '1d';
    const coinsParam = url.searchParams.get('coins');
    const coins = coinsParam ? coinsParam.split(',') : TOP_COINS;

    console.log(`Parameters: ${periodDays} days, timeframe: ${timeframe}, coins: ${coins.length}`);

    // Initialize services
    const priceService = new PriceDataService();
    const calculator = new CorrelationCalculator();

    // Step 1: Fetch historical price data
    console.log('📊 Fetching price data...');
    const priceHistories = await priceService.fetchHistoricalPrices(coins, periodDays);

    if (priceHistories.length < 2) {
      throw new Error('Insufficient price data. Need at least 2 coins with valid data.');
    }

    console.log(`✅ Fetched data for ${priceHistories.length} coins`);

    // Step 2: Calculate correlations
    console.log('🔢 Calculating correlations...');
    const correlations = calculator.calculateCorrelationMatrix(priceHistories);

    console.log(`✅ Calculated ${correlations.length} correlation pairs`);

    // Step 3: Store correlations in database
    console.log('💾 Storing correlations in database...');

    // Prepare records for insertion
    const correlationRecords = correlations.map(c => ({
      base_asset: c.baseAsset,
      correlated_asset: c.correlatedAsset,
      correlation_coefficient: c.coefficient,
      timeframe: timeframe,
      period_days: periodDays,
      strength: c.strength,
      direction: c.direction,
      updated_at: new Date().toISOString()
    }));

    // Insert/update correlations
    const { error: insertError } = await supabase
      .from('market_correlations')
      .upsert(correlationRecords, {
        onConflict: 'base_asset,correlated_asset,timeframe',
        ignoreDuplicates: false
      });

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw insertError;
    }

    console.log('✅ Correlations stored successfully');

    // Step 4: Calculate market-wide metrics
    const marketMetrics = calculator.calculateMarketMetrics(correlations);
    const topCorrelations = calculator.findTopCorrelations(correlations, 10);

    // Calculate BTC dominance (if BTC data available)
    let btcDominance = null;
    const btcData = priceHistories.find(h => h.symbol === 'BTC');
    if (btcData && btcData.prices[0]?.marketCap) {
      const totalMarketCap = priceHistories.reduce(
        (sum, h) => sum + (h.prices[0]?.marketCap || 0),
        0
      );
      if (totalMarketCap > 0) {
        btcDominance = (btcData.prices[0].marketCap / totalMarketCap) * 100;
      }
    }

    // Determine market sentiment based on average correlation
    let marketSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    if (marketMetrics.averageCorrelation > 0.6) {
      marketSentiment = 'BULLISH'; // High correlation = market moving together
    } else if (marketMetrics.averageCorrelation < 0.3) {
      marketSentiment = 'BEARISH'; // Low correlation = uncertainty/fear
    }

    // Step 5: Create snapshot
    const { error: snapshotError } = await supabase
      .from('correlation_snapshots')
      .insert({
        snapshot_date: new Date().toISOString(),
        btc_dominance: btcDominance,
        market_sentiment: marketSentiment,
        top_correlations: topCorrelations.map(c => ({
          pair: `${c.baseAsset}-${c.correlatedAsset}`,
          coefficient: c.coefficient,
          strength: c.strength
        }))
      });

    if (snapshotError) {
      console.error('Snapshot insert error:', snapshotError);
    }

    // Step 6: Return results
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      parameters: {
        periodDays,
        timeframe,
        coinsAnalyzed: priceHistories.length
      },
      results: {
        totalCorrelations: correlations.length,
        marketMetrics,
        btcDominance: btcDominance ? btcDominance.toFixed(2) + '%' : null,
        marketSentiment
      },
      topCorrelations: topCorrelations.slice(0, 5).map(c => ({
        pair: `${c.baseAsset}-${c.correlatedAsset}`,
        coefficient: c.coefficient,
        strength: c.strength,
        direction: c.direction
      }))
    };

    console.log('✅ Correlation calculation completed successfully');
    console.log(JSON.stringify(response, null, 2));

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Correlation calculation failed:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
