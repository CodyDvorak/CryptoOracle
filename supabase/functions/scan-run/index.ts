import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
import { cryptoDataService } from './crypto-data-service.ts';
import { tradingBots } from './trading-bots.ts';

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

    const body = await req.json();
    const { interval = '4h', filterScope = 'all', minPrice, maxPrice, scanType = 'full_scan' } = body;

    const { data: scanRun, error: scanError } = await supabase
      .from('scan_runs')
      .insert({
        interval,
        filter_scope: filterScope,
        min_price: minPrice,
        max_price: maxPrice,
        scan_type: scanType,
        status: 'running',
        total_bots: 54,
      })
      .select()
      .single();

    if (scanError) throw scanError;

    (async () => {
      try {
        const coins = await cryptoDataService.getTopCoins(filterScope, minPrice, maxPrice);
        
        const recommendations = [];
        const botPredictions = [];

        for (const coin of coins) {
          const ohlcvData = await cryptoDataService.getOHLCVData(coin.symbol);
          const derivativesData = await cryptoDataService.getDerivativesData(coin.symbol);

          if (!ohlcvData || !derivativesData) continue;

          const predictions = [];
          for (const bot of tradingBots) {
            const prediction = bot.analyze(ohlcvData, derivativesData, coin);
            if (prediction) predictions.push(prediction);
          }

          if (predictions.length >= 20) {
            const longPredictions = predictions.filter(p => p.direction === 'LONG');
            const shortPredictions = predictions.filter(p => p.direction === 'SHORT');
            
            const consensusDirection = longPredictions.length > shortPredictions.length ? 'LONG' : 'SHORT';
            const relevantPredictions = consensusDirection === 'LONG' ? longPredictions : shortPredictions;

            if (relevantPredictions.length >= 20) {
              const avgConfidence = relevantPredictions.reduce((sum, p) => sum + p.confidence, 0) / relevantPredictions.length;
              const avgEntry = relevantPredictions.reduce((sum, p) => sum + p.entry, 0) / relevantPredictions.length;
              const avgTakeProfit = relevantPredictions.reduce((sum, p) => sum + p.takeProfit, 0) / relevantPredictions.length;
              const avgStopLoss = relevantPredictions.reduce((sum, p) => sum + p.stopLoss, 0) / relevantPredictions.length;

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
                avg_predicted_24h: avgEntry * (consensusDirection === 'LONG' ? 1.05 : 0.95),
                avg_predicted_48h: avgEntry * (consensusDirection === 'LONG' ? 1.08 : 0.92),
                avg_predicted_7d: avgEntry * (consensusDirection === 'LONG' ? 1.15 : 0.85),
                bot_count: relevantPredictions.length,
              });

              for (const pred of relevantPredictions) {
                botPredictions.push({
                  run_id: scanRun.id,
                  bot_name: pred.botName,
                  coin_symbol: coin.symbol,
                  coin_name: coin.name,
                  entry_price: pred.entry,
                  target_price: pred.takeProfit,
                  stop_loss: pred.stopLoss,
                  position_direction: pred.direction,
                  confidence_score: pred.confidence,
                  leverage: pred.leverage || 5,
                });
              }
            }
          }
        }

        if (recommendations.length > 0) {
          await supabase.from('recommendations').insert(recommendations);
        }

        if (botPredictions.length > 0) {
          await supabase.from('bot_predictions').insert(botPredictions);
        }

        await supabase
          .from('scan_runs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            total_coins: coins.length,
            total_available_coins: coins.length,
          })
          .eq('id', scanRun.id);

      } catch (error) {
        await supabase
          .from('scan_runs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: error.message,
          })
          .eq('id', scanRun.id);
      }
    })();

    return new Response(JSON.stringify({ 
      success: true, 
      runId: scanRun.id,
      message: 'Scan started successfully'
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
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