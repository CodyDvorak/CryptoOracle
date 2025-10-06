import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const cmcApiKey = Deno.env.get('COINMARKETCAP_API_KEY') || '';
    const coinGeckoApiKey = Deno.env.get('COINGECKO_API_KEY') || '';
    const cryptoCompareApiKey = Deno.env.get('CRYPTOCOMPARE_API_KEY') || '';

    console.log('🔍 Fetching coins with active predictions...');

    const { data: coinsWithPredictions } = await supabase
      .from('bot_predictions')
      .select('coin_symbol')
      .gte('timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (!coinsWithPredictions || coinsWithPredictions.length === 0) {
      console.log('⚠️ No coins with recent predictions found');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No coins to track',
          prices_stored: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const uniqueSymbols = [...new Set(coinsWithPredictions.map((p: any) => p.coin_symbol))];
    console.log(`📊 Tracking ${uniqueSymbols.length} unique coins`);

    const priceRecords: Array<{ symbol: string; price: number; timestamp: Date; source: string }> = [];
    const now = new Date();

    let pricesFromCMC = 0;
    let pricesFromCoinGecko = 0;
    let pricesFromCryptoCompare = 0;

    if (cmcApiKey) {
      try {
        console.log('📡 Fetching from CoinMarketCap...');
        const symbolsString = uniqueSymbols.join(',');
        const response = await fetch(
          `https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?symbol=${symbolsString}`,
          {
            headers: {
              'X-CMC_PRO_API_KEY': cmcApiKey,
              'Accept': 'application/json',
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          for (const symbol of uniqueSymbols) {
            const coinData = data.data?.[symbol]?.[0];
            if (coinData?.quote?.USD?.price) {
              priceRecords.push({
                symbol,
                price: coinData.quote.USD.price,
                timestamp: now,
                source: 'cmc',
              });
              pricesFromCMC++;
            }
          }
          console.log(`✅ Got ${pricesFromCMC} prices from CoinMarketCap`);
        }
      } catch (error) {
        console.error('CMC error:', error.message);
      }
    }

    const missingSymbols = uniqueSymbols.filter(
      s => !priceRecords.some(p => p.symbol === s)
    );

    if (missingSymbols.length > 0 && coinGeckoApiKey) {
      try {
        console.log(`📡 Fetching ${missingSymbols.length} missing prices from CoinGecko...`);

        for (let i = 0; i < missingSymbols.length; i += 50) {
          const batch = missingSymbols.slice(i, i + 50);
          const ids = batch.map(s => s.toLowerCase()).join(',');

          const headers: any = { 'Accept': 'application/json' };
          if (coinGeckoApiKey) {
            headers['x-cg-pro-api-key'] = coinGeckoApiKey;
          }

          const response = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
            { headers }
          );

          if (response.ok) {
            const data = await response.json();
            for (const symbol of batch) {
              const price = data[symbol.toLowerCase()]?.usd;
              if (price) {
                priceRecords.push({
                  symbol,
                  price,
                  timestamp: now,
                  source: 'coingecko',
                });
                pricesFromCoinGecko++;
              }
            }
          }

          if (i + 50 < missingSymbols.length) {
            await new Promise(resolve => setTimeout(resolve, 1200));
          }
        }
        console.log(`✅ Got ${pricesFromCoinGecko} prices from CoinGecko`);
      } catch (error) {
        console.error('CoinGecko error:', error.message);
      }
    }

    const stillMissingSymbols = uniqueSymbols.filter(
      s => !priceRecords.some(p => p.symbol === s)
    );

    if (stillMissingSymbols.length > 0 && cryptoCompareApiKey) {
      try {
        console.log(`📡 Fetching ${stillMissingSymbols.length} remaining prices from CryptoCompare...`);

        for (const symbol of stillMissingSymbols) {
          const response = await fetch(
            `https://min-api.cryptocompare.com/data/price?fsym=${symbol.toUpperCase()}&tsyms=USD`,
            {
              headers: {
                'authorization': `Apikey ${cryptoCompareApiKey}`,
                'Accept': 'application/json',
              },
            }
          );

          if (response.ok) {
            const data = await response.json();
            if (data.USD) {
              priceRecords.push({
                symbol,
                price: data.USD,
                timestamp: now,
                source: 'cryptocompare',
              });
              pricesFromCryptoCompare++;
            }
          }

          await new Promise(resolve => setTimeout(resolve, 200));
        }
        console.log(`✅ Got ${pricesFromCryptoCompare} prices from CryptoCompare`);
      } catch (error) {
        console.error('CryptoCompare error:', error.message);
      }
    }

    if (priceRecords.length > 0) {
      const { error } = await supabase
        .from('price_history')
        .insert(priceRecords);

      if (error) {
        console.error('Failed to insert prices:', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`✅ Stored ${priceRecords.length} prices to database`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_coins: uniqueSymbols.length,
        prices_stored: priceRecords.length,
        sources: {
          cmc: pricesFromCMC,
          coingecko: pricesFromCoinGecko,
          cryptocompare: pricesFromCryptoCompare,
        },
        missing_prices: uniqueSymbols.length - priceRecords.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Price tracker error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});