import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'get';

    if (action === 'get') {
      return await getCorrelations(supabase);
    } else if (action === 'calculate') {
      return await calculateCorrelations(supabase);
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Market correlation error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function getCorrelations(supabase: any) {
  const { data: correlations, error } = await supabase
    .from('market_correlations')
    .select('*')
    .order('correlation_coefficient', { ascending: false })
    .limit(50);

  if (error) throw error;

  const { data: snapshot } = await supabase
    .from('correlation_snapshots')
    .select('*')
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  return new Response(
    JSON.stringify({
      correlations: correlations || [],
      snapshot: snapshot || null,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function calculateCorrelations(supabase: any) {
  console.log('Triggering correlation calculation via calculate-correlations function...');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Call the calculate-correlations function
    const correlationUrl = `${supabaseUrl}/functions/v1/calculate-correlations`;

    const response = await fetch(`${correlationUrl}?days=30&timeframe=1d`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Correlation calculation failed: ${JSON.stringify(data)}`);
    }

    console.log(`✅ Calculated ${data.results?.totalCorrelations || 0} correlations`);

    return new Response(
      JSON.stringify({
        success: true,
        calculated: data.results?.totalCorrelations || 0,
        results: data
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Correlation calculation error:', error);
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
}

// Note: Correlation calculation logic moved to calculate-correlations function
// This function now delegates to the new service with multi-API support
