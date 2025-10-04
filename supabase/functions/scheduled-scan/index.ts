import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface EmailTemplate {
  subject: string;
  html: string;
}

function generateScanCompleteEmail(scanData: any): EmailTemplate {
  const { scan, topRecommendations } = scanData;

  let recommendationsHtml = '';
  topRecommendations.forEach((rec: any, index: number) => {
    const direction = rec.consensus_direction?.toUpperCase();
    const directionColor = direction === 'LONG' ? '#22c55e' : '#ef4444';

    recommendationsHtml += `
      <div style="background: #1e293b; border-left: 4px solid ${directionColor}; padding: 16px; margin-bottom: 12px; border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; color: #f1f5f9;">#${index + 1} ${rec.coin} (${rec.ticker})</h3>
          <span style="background: ${directionColor}; color: white; padding: 4px 12px; border-radius: 6px; font-weight: bold;">${direction}</span>
        </div>
        <div style="margin-top: 12px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
          <div>
            <div style="color: #94a3b8; font-size: 12px;">Price</div>
            <div style="color: #f1f5f9; font-weight: 600;">$${rec.current_price?.toFixed(4)}</div>
          </div>
          <div>
            <div style="color: #94a3b8; font-size: 12px;">Confidence</div>
            <div style="color: #f1f5f9; font-weight: 600;">${(rec.avg_confidence * 10)?.toFixed(1)}/10</div>
          </div>
          <div>
            <div style="color: #94a3b8; font-size: 12px;">Consensus</div>
            <div style="color: #f1f5f9; font-weight: 600;">${rec.consensus_percent?.toFixed(1)}%</div>
          </div>
        </div>
        <div style="margin-top: 8px; color: #94a3b8; font-size: 13px;">
          ${rec.bot_count} bots analyzed • ${rec.long_bots} LONG, ${rec.short_bots} SHORT
        </div>
      </div>
    `;
  });

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 0; }
  </style>
</head>
<body>
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #1e293b; border-radius: 12px; padding: 32px; margin-bottom: 24px;">
      <h1 style="margin: 0 0 8px 0; color: #3b82f6;">Crypto Oracle Scan Complete</h1>
      <p style="margin: 0; color: #94a3b8;">Your scheduled scan has finished analyzing the market</p>
    </div>

    <div style="background: #1e293b; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
      <h2 style="margin: 0 0 16px 0; color: #f1f5f9;">Scan Summary</h2>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
        <div style="background: #334155; padding: 16px; border-radius: 8px;">
          <div style="color: #94a3b8; font-size: 12px; margin-bottom: 4px;">Total Analyzed</div>
          <div style="color: #f1f5f9; font-size: 24px; font-weight: bold;">${scan.coins_analyzed || 0}</div>
        </div>
        <div style="background: #334155; padding: 16px; border-radius: 8px;">
          <div style="color: #94a3b8; font-size: 12px; margin-bottom: 4px;">High Confidence</div>
          <div style="color: #22c55e; font-size: 24px; font-weight: bold;">${topRecommendations.filter((r: any) => r.avg_confidence >= 0.7).length}</div>
        </div>
      </div>
    </div>

    <div style="background: #1e293b; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
      <h2 style="margin: 0 0 16px 0; color: #f1f5f9;">Top Recommendations</h2>
      ${recommendationsHtml}
    </div>

    <div style="text-align: center; padding: 24px;">
      <a href="${Deno.env.get('FRONTEND_URL') || 'http://localhost:5173'}/results"
         style="background: #3b82f6; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
        View Full Results
      </a>
    </div>

    <div style="text-align: center; color: #64748b; font-size: 12px; padding: 16px;">
      <p>You received this email because you have scheduled scans enabled.</p>
      <p>Manage your preferences in your account settings.</p>
    </div>
  </div>
</body>
</html>
  `;

  return {
    subject: `🚀 Scan Complete: ${topRecommendations.length} Signals Found`,
    html
  };
}

async function sendEmail(supabase: any, userId: string, email: string, template: EmailTemplate) {
  await supabase.from('email_queue').insert({
    user_id: userId,
    recipient_email: email,
    subject: template.subject,
    html_body: template.html,
    template_type: 'scan_complete',
    template_data: {}
  });
}

async function createNotification(supabase: any, userId: string, title: string, message: string, data: any) {
  await supabase.from('notifications').insert({
    user_id: userId,
    type: 'scan_complete',
    title,
    message,
    data,
    priority: 'normal'
  });
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

    const now = new Date().toISOString();

    const { data: dueScans } = await supabase
      .from('scheduled_scans')
      .select('*, user_profiles!inner(email, notification_preferences)')
      .lte('next_run_at', now)
      .eq('is_active', true);

    if (!dueScans || dueScans.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No scans due',
        processed: 0
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }

    const results = [];

    for (const schedule of dueScans) {
      try {
        const scanResponse = await fetch(`${supabaseUrl}/functions/v1/scan-run`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          }
        });

        if (!scanResponse.ok) {
          throw new Error('Scan execution failed');
        }

        const scanResult = await scanResponse.json();

        const { data: scanData } = await supabase
          .from('scan_runs')
          .select('*')
          .eq('id', scanResult.runId)
          .single();

        const { data: recommendations } = await supabase
          .from('scan_recommendations')
          .select('*')
          .eq('run_id', scanResult.runId)
          .order('avg_confidence', { ascending: false })
          .limit(5);

        const prefs = schedule.user_profiles.notification_preferences;

        if (prefs.email_enabled) {
          const emailTemplate = generateScanCompleteEmail({
            scan: scanData,
            topRecommendations: recommendations || []
          });

          await sendEmail(
            supabase,
            schedule.user_id,
            schedule.user_profiles.email,
            emailTemplate
          );
        }

        if (prefs.push_enabled) {
          const highConfidenceSignals = recommendations?.filter(
            (r: any) => r.avg_confidence >= (prefs.min_confidence || 7) / 10
          ) || [];

          await createNotification(
            supabase,
            schedule.user_id,
            'Scheduled Scan Complete',
            `Found ${highConfidenceSignals.length} high-confidence signals`,
            {
              runId: scanResult.runId,
              totalSignals: recommendations?.length || 0,
              highConfidenceCount: highConfidenceSignals.length
            }
          );
        }

        const nextRunTime = new Date();
        nextRunTime.setHours(nextRunTime.getHours() + 24);

        await supabase
          .from('scheduled_scans')
          .update({
            last_run_at: now,
            next_run_at: nextRunTime.toISOString()
          })
          .eq('id', schedule.id);

        results.push({
          scheduleId: schedule.id,
          runId: scanResult.runId,
          status: 'success'
        });

      } catch (error) {
        console.error(`Failed to process schedule ${schedule.id}:`, error);
        results.push({
          scheduleId: schedule.id,
          status: 'failed',
          error: error.message
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: results.length,
      results
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('Scheduled scan error:', error);
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
