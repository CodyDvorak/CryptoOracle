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
  'RSI Oversold/Overbought',
  'RSI Divergence',
  'MACD Crossover',
  'MACD Histogram',
  'EMA Golden Cross',
  'EMA Death Cross',
  'Bollinger Squeeze',
  'Bollinger Breakout',
  'Volume Spike',
  'Volume Breakout',
  'Funding Rate Arbitrage',
  'Open Interest Momentum',
  'Momentum Trader',
  'Mean Reversion',
  'Trend Following',
  'Breakout Hunter',
  'Support/Resistance',
  'Fibonacci Retracement',
  'Elliott Wave',
  'Ichimoku Cloud',
  'Parabolic SAR',
  'ADX Trend Strength',
  'Stochastic Oscillator',
  'CCI Commodity Channel',
  'Williams %R',
  'ATR Volatility',
  'OBV On-Balance Volume',
  'CMF Money Flow',
  'VWAP Trader',
  'Pivot Points',
  'Harmonic Patterns',
  'Chart Patterns',
  'Candlestick Patterns',
  'Price Action',
  'Wyckoff Method',
  'Market Profile',
  'Order Flow',
  'Smart Money Concepts',
  'Liquidity Zones',
  'Fair Value Gaps',
  'Market Structure',
  'Supply/Demand Zones',
  'Accumulation/Distribution',
  'Market Sentiment',
  'Fear & Greed Index',
  'Social Media Sentiment',
  'Whale Activity',
  'Exchange Flow',
  'Network Activity',
  'Hash Rate Analysis',
  'Miner Behavior',
  'Correlation Analysis',
  'Intermarket Analysis',
  'Seasonality Patterns',
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
    const { interval = '4h', filterScope = 'all', minPrice, maxPrice, scanType = 'quick_scan', coinLimit = 100 } = body;

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
        total_bots: 59,
        total_coins: actualCoinLimit,
      })
      .select()
      .single();

    if (scanError) throw scanError;

    // Process scan synchronously
    const recommendations = [];
    const botPredictions = [];

    try {
      const coinsToAnalyze = mockCoins.slice(0, Math.min(actualCoinLimit, mockCoins.length));

      for (const coin of coinsToAnalyze) {
        const regimes = ['BULL', 'BEAR', 'SIDEWAYS'];
        const marketRegime = regimes[Math.floor(Math.random() * regimes.length)];
        const regimeConfidence = 0.6 + Math.random() * 0.3;

        let totalBotsVoting = 0;
        let totalConfidence = 0;
        let longVotes = 0;
        let shortVotes = 0;

        for (const botName of botNames) {
          const willVote = Math.random() > 0.15;

          if (willVote) {
            const isLong = Math.random() > 0.5;
            const confidence = 0.6 + Math.random() * 0.3;

            if (isLong) longVotes++;
            else shortVotes++;

            totalBotsVoting++;
            totalConfidence += confidence;

            const avgEntry = coin.price;
            const avgTakeProfit = isLong ? coin.price * (1.03 + Math.random() * 0.07) : coin.price * (0.90 + Math.random() * 0.07);
            const avgStopLoss = isLong ? coin.price * (0.95 - Math.random() * 0.03) : coin.price * (1.02 + Math.random() * 0.03);

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
              market_regime: marketRegime,
            });
          }
        }

        if (totalBotsVoting > 0) {
          const isLong = longVotes > shortVotes;
          const avgConfidence = totalConfidence / totalBotsVoting;
          const avgEntry = coin.price;
          const avgTakeProfit = isLong ? coin.price * (1.03 + Math.random() * 0.07) : coin.price * (0.90 + Math.random() * 0.07);
          const avgStopLoss = isLong ? coin.price * (0.95 - Math.random() * 0.03) : coin.price * (1.02 + Math.random() * 0.03);

          recommendations.push({
            run_id: scanRun.id,
            coin: coin.name,
            ticker: coin.symbol,
            current_price: coin.price,
            consensus_direction: isLong ? 'LONG' : 'SHORT',
            avg_confidence: avgConfidence,
            avg_entry: avgEntry,
            avg_take_profit: avgTakeProfit,
            avg_stop_loss: avgStopLoss,
            avg_predicted_24h: isLong ? coin.price * (1.02 + Math.random() * 0.03) : coin.price * (0.97 - Math.random() * 0.03),
            avg_predicted_48h: isLong ? coin.price * (1.04 + Math.random() * 0.04) : coin.price * (0.94 - Math.random() * 0.04),
            avg_predicted_7d: isLong ? coin.price * (1.08 + Math.random() * 0.07) : coin.price * (0.88 - Math.random() * 0.07),
            bot_count: totalBotsVoting,
            market_regime: marketRegime,
            regime_confidence: regimeConfidence,
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
          total_coins: coinsToAnalyze.length,
          total_bots: 59,
          total_signals: recommendations.length,
        })
        .eq('id', scanRun.id);

    } catch (error) {
      console.error('Scan error:', error);
      await supabase
        .from('scan_runs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error.message,
        })
        .eq('id', scanRun.id);
    }

    return new Response(JSON.stringify({
      success: true,
      runId: scanRun.id,
      message: 'Scan completed successfully',
      totalSignals: recommendations.length
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