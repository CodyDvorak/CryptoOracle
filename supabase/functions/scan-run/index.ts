import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
import { CryptoDataService } from './crypto-data-service.ts';
import { tradingBots } from './trading-bots.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  let scanRun: any = null;

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
      coinLimit = 100
    } = body;

    const actualCoinLimit = typeof coinLimit === 'number' ? coinLimit : 100;

    const { data: scanRunData, error: scanError } = await supabase
      .from('scan_runs')
      .insert({
        interval,
        filter_scope: filterScope,
        min_price: minPrice,
        max_price: maxPrice,
        scan_type: scanType,
        status: 'running',
        total_bots: 59,
        total_coins: actualCoinLimit,
      })
      .select()
      .single();

    if (scanError) throw scanError;
    scanRun = scanRunData;

    console.log(`Starting scan ${scanRun.id} - ${scanType} for ${actualCoinLimit} coins`);

    const cryptoService = new CryptoDataService();

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
      try {
        console.log(`Processing ${coin.symbol} (${processedCoins + 1}/${coinsToAnalyze.length})`);

        const ohlcvData = await cryptoService.getOHLCVData(coin.symbol);

        if (!ohlcvData) {
          console.warn(`No OHLCV data for ${coin.symbol}, skipping`);
          continue;
        }

        const derivativesData = await cryptoService.getDerivativesData(coin.symbol);

        let longVotes = 0;
        let shortVotes = 0;
        let totalConfidence = 0;
        let totalBotsVoting = 0;
        const coinPredictions: any[] = [];

        for (const bot of tradingBots) {
          try {
            const prediction = bot.analyze(ohlcvData, derivativesData, coin);

            if (prediction) {
              totalBotsVoting++;
              totalConfidence += prediction.confidence;

              if (prediction.direction === 'LONG') longVotes++;
              else shortVotes++;

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

        if (totalBotsVoting >= 3) {
          const consensusDirection = longVotes > shortVotes ? 'LONG' : 'SHORT';
          const avgConfidence = totalConfidence / totalBotsVoting;

          const directionPredictions = coinPredictions.filter(
            p => p.position_direction === consensusDirection
          );

          const avgEntry = coin.price;
          const avgTakeProfit = directionPredictions.length > 0
            ? directionPredictions.reduce((sum, p) => sum + p.target_price, 0) / directionPredictions.length
            : (consensusDirection === 'LONG' ? coin.price * 1.05 : coin.price * 0.95);

          const avgStopLoss = directionPredictions.length > 0
            ? directionPredictions.reduce((sum, p) => sum + p.stop_loss, 0) / directionPredictions.length
            : (consensusDirection === 'LONG' ? coin.price * 0.97 : coin.price * 1.03);

          recommendations.push({
            run_id: scanRun.id,
            coin: coin.name,
            ticker: coin.symbol,
            current_price: coin.price,
            consensus_direction: consensusDirection,
            avg_confidence: avgConfidence,
            avg_entry: avgEntry,
            avg_take_profit: avgTakeProfit,
            avg_stop_loss: avgStopLoss,
            avg_predicted_24h: consensusDirection === 'LONG'
              ? coin.price * 1.02
              : coin.price * 0.98,
            avg_predicted_48h: consensusDirection === 'LONG'
              ? coin.price * 1.04
              : coin.price * 0.96,
            avg_predicted_7d: consensusDirection === 'LONG'
              ? coin.price * 1.08
              : coin.price * 0.92,
            bot_count: totalBotsVoting,
            market_regime: ohlcvData.marketRegime || 'UNKNOWN',
            regime_confidence: ohlcvData.regimeConfidence || 0.5,
          });

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

    await supabase
      .from('scan_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        total_available_coins: coins.length,
        total_coins: processedCoins,
        total_bots: tradingBots.length,
      })
      .eq('id', scanRun.id);

    console.log(`Scan ${scanRun.id} completed: ${totalSignals} signals from ${processedCoins} coins`);

    return new Response(
      JSON.stringify({
        success: true,
        runId: scanRun.id,
        message: 'Scan completed successfully',
        totalSignals,
        coinsAnalyzed: processedCoins,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Scan function error:', error);

    if (scanRun) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

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
