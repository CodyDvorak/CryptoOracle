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

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: stuckScans } = await supabase
      .from('scan_runs')
      .select('id')
      .eq('status', 'running')
      .lt('started_at', fiveMinutesAgo);

    if (!stuckScans || stuckScans.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No stuck scans found', cleaned: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const scanIds = stuckScans.map(s => s.id);

    const { data: recommendations } = await supabase
      .from('recommendations')
      .select('run_id')
      .in('run_id', scanIds);

    const scansWithData = new Set(recommendations?.map(r => r.run_id) || []);

    for (const scanId of scanIds) {
      if (scansWithData.has(scanId)) {
        await supabase
          .from('scan_runs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', scanId);
      } else {
        await supabase
          .from('scan_runs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: 'Scan timed out without producing results',
          })
          .eq('id', scanId);
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Cleanup completed',
        cleaned: scanIds.length,
        completed: Array.from(scansWithData).length,
        failed: scanIds.length - scansWithData.size,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Cleanup error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});