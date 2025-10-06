import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const TRACKED_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'MATICUSDT', 'DOTUSDT', 'AVAXUSDT',
  'LINKUSDT', 'UNIUSDT', 'LTCUSDT', 'ATOMUSDT', 'XLMUSDT'
];

const BATCH_SIZE = 50;
const BATCH_INTERVAL = 60000;

let priceBuffer: Array<{ symbol: string; price: number; timestamp: Date }> = [];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'status';

    if (action === 'status') {
      return new Response(
        JSON.stringify({
          status: 'active',
          tracked_symbols: TRACKED_SYMBOLS.length,
          buffer_size: priceBuffer.length,
          message: 'WebSocket price tracker is running',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'start') {
      startPriceTracking(supabase);
      return new Response(
        JSON.stringify({ message: 'Price tracking started' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'manual') {
      await fetchAndStorePrices(supabase);
      return new Response(
        JSON.stringify({ message: 'Manual price fetch completed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use: status, start, or manual' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Price tracker error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function fetchAndStorePrices(supabase: any) {
  try {
    const symbols = TRACKED_SYMBOLS.join(',');
    const response = await fetch(
      `https://api.binance.com/api/v3/ticker/price?symbols=[${symbols.split(',').map(s => `"${s}"`).join(',')}]`
    );

    if (!response.ok) {
      console.error('Binance API error:', response.status);
      return;
    }

    const prices = await response.json();
    const now = new Date();

    const priceRecords = prices.map((p: any) => ({
      symbol: p.symbol.replace('USDT', ''),
      price: parseFloat(p.price),
      timestamp: now,
      source: 'binance_api',
    }));

    const { error } = await supabase
      .from('price_history')
      .insert(priceRecords);

    if (error) {
      console.error('Failed to insert prices:', error);
    } else {
      console.log(`✅ Stored ${priceRecords.length} prices`);
    }
  } catch (error) {
    console.error('Fetch and store error:', error);
  }
}

function startPriceTracking(supabase: any) {
  console.log('🚀 Starting Binance price tracking for', TRACKED_SYMBOLS.length, 'symbols');

  setInterval(async () => {
    await fetchAndStorePrices(supabase);
  }, BATCH_INTERVAL);

  fetchAndStorePrices(supabase);
}
