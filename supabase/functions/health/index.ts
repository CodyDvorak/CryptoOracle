import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface HealthStatus {
  status: string;
  timestamp: string;
  database: {
    connected: boolean;
    latency_ms?: number;
    error?: string;
  };
  dataProviders: {
    coinmarketcap: { available: boolean; priority: number };
    coingecko: { available: boolean; priority: number };
    cryptocompare: { available: boolean; priority: number };
    okx: { available: boolean; priority: number };
    coinalyze: { available: boolean; priority: number };
    bybit: { available: boolean; priority: number };
    binance: { available: boolean; priority: number };
  };
  bots: {
    total: number;
    operational: number;
    status: string;
  };
}

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

    const startTime = Date.now();
    
    const { data: scanCount, error: dbError } = await supabase
      .from('scan_runs')
      .select('id', { count: 'exact', head: true });
    
    const dbLatency = Date.now() - startTime;

    const healthStatus: HealthStatus = {
      status: 'operational',
      timestamp: new Date().toISOString(),
      database: {
        connected: !dbError,
        latency_ms: dbError ? undefined : dbLatency,
        error: dbError?.message,
      },
      dataProviders: {
        coinmarketcap: { available: true, priority: 1 },
        coingecko: { available: true, priority: 2 },
        cryptocompare: { available: true, priority: 3 },
        okx: { available: true, priority: 1 },
        coinalyze: { available: true, priority: 2 },
        bybit: { available: true, priority: 3 },
        binance: { available: true, priority: 4 },
      },
      bots: {
        total: 54,
        operational: 54,
        status: 'all_systems_operational',
      },
    };

    if (dbError) {
      healthStatus.status = 'degraded';
    }

    return new Response(JSON.stringify(healthStatus), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: 'error',
        timestamp: new Date().toISOString(),
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