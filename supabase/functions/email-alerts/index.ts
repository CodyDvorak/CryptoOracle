import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
import { Resend } from 'npm:resend@3.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface Alert {
  id: string;
  user_id: string;
  alert_type: 'price' | 'signal' | 'regime_change' | 'high_confidence';
  coin_symbol?: string;
  threshold_value?: number;
  is_active: boolean;
  last_triggered?: string;
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
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);
    const resend = new Resend(resendApiKey);

    const { action, userId, alertConfig } = await req.json();

    if (action === 'check_and_send') {
      const { data: recommendations } = await supabase
        .from('recommendations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (!recommendations || recommendations.length === 0) {
        return new Response(
          JSON.stringify({ message: 'No recent recommendations' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: alerts } = await supabase
        .from('user_alerts')
        .select('*')
        .eq('is_active', true);

      if (!alerts || alerts.length === 0) {
        return new Response(
          JSON.stringify({ message: 'No active alerts' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const triggeredAlerts = [];

      for (const alert of alerts) {
        const shouldTrigger = await checkAlertCondition(alert, recommendations, supabase);

        if (shouldTrigger) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('email')
            .eq('user_id', alert.user_id)
            .single();

          if (profile?.email) {
            const emailContent = generateEmailContent(alert, recommendations);

            await resend.emails.send({
              from: 'Crypto Oracle <alerts@cryptooracle.ai>',
              to: profile.email,
              subject: emailContent.subject,
              html: emailContent.html,
            });

            await supabase
              .from('user_alerts')
              .update({ last_triggered: new Date().toISOString() })
              .eq('id', alert.id);

            triggeredAlerts.push(alert);
          }
        }
      }

      return new Response(
        JSON.stringify({
          message: `Sent ${triggeredAlerts.length} alerts`,
          triggeredAlerts,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'create_alert') {
      const { error } = await supabase
        .from('user_alerts')
        .insert({
          user_id: userId,
          ...alertConfig,
        });

      if (error) throw error;

      return new Response(
        JSON.stringify({ message: 'Alert created successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get_alerts') {
      const { data: alerts } = await supabase
        .from('user_alerts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      return new Response(
        JSON.stringify({ alerts: alerts || [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'toggle_alert') {
      const { alertId, isActive } = await req.json();

      const { error } = await supabase
        .from('user_alerts')
        .update({ is_active: isActive })
        .eq('id', alertId)
        .eq('user_id', userId);

      if (error) throw error;

      return new Response(
        JSON.stringify({ message: 'Alert updated' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function checkAlertCondition(
  alert: Alert,
  recommendations: any[],
  supabase: any
): Promise<boolean> {
  const now = new Date();
  const lastTriggered = alert.last_triggered ? new Date(alert.last_triggered) : null;

  if (lastTriggered && (now.getTime() - lastTriggered.getTime()) < 3600000) {
    return false;
  }

  switch (alert.alert_type) {
    case 'high_confidence':
      return recommendations.some(r => r.avg_confidence >= (alert.threshold_value || 0.85));

    case 'price':
      if (!alert.coin_symbol || !alert.threshold_value) return false;
      const coinRec = recommendations.find(r => r.ticker === alert.coin_symbol);
      return coinRec && coinRec.current_price >= alert.threshold_value;

    case 'regime_change':
      if (!alert.coin_symbol) return false;
      const { data: lastRec } = await supabase
        .from('recommendations')
        .select('market_regime')
        .eq('ticker', alert.coin_symbol)
        .order('created_at', { ascending: false })
        .limit(2);

      if (lastRec && lastRec.length === 2) {
        return lastRec[0].market_regime !== lastRec[1].market_regime;
      }
      return false;

    case 'signal':
      if (!alert.coin_symbol) return false;
      return recommendations.some(r => r.ticker === alert.coin_symbol);

    default:
      return false;
  }
}

function generateEmailContent(alert: Alert, recommendations: any[]) {
  const highConfRecs = recommendations
    .filter(r => r.avg_confidence >= 0.85)
    .slice(0, 5);

  const subject = alert.alert_type === 'high_confidence'
    ? `🚀 ${highConfRecs.length} High Confidence Signals Detected!`
    : `⚠️ Alert Triggered: ${alert.alert_type}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; }
        .signal { background: white; padding: 20px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #667eea; }
        .signal h3 { margin: 0 0 10px 0; color: #667eea; }
        .long { border-left-color: #10b981; }
        .short { border-left-color: #ef4444; }
        .metrics { display: flex; justify-content: space-between; margin: 10px 0; }
        .metric { text-align: center; }
        .metric-label { font-size: 12px; color: #666; }
        .metric-value { font-size: 18px; font-weight: bold; color: #333; }
        .footer { background: #333; color: white; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; }
        .btn { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔔 Crypto Oracle Alert</h1>
          <p>New trading signals detected</p>
        </div>
        <div class="content">
          <h2>High Confidence Signals</h2>
          ${highConfRecs.map(rec => `
            <div class="signal ${rec.consensus_direction.toLowerCase()}">
              <h3>${rec.coin} (${rec.ticker})</h3>
              <p><strong>${rec.consensus_direction}</strong> • Confidence: ${(rec.avg_confidence * 10).toFixed(1)}/10</p>
              <div class="metrics">
                <div class="metric">
                  <div class="metric-label">Current Price</div>
                  <div class="metric-value">$${rec.current_price.toFixed(8)}</div>
                </div>
                <div class="metric">
                  <div class="metric-label">24h Prediction</div>
                  <div class="metric-value">$${rec.avg_predicted_24h.toFixed(8)}</div>
                </div>
                <div class="metric">
                  <div class="metric-label">Bots</div>
                  <div class="metric-value">${rec.bot_count}/59</div>
                </div>
              </div>
              <p><strong>Market Regime:</strong> ${rec.market_regime} (${(rec.regime_confidence * 100).toFixed(0)}% confidence)</p>
            </div>
          `).join('')}

          <a href="https://cryptooracle.ai/dashboard" class="btn">View All Signals</a>
        </div>
        <div class="footer">
          <p>Crypto Oracle - AI-Powered Trading Signals</p>
          <p style="font-size: 12px; color: #999;">You're receiving this because you have active alerts enabled.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}
