import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    console.log('⏰ Correlation cron job triggered');

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

    console.log('✅ Correlation cron job completed successfully');
    console.log(`Calculated ${data.results?.totalCorrelations || 0} correlations`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Correlation calculation triggered successfully',
        timestamp: new Date().toISOString(),
        results: data
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Correlation cron job failed:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
