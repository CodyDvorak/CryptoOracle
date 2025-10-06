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

    const now = new Date();
    console.log('Cron trigger running at:', now.toISOString());

    const { data: dueScans, error: fetchError } = await supabase
      .from('scheduled_scans')
      .select('*')
      .eq('is_active', true)
      .lte('next_run_at', now.toISOString());

    if (fetchError) throw fetchError;

    console.log(`Found ${dueScans?.length || 0} due scans`);

    const results = [];

    for (const scan of dueScans || []) {
      try {
        // Parse config from JSONB
        const config = scan.config || {};

        const scanPayload = {
          interval: '4h',
          scanType: config.scanType || 'comprehensive_scan',
          coinLimit: config.coinLimit || 100,
          filterScope: config.filterScope || 'top200',
          confidenceThreshold: config.confidenceThreshold || 0.60,
          userId: scan.user_id,
          scheduledScanId: scan.id,
          automated: config.automated || false,
        };

        const scanResponse = await fetch(`${supabaseUrl}/functions/v1/scan-run`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify(scanPayload),
        });

        if (!scanResponse.ok) {
          throw new Error(`Scan failed: ${await scanResponse.text()}`);
        }

        const scanResult = await scanResponse.json();

        const nextRun = calculateNextRun(scan);

        await supabase
          .from('scheduled_scans')
          .update({
            last_run_at: now.toISOString(),
            next_run_at: nextRun.toISOString(),
          })
          .eq('id', scan.id);

        results.push({
          scan_id: scan.id,
          status: 'success',
          run_id: scanResult.runId,
        });

        console.log(`Scan ${scan.id} completed successfully`);
      } catch (scanError) {
        console.error(`Scan ${scan.id} failed:`, scanError);

        await supabase
          .from('scheduled_scans')
          .update({
            last_run_at: now.toISOString(),
            next_run_at: calculateNextRun(scan).toISOString(),
          })
          .eq('id', scan.id);

        results.push({
          scan_id: scan.id,
          status: 'failed',
          error: scanError.message,
        });
      }
    }

    const processedEmails = await processEmailQueue(supabase);

    let performanceEvaluated = 0;
    if (now.getMinutes() % 30 === 0) {
      performanceEvaluated = await evaluateBotPerformance(supabase);
    }

    if ((dueScans?.length || 0) > 0) {
      await refreshBotPerformanceCache(supabase);
    }

    return new Response(
      JSON.stringify({
        success: true,
        scans_processed: dueScans?.length || 0,
        results,
        emails_processed: processedEmails,
        performance_evaluated: performanceEvaluated,
        timestamp: now.toISOString(),
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
    console.error('Cron trigger error:', error);
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

function calculateNextRun(scan: any): Date {
  const next = new Date();

  // Parse cron schedule to determine next run
  // Format: '0 */4 * * *' means every 4 hours
  const cron = scan.schedule_cron || '0 */4 * * *';

  // Simple parser for common patterns
  if (cron.includes('*/4')) {
    // Every 4 hours
    next.setHours(next.getHours() + 4);
  } else if (cron.includes('*/1') || cron === '0 * * * *') {
    // Every hour
    next.setHours(next.getHours() + 1);
  } else if (cron.includes('0 0 * * *')) {
    // Daily
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
  } else {
    // Default to 4 hours if unclear
    next.setHours(next.getHours() + 4);
  }

  return next;
}

async function processEmailQueue(supabase: any): Promise<number> {
  try {
    const emailProcessorUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/email-processor`;
    const response = await fetch(emailProcessorUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
    });

    if (response.ok) {
      const result = await response.json();
      return result.processed || 0;
    }
  } catch (error) {
    console.error('Email processing failed:', error);
  }

  return 0;
}

async function evaluateBotPerformance(supabase: any): Promise<number> {
  try {
    const performanceEvaluatorUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/bot-performance-evaluator`;
    const response = await fetch(performanceEvaluatorUrl + '?hours=24', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`Bot performance evaluation: ${result.evaluated} predictions evaluated`);

      const botPerformanceUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/bot-performance`;
      await fetch(botPerformanceUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
      });
      console.log('Bot performance cache refreshed');

      return result.evaluated || 0;
    }
  } catch (error) {
    console.error('Bot performance evaluation failed:', error);
  }

  return 0;
}

async function refreshBotPerformanceCache(supabase: any): Promise<void> {
  try {
    const botPerformanceUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/bot-performance`;
    await fetch(botPerformanceUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
    });
    console.log('Bot performance cache refreshed after scan completion');
  } catch (error) {
    console.error('Cache refresh failed:', error);
  }
}
