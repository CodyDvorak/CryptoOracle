import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

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

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');

    const { data: scans, error: scansError } = await supabase
      .from('scan_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);

    if (scansError) throw scansError;

    const scanIds = scans.map(scan => scan.id);

    const { data: recommendations, error: recsError } = await supabase
      .from('recommendations')
      .select('*')
      .in('run_id', scanIds);

    if (recsError) throw recsError;

    const scansWithRecommendations = scans.map(scan => ({
      ...scan,
      recommendations: recommendations.filter(rec => rec.run_id === scan.id),
      recommendationCount: recommendations.filter(rec => rec.run_id === scan.id).length,
    }));

    return new Response(
      JSON.stringify({
        scans: scansWithRecommendations,
        total: scans.length,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
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