import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const mockCoins = [
  { symbol: 'BTC', name: 'Bitcoin', price: 45000 },
  { symbol: 'ETH', name: 'Ethereum', price: 2800 },
  { symbol: 'SOL', name: 'Solana', price: 120 },
  { symbol: 'AVAX', name: 'Avalanche', price: 35 },
  { symbol: 'MATIC', name: 'Polygon', price: 0.85 },
  { symbol: 'DOT', name: 'Polkadot', price: 7.5 },
  { symbol: 'LINK', name: 'Chainlink', price: 15.2 },
  { symbol: 'UNI', name: 'Uniswap', price: 8.5 },
  { symbol: 'ATOM', name: 'Cosmos', price: 10.3 },
  { symbol: 'LTC', name: 'Litecoin', price: 85 },
];

const botNames = [
  'RSI Oversold/Overbought', 'MACD Crossover', 'EMA Golden Cross', 'Bollinger Squeeze',
  'Volume Spike', 'Funding Rate Arbitrage', 'Momentum Trader', 'Mean Reversion',
  'Trend Following', 'Breakout Hunter', 'Support/Resistance', 'Fibonacci Retracement',
  'Elliott Wave', 'Ichimoku Cloud', 'Parabolic SAR', 'ADX Trend Strength',
  'Stochastic Oscillator', 'Williams %R', 'VWAP Trader', 'Smart Money Concepts',
];

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
        total_coins: mockCoins.length,
      })
      .select()
      .single();

    if (scanError) throw scanError;

    (async () => {
      try {
        const recommendations = [];
        const botPredictions = [];

        for (const coin of mockCoins) {
          const isLong = Math.random() > 0.5;
          const botCount = 20 + Math.floor(Math.random() * 15);
          const confidence = 0.6 + Math.random() * 0.3;

          const avgEntry = coin.price;
          const avgTakeProfit = isLong ? coin.price * (1.03 + Math.random() * 0.07) : coin.price * (0.90 + Math.random() * 0.07);
          const avgStopLoss = isLong ? coin.price * (0.95 - Math.random() * 0.03) : coin.price * (1.02 + Math.random() * 0.03);

          recommendations.push({
            run_id: scanRun.id,
            coin: coin.name,
            ticker: coin.symbol,
            current_price: coin.price,
            consensus_direction: isLong ? 'LONG' : 'SHORT',
            avg_confidence: confidence,
            avg_entry: avgEntry,
            avg_take_profit: avgTakeProfit,
            avg_stop_loss: avgStopLoss,
            avg_predicted_24h: isLong ? coin.price * (1.02 + Math.random() * 0.03) : coin.price * (0.97 - Math.random() * 0.03),
            avg_predicted_48h: isLong ? coin.price * (1.04 + Math.random() * 0.04) : coin.price * (0.94 - Math.random() * 0.04),
            avg_predicted_7d: isLong ? coin.price * (1.08 + Math.random() * 0.07) : coin.price * (0.88 - Math.random() * 0.07),
            bot_count: botCount,
          });

          for (let i = 0; i < botCount; i++) {
            const botName = botNames[i % botNames.length];
            botPredictions.push({
              run_id: scanRun.id,
              bot_name: botName,
              coin_symbol: coin.symbol,
              coin_name: coin.name,
              entry_price: avgEntry,
              target_price: avgTakeProfit,
              stop_loss: avgStopLoss,
              position_direction: isLong ? 'LONG' : 'SHORT',
              confidence_score: confidence,
              leverage: 3 + Math.floor(Math.random() * 5),
            });
          }
        }

        if (recommendations.length > 0) {
          const { error: recError } = await supabase.from('recommendations').insert(recommendations);
          if (recError) console.error('Recommendations error:', recError);
        }

        if (botPredictions.length > 0) {
          const { error: predError } = await supabase.from('bot_predictions').insert(botPredictions);
          if (predError) console.error('Predictions error:', predError);
        }

        await supabase
          .from('scan_runs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            total_available_coins: mockCoins.length,
          })
          .eq('id', scanRun.id);

      } catch (error) {
        console.error('Background error:', error);
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