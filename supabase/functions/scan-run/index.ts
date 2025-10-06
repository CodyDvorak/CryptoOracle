import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
import { tradingBots } from './trading-bots.ts';
import { CryptoDataService } from './crypto-data-service.ts';
import { HybridAggregationEngine } from './aggregation-engine.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

async function runScanProcess(
  supabase: any,
  scanRun: any,
  scanType: string,
  actualCoinLimit: number,
  filterScope: string,
  minPrice: number | undefined,
  maxPrice: number | undefined,
  confidenceThreshold: number
) {
  const scanStartTime = Date.now();
  const MAX_SCAN_TIME = 7 * 60 * 1000;

  try {
    const cryptoService = new CryptoDataService();
    const aggregationEngine = new HybridAggregationEngine(supabase);

    console.log('Fetching top coins...');
    const allCoins = await cryptoService.fetchTopCoins();

    let filteredCoins = allCoins;
    if (filterScope && filterScope !== 'all') {
      const categories: any = {
        large: allCoins.slice(0, 50),
        mid: allCoins.slice(50, 150),
        small: allCoins.slice(150, 300)
      };
      filteredCoins = categories[filterScope] || allCoins;
    }

    if (minPrice !== undefined) {
      filteredCoins = filteredCoins.filter((c: any) => c.price >= minPrice);
    }
    if (maxPrice !== undefined) {
      filteredCoins = filteredCoins.filter((c: any) => c.price <= maxPrice);
    }

    const coinsToScan = filteredCoins.slice(0, actualCoinLimit);
    console.log(`Analyzing ${coinsToScan.length} coins`);

    const botPredictions: any[] = [];
    const recommendations: any[] = [];
    let processedCoins = 0;

    for (const coin of coinsToScan) {
      if (Date.now() - scanStartTime > MAX_SCAN_TIME) {
        console.log('Approaching time limit, stopping scan gracefully...');
        break;
      }

      try {
        console.log(`Processing ${coin.symbol} (${processedCoins + 1}/${coinsToScan.length})`);

        const ohlcvData = await cryptoService.fetchOHLCV(coin.symbol);
        if (!ohlcvData || !ohlcvData.candles) {
          console.log(`Skipping ${coin.symbol}: No OHLCV data`);
          continue;
        }

        const coinPredictions: any[] = [];
        for (const bot of tradingBots) {
          const prediction = await bot.analyze(coin, ohlcvData);
          if (prediction) {
            coinPredictions.push({
              run_id: scanRun.id,
              bot_name: bot.name,
              coin_symbol: coin.symbol,
              coin_name: coin.name,
              position_direction: prediction.direction,
              entry_price: prediction.entry,
              take_profit: prediction.takeProfit,
              stop_loss: prediction.stopLoss,
              confidence_score: prediction.confidence,
              leverage: prediction.leverage,
              timeframe: prediction.timeframe,
              expected_gain_percent: prediction.expectedGain,
              reasoning: prediction.reasoning,
              market_regime: ohlcvData.marketRegime,
              prediction_time: new Date().toISOString(),
            });
          }
        }

        if (coinPredictions.length >= 3) {
          const aggregatedSignal = await aggregationEngine.aggregate(coinPredictions, ohlcvData);

          if (aggregatedSignal && aggregatedSignal.confidence >= confidenceThreshold) {
            const entry = aggregatedSignal.avgEntry || coin.price;
            const takeProfit = aggregatedSignal.avgTakeProfit || entry * 1.1;
            const predicted24h = entry + ((takeProfit - entry) * 0.33);
            const predicted48h = entry + ((takeProfit - entry) * 0.66);
            const predicted7d = takeProfit;
            const change24h = ((predicted24h - entry) / entry) * 100;
            const change48h = ((predicted48h - entry) / entry) * 100;
            const change7d = ((predicted7d - entry) / entry) * 100;

            recommendations.push({
            run_id: scanRun.id,
            coin: coin.name,
            ticker: coin.symbol,
            current_price: coin.price,
            consensus_direction: aggregatedSignal.direction,
            avg_confidence: aggregatedSignal.confidence,
            avg_entry: entry,
            avg_take_profit: takeProfit,
            avg_stop_loss: aggregatedSignal.avgStopLoss || entry * 0.95,
            avg_predicted_24h: predicted24h,
            avg_predicted_48h: predicted48h,
            avg_predicted_7d: predicted7d,
            avg_leverage: aggregatedSignal.avgLeverage || 3,
            bot_count: coinPredictions.length,
            predicted_percent_change: change24h,
            predicted_dollar_change: predicted24h - coin.price,
            market_regime: ohlcvData.marketRegime,
            regime_confidence: ohlcvData.regimeConfidence,
            predicted_change_24h: change24h,
            predicted_change_48h: change48h,
            predicted_change_7d: change7d,
            bot_votes_long: aggregatedSignal.longBots,
            bot_votes_short: aggregatedSignal.shortBots,
          });
          }
        }

        botPredictions.push(...coinPredictions);
        processedCoins++;

        if (botPredictions.length >= 1000) {
          await supabase.from('bot_predictions').insert(botPredictions.splice(0));
        }

        if (recommendations.length >= 50) {
          await supabase.from('recommendations').insert(recommendations.splice(0));
        }

        if (processedCoins % 10 === 0) {
          const progress = Math.floor((processedCoins / coinsToScan.length) * 100);
          await supabase.from('scan_runs').update({ progress }).eq('id', scanRun.id);
        }
      } catch (coinError: any) {
        console.error(`Error processing ${coin.symbol}:`, coinError.message);
      }
    }

    if (botPredictions.length > 0) {
      await supabase.from('bot_predictions').insert(botPredictions);
    }
    if (recommendations.length > 0) {
      await supabase.from('recommendations').insert(recommendations);
    }

    await supabase.from('scan_runs').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      progress: 100,
      recommendations_count: recommendations.length
    }).eq('id', scanRun.id);

    console.log('Scan completed successfully');
    return { success: true, recommendations: recommendations.length };
  } catch (error: any) {
    console.error('Scan error:', error);
    throw error;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    const { scanType = 'comprehensive', coinLimit = 10, filterScope = 'all', priceRange, confidenceThreshold = 0.6 } = await req.json();
    const actualCoinLimit = Math.min(coinLimit, 100);

    const { data: scanRun, error: scanError } = await supabase
      .from('scan_runs')
      .insert({
        status: 'running',
        scan_type: scanType,
        started_at: new Date().toISOString(),
        progress: 0
      })
      .select()
      .single();

    if (scanError) throw scanError;

    const result = await runScanProcess(
      supabase,
      scanRun,
      scanType,
      actualCoinLimit,
      filterScope,
      priceRange?.min,
      priceRange?.max,
      confidenceThreshold
    );

    return new Response(JSON.stringify({
      success: true,
      runId: scanRun.id,
      recommendations: result.recommendations
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Handler error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});