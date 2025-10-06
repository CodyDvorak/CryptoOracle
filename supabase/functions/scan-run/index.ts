import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
import { CryptoDataService } from './crypto-data-service.ts';
import { tradingBots } from './trading-bots.ts';
import { HybridAggregationEngine } from './aggregation-engine.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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
  const MAX_SCAN_TIME = 7 * 60 * 1000; // 7 minutes max (leave 3 minutes buffer for cleanup)

  try {
    const cryptoService = new CryptoDataService();
    const aggregationEngine = new HybridAggregationEngine(supabase);

    console.log('Fetching top coins...');
    const coins = await cryptoService.getTopCoins(filterScope, minPrice, maxPrice);

    if (!coins || coins.length === 0) {
      throw new Error('Failed to fetch coin data from APIs');
    }

    const coinsToAnalyze = coins.slice(0, Math.min(actualCoinLimit, coins.length));
    console.log(`Analyzing ${coinsToAnalyze.length} coins with ${tradingBots.length} bots`);

    const recommendations: any[] = [];
    const botPredictions: any[] = [];
    let processedCoins = 0;

    for (const coin of coinsToAnalyze) {
      // Check if we're approaching timeout
      if (Date.now() - scanStartTime > MAX_SCAN_TIME) {
        console.warn(`⏱️ Approaching timeout limit. Processed ${processedCoins}/${coinsToAnalyze.length} coins. Finishing scan early.`);
        break;
      }

      try {
        console.log(`Processing ${coin.symbol} (${processedCoins + 1}/${coinsToAnalyze.length})`);

        const ohlcvData = await cryptoService.getOHLCVData(coin.symbol);

        if (!ohlcvData) {
          console.warn(`No OHLCV data for ${coin.symbol}, skipping`);
          continue;
        }

        let derivativesData = null;
        let optionsData = null;
        let tokenMetricsData = null;

        // Skip expensive API calls for speed - use only OHLCV data for quick scans
        if (scanType === 'oracle_scan' || scanType === 'deep_analysis' || scanType === 'ai_powered_scan') {
          try {
            derivativesData = await cryptoService.getDerivativesData(coin.symbol);
          } catch (error) {
            console.warn(`Derivatives data fetch failed for ${coin.symbol}:`, error.message);
          }

          try {
            tokenMetricsData = await cryptoService.getTokenMetricsData(coin.symbol);
          } catch (error) {
            console.warn(`TokenMetrics data fetch failed for ${coin.symbol}:`, error.message);
          }
        }
        // Options data only for major coins
        if (['BTC', 'ETH', 'SOL'].includes(coin.symbol)) {
          try {
            optionsData = await cryptoService.getOptionsData(coin.symbol);
          } catch (error) {
            console.warn(`Options data fetch failed for ${coin.symbol}:`, error.message);
          }
        }

        const rawPredictions: any[] = [];
        const coinPredictions: any[] = [];

        // Collect predictions from all 87 bots
        for (const bot of tradingBots) {
          try {
            const prediction = bot.analyze(ohlcvData, derivativesData, coin, optionsData);

            if (prediction) {
              rawPredictions.push(prediction);

              coinPredictions.push({
                run_id: scanRun.id,
                bot_name: prediction.botName,
                coin_symbol: coin.symbol,
                coin_name: coin.name,
                entry_price: prediction.entry,
                target_price: prediction.takeProfit,
                stop_loss: prediction.stopLoss,
                position_direction: prediction.direction,
                confidence_score: prediction.confidence,
                leverage: prediction.leverage || 3,
                market_regime: ohlcvData.marketRegime || 'UNKNOWN',
              });
            }
          } catch (botError) {
            console.error(`Bot ${bot.name} error on ${coin.symbol}:`, botError.message);
          }
        }

        // Use Hybrid Aggregation Intelligence Engine
        const aggregatedSignal = await aggregationEngine.aggregate(rawPredictions, ohlcvData);

        if (aggregatedSignal && aggregatedSignal.botCount >= 3) {
          const consensusDirection = aggregatedSignal.direction;
          let finalConfidence = aggregatedSignal.confidence;
          let aiReasoning = `Hybrid aggregation: ${aggregatedSignal.consensusPercent.toFixed(0)}% consensus`;

          console.log(`📊 ${coin.symbol}: ${aggregatedSignal.botCount} bots, ${aggregatedSignal.consensusPercent.toFixed(0)}% consensus, weighted confidence: ${aggregatedSignal.weightedConfidence.toFixed(2)}`);

          const avgEntry = aggregatedSignal.avgEntry;
          const avgTakeProfit = aggregatedSignal.avgTakeProfit;
          const avgStopLoss = aggregatedSignal.avgStopLoss;

          if (tokenMetricsData?.supported && tokenMetricsData.rating) {
            const tmScore = (tokenMetricsData.rating.overall + tokenMetricsData.rating.trader) / 200;

            if (tokenMetricsData.recommendation === 'STRONG_BUY' && consensusDirection === 'LONG') {
              finalConfidence = Math.min(finalConfidence * 1.15, 0.95);
              aiReasoning = 'TokenMetrics STRONG_BUY confirms bot consensus';
            } else if (tokenMetricsData.recommendation === 'STRONG_SELL' && consensusDirection === 'SHORT') {
              finalConfidence = Math.min(finalConfidence * 1.15, 0.95);
              aiReasoning = 'TokenMetrics STRONG_SELL confirms bot consensus';
            } else if (
              (tokenMetricsData.recommendation === 'STRONG_SELL' && consensusDirection === 'LONG') ||
              (tokenMetricsData.recommendation === 'STRONG_BUY' && consensusDirection === 'SHORT')
            ) {
              finalConfidence *= 0.85;
              aiReasoning = 'TokenMetrics conflicts with bot consensus';
            }

            console.log(`🤖 TokenMetrics for ${coin.symbol}: ${tokenMetricsData.recommendation} (Score: ${(tmScore * 100).toFixed(0)}%)`);
          }

          const predicted24h = consensusDirection === 'LONG' ? coin.price * 1.02 : coin.price * 0.98;
          const predicted48h = consensusDirection === 'LONG' ? coin.price * 1.04 : coin.price * 0.96;
          const predicted7d = consensusDirection === 'LONG' ? coin.price * 1.08 : coin.price * 0.92;

          const change24h = ((predicted24h - coin.price) / coin.price) * 100;
          const change48h = ((predicted48h - coin.price) / coin.price) * 100;
          const change7d = ((predicted7d - coin.price) / coin.price) * 100;

          if (finalConfidence >= confidenceThreshold) {
            recommendations.push({
            run_id: scanRun.id,
            coin: coin.name,
            ticker: coin.symbol,
            current_price: coin.price,
            consensus_direction: consensusDirection,
            avg_confidence: finalConfidence,
            avg_entry: avgEntry,
            avg_take_profit: avgTakeProfit,
            avg_stop_loss: avgStopLoss,
            avg_leverage: aggregatedSignal.avgLeverage,
            avg_predicted_24h: predicted24h,
            avg_predicted_48h: predicted48h,
            avg_predicted_7d: predicted7d,
            predicted_change_24h: change24h,
            predicted_change_48h: change48h,
            predicted_change_7d: change7d,
            bot_count: aggregatedSignal.botCount,
            bot_votes_long: aggregatedSignal.longBots,
            bot_votes_short: aggregatedSignal.shortBots,
            market_regime: ohlcvData.marketRegime || 'UNKNOWN',
            regime_confidence: ohlcvData.regimeConfidence || 0.5,
            ai_reasoning: aiReasoning,
            });
            console.log(`✅ ${coin.symbol}: Confidence ${finalConfidence.toFixed(2)} >= ${confidenceThreshold} - ADDED`);
          } else {
            console.log(`❌ ${coin.symbol}: Confidence ${finalConfidence.toFixed(2)} < ${confidenceThreshold} - FILTERED OUT`);
          }

          botPredictions.push(...coinPredictions);
        }

        processedCoins++;

        if (processedCoins % 10 === 0) {
          console.log(`Progress: ${processedCoins}/${coinsToAnalyze.length} coins processed`);

          if (recommendations.length > 0) {
            await supabase.from('recommendations').insert(recommendations.splice(0));
          }
          if (botPredictions.length > 0) {
            await supabase.from('bot_predictions').insert(botPredictions.splice(0));
          }
        }

      } catch (coinError) {
        console.error(`Error processing ${coin.symbol}:`, coinError.message);
      }
    }

    if (recommendations.length > 0) {
      const { error: recError } = await supabase
        .from('recommendations')
        .insert(recommendations);
      if (recError) console.error('Final recommendations insert error:', recError);
    }

    if (botPredictions.length > 0) {
      const { error: predError } = await supabase
        .from('bot_predictions')
        .insert(botPredictions);
      if (predError) console.error('Final predictions insert error:', predError);
    }

    const { data: allRecs } = await supabase
      .from('recommendations')
      .select('id')
      .eq('run_id', scanRun.id);

    const totalSignals = allRecs?.length || 0;
    const scanDuration = (Date.now() - scanStartTime) / 1000;
    const wasTimeout = processedCoins < coinsToAnalyze.length;

    await supabase
      .from('scan_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        total_available_coins: processedCoins,
        total_coins: scanRun.total_coins,
        total_bots: tradingBots.length,
        error_message: wasTimeout ? `Timeout: Analyzed ${processedCoins}/${coinsToAnalyze.length} coins in ${scanDuration.toFixed(0)}s` : null,
      })
      .eq('id', scanRun.id);

    console.log(`✅ Scan ${scanRun.id} completed: ${totalSignals} signals from ${processedCoins}/${coinsToAnalyze.length} coins (${scanDuration.toFixed(0)}s)`);
  } catch (error) {
    console.error('Scan background process error:', error);

    try {
      await supabase
        .from('scan_runs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error.message,
        })
        .eq('id', scanRun.id);
    } catch (updateError) {
      console.error('Error updating scan status:', updateError);
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const {
      interval = '4h',
      filterScope = 'all',
      minPrice,
      maxPrice,
      scanType = 'quick_scan',
      coinLimit = 100,
      confidenceThreshold = 0.65
    } = body;

    const actualCoinLimit = typeof coinLimit === 'number' ? coinLimit : 100;

    const { data: scanRun, error: scanError } = await supabase
      .from('scan_runs')
      .insert({
        interval,
        filter_scope: filterScope,
        min_price: minPrice,
        max_price: maxPrice,
        scan_type: scanType,
        status: 'running',
        total_bots: 87,
        total_coins: actualCoinLimit,
      })
      .select()
      .single();

    if (scanError) throw scanError;

    console.log(`Scan ${scanRun.id} initiated - returning immediately`);

    runScanProcess(
      supabase,
      scanRun,
      scanType,
      actualCoinLimit,
      filterScope,
      minPrice,
      maxPrice,
      confidenceThreshold
    ).catch(async (error) => {
      console.error('Background scan error:', error);
      try {
        await supabase
          .from('scan_runs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: `Scan failed: ${error.message}`,
          })
          .eq('id', scanRun.id);
      } catch (updateError) {
        console.error('Error updating failed scan:', updateError);
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        runId: scanRun.id,
        message: 'Scan initiated and running in background',
        status: 'running'
      }),
      {
        status: 202,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Scan initiation error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
