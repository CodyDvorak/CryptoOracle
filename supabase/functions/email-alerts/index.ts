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
  alert_type: 'price' | 'signal' | 'regime_change' | 'high_confidence' | 'bot_consensus' | 'scheduled_report';
  coin_symbol?: string;
  threshold_value?: number;
  is_active: boolean;
  last_triggered?: string;
  alert_frequency?: 'immediate' | 'daily' | 'weekly';
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
        .limit(50);

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
            .select('email, full_name')
            .eq('user_id', alert.user_id)
            .single();

          if (profile?.email) {
            const emailContent = generateEmailContent(alert, recommendations, profile.full_name);

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

    if (action === 'send_scheduled_report') {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('email_notifications_enabled', true);

      if (!profiles || profiles.length === 0) {
        return new Response(
          JSON.stringify({ message: 'No users with email notifications enabled' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: recommendations } = await supabase
        .from('recommendations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      const sentEmails = [];

      for (const profile of profiles) {
        const emailContent = generateScheduledReportEmail(recommendations, profile.full_name);

        await resend.emails.send({
          from: 'Crypto Oracle <reports@cryptooracle.ai>',
          to: profile.email,
          subject: emailContent.subject,
          html: emailContent.html,
        });

        sentEmails.push(profile.email);
      }

      return new Response(
        JSON.stringify({ message: `Sent ${sentEmails.length} scheduled reports` }),
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
    console.error('Email alerts error:', error);
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

  const cooldownPeriod = alert.alert_frequency === 'immediate' ? 3600000 :
                         alert.alert_frequency === 'daily' ? 86400000 :
                         alert.alert_frequency === 'weekly' ? 604800000 : 3600000;

  if (lastTriggered && (now.getTime() - lastTriggered.getTime()) < cooldownPeriod) {
    return false;
  }

  switch (alert.alert_type) {
    case 'high_confidence':
      return recommendations.some(r => r.avg_confidence >= (alert.threshold_value || 0.8));

    case 'bot_consensus':
      const consensusThreshold = alert.threshold_value || 0.8;
      return recommendations.some(r => {
        const longVotes = r.bot_votes_long || 0;
        const totalVotes = (r.bot_votes_long || 0) + (r.bot_votes_short || 0);
        const consensus = totalVotes > 0 ? Math.max(longVotes, totalVotes - longVotes) / totalVotes : 0;
        return consensus >= consensusThreshold;
      });

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
      return recommendations.some(r => r.ticker === alert.coin_symbol && r.avg_confidence >= 0.7);

    case 'scheduled_report':
      return true;

    default:
      return false;
  }
}

function generateEmailContent(alert: Alert, recommendations: any[], userName?: string) {
  const highConfRecs = recommendations
    .filter(r => r.avg_confidence >= 0.8)
    .slice(0, 10);

  const botConsensusRecs = recommendations
    .filter(r => {
      const longVotes = r.bot_votes_long || 0;
      const totalVotes = (r.bot_votes_long || 0) + (r.bot_votes_short || 0);
      const consensus = totalVotes > 0 ? Math.max(longVotes, totalVotes - longVotes) / totalVotes : 0;
      return consensus >= 0.8;
    })
    .slice(0, 10);

  let subject = '';
  let relevantRecs = highConfRecs;

  switch (alert.alert_type) {
    case 'high_confidence':
      subject = `🚀 ${highConfRecs.length} High Confidence Signals (≥80%)`;
      break;
    case 'bot_consensus':
      subject = `🤖 ${botConsensusRecs.length} Strong Bot Consensus Signals (≥80%)`;
      relevantRecs = botConsensusRecs;
      break;
    case 'regime_change':
      subject = `⚠️ Market Regime Change Alert: ${alert.coin_symbol}`;
      relevantRecs = recommendations.filter(r => r.ticker === alert.coin_symbol).slice(0, 1);
      break;
    case 'signal':
      subject = `📊 Trading Signal: ${alert.coin_symbol}`;
      relevantRecs = recommendations.filter(r => r.ticker === alert.coin_symbol).slice(0, 1);
      break;
    default:
      subject = `🔔 Crypto Oracle Alert`;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 700px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
        .header h1 { margin: 0 0 10px 0; font-size: 28px; }
        .header p { margin: 0; opacity: 0.9; font-size: 16px; }
        .greeting { padding: 30px 30px 10px 30px; font-size: 18px; color: #555; }
        .content { padding: 10px 30px 30px 30px; }
        .signal { background: #f9fafb; padding: 24px; margin: 20px 0; border-radius: 12px; border-left: 5px solid #667eea; transition: transform 0.2s; }
        .signal:hover { transform: translateX(5px); }
        .signal h3 { margin: 0 0 12px 0; color: #667eea; font-size: 22px; display: flex; align-items: center; gap: 10px; }
        .long { border-left-color: #10b981; }
        .long h3 { color: #10b981; }
        .short { border-left-color: #ef4444; }
        .short h3 { color: #ef4444; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
        .badge-long { background: #d1fae5; color: #065f46; }
        .badge-short { background: #fee2e2; color: #991b1b; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px; margin: 20px 0; }
        .metric { text-align: center; padding: 15px; background: white; border-radius: 8px; }
        .metric-label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; }
        .metric-value { font-size: 20px; font-weight: bold; color: #333; }
        .confidence-bar { width: 100%; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; margin: 15px 0; }
        .confidence-fill { height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); border-radius: 4px; transition: width 0.3s; }
        .bot-breakdown { margin-top: 15px; padding: 15px; background: white; border-radius: 8px; }
        .bot-breakdown h4 { margin: 0 0 10px 0; font-size: 14px; color: #666; }
        .bot-votes { display: flex; justify-content: space-between; align-items: center; }
        .vote-bar { flex: 1; height: 24px; display: flex; border-radius: 4px; overflow: hidden; }
        .vote-long { background: #10b981; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold; }
        .vote-short { background: #ef4444; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold; }
        .footer { background: #1f2937; color: white; padding: 30px; text-align: center; }
        .footer p { margin: 5px 0; }
        .btn { display: inline-block; background: #667eea; color: white; padding: 14px 36px; text-decoration: none; border-radius: 8px; margin: 25px 0; font-weight: 600; transition: background 0.3s; }
        .btn:hover { background: #5568d3; }
        .disclaimer { font-size: 11px; color: #9ca3af; margin-top: 20px; padding: 15px; background: #f9fafb; border-radius: 6px; line-height: 1.5; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔔 Crypto Oracle Alert</h1>
          <p>${subject}</p>
        </div>

        ${userName ? `<div class="greeting">Hi ${userName},</div>` : ''}

        <div class="content">
          <p style="font-size: 16px; color: #555;">We've detected <strong>${relevantRecs.length} trading signal${relevantRecs.length !== 1 ? 's' : ''}</strong> that match your alert criteria:</p>

          ${relevantRecs.map(rec => {
            const longVotes = rec.bot_votes_long || 0;
            const shortVotes = rec.bot_votes_short || 0;
            const totalVotes = longVotes + shortVotes;
            const longPercent = totalVotes > 0 ? (longVotes / totalVotes * 100) : 50;
            const shortPercent = 100 - longPercent;
            const confidencePercent = (rec.avg_confidence * 100).toFixed(0);

            return `
            <div class="signal ${rec.consensus_direction.toLowerCase()}">
              <h3>
                ${rec.coin} (${rec.ticker})
                <span class="badge badge-${rec.consensus_direction.toLowerCase()}">${rec.consensus_direction}</span>
              </h3>

              <div class="metrics">
                <div class="metric">
                  <div class="metric-label">Current Price</div>
                  <div class="metric-value">$${rec.current_price.toFixed(8)}</div>
                </div>
                <div class="metric">
                  <div class="metric-label">24h Target</div>
                  <div class="metric-value">$${rec.avg_predicted_24h.toFixed(8)}</div>
                </div>
                <div class="metric">
                  <div class="metric-label">Change</div>
                  <div class="metric-value" style="color: ${rec.predicted_change_24h >= 0 ? '#10b981' : '#ef4444'}">
                    ${rec.predicted_change_24h >= 0 ? '+' : ''}${rec.predicted_change_24h.toFixed(2)}%
                  </div>
                </div>
              </div>

              <div>
                <strong>Confidence Score:</strong> ${confidencePercent}%
                <div class="confidence-bar">
                  <div class="confidence-fill" style="width: ${confidencePercent}%"></div>
                </div>
              </div>

              <div class="bot-breakdown">
                <h4>Bot Consensus (${totalVotes} bots voting)</h4>
                <div class="bot-votes">
                  <div class="vote-bar">
                    <div class="vote-long" style="width: ${longPercent}%">
                      ${longVotes > 0 ? `${longVotes} LONG` : ''}
                    </div>
                    <div class="vote-short" style="width: ${shortPercent}%">
                      ${shortVotes > 0 ? `${shortVotes} SHORT` : ''}
                    </div>
                  </div>
                </div>
              </div>

              <p style="margin: 15px 0 5px 0;">
                <strong>Market Regime:</strong> ${rec.market_regime}
                <span style="color: #666;">(${(rec.regime_confidence * 100).toFixed(0)}% confidence)</span>
              </p>
            </div>
          `}).join('')}

          <div style="text-align: center;">
            <a href="https://cryptooracle.ai/dashboard" class="btn">View Full Dashboard</a>
          </div>

          <div class="disclaimer">
            <strong>⚠️ Disclaimer:</strong> This is not financial advice. Crypto trading involves substantial risk.
            These signals are generated by AI trading bots and should be used for informational purposes only.
            Always do your own research and never invest more than you can afford to lose.
          </div>
        </div>

        <div class="footer">
          <p><strong>Crypto Oracle</strong></p>
          <p>AI-Powered Trading Intelligence</p>
          <p style="font-size: 12px; color: #9ca3af; margin-top: 15px;">
            You're receiving this because you have active alerts enabled.<br>
            <a href="https://cryptooracle.ai/profile" style="color: #667eea;">Manage your alerts</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

function generateScheduledReportEmail(recommendations: any[], userName?: string) {
  const topSignals = recommendations
    .filter(r => r.avg_confidence >= 0.7)
    .slice(0, 15);

  const longSignals = topSignals.filter(r => r.consensus_direction === 'LONG');
  const shortSignals = topSignals.filter(r => r.consensus_direction === 'SHORT');

  const subject = `📊 Daily Crypto Oracle Report - ${topSignals.length} Signals`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 700px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
        .summary { padding: 30px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; }
        .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 20px; }
        .summary-card { background: white; padding: 20px; border-radius: 8px; text-align: center; }
        .summary-value { font-size: 32px; font-weight: bold; margin: 10px 0; }
        .summary-label { font-size: 12px; color: #666; text-transform: uppercase; }
        .content { padding: 30px; }
        .section-title { font-size: 20px; margin: 30px 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #667eea; }
        .signal-list { list-style: none; padding: 0; margin: 0; }
        .signal-item { padding: 15px; margin: 10px 0; background: #f9fafb; border-radius: 8px; border-left: 4px solid #667eea; }
        .long-item { border-left-color: #10b981; }
        .short-item { border-left-color: #ef4444; }
        .signal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .signal-name { font-weight: bold; font-size: 16px; }
        .signal-badge { padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: bold; }
        .badge-long { background: #d1fae5; color: #065f46; }
        .badge-short { background: #fee2e2; color: #991b1b; }
        .signal-details { font-size: 14px; color: #666; }
        .footer { background: #1f2937; color: white; padding: 30px; text-align: center; }
        .btn { display: inline-block; background: #667eea; color: white; padding: 14px 36px; text-decoration: none; border-radius: 8px; margin: 25px 0; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📊 Daily Market Report</h1>
          <p>${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        <div class="summary">
          <h2 style="margin-top: 0;">Market Overview</h2>
          <div class="summary-grid">
            <div class="summary-card">
              <div class="summary-label">Total Signals</div>
              <div class="summary-value">${topSignals.length}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Long Signals</div>
              <div class="summary-value" style="color: #10b981;">${longSignals.length}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Short Signals</div>
              <div class="summary-value" style="color: #ef4444;">${shortSignals.length}</div>
            </div>
          </div>
        </div>

        <div class="content">
          ${userName ? `<p>Hi ${userName},</p>` : ''}
          <p>Here's your daily summary of the top cryptocurrency trading signals from our 59 AI trading bots.</p>

          ${longSignals.length > 0 ? `
            <h3 class="section-title" style="color: #10b981;">🚀 Long Signals (${longSignals.length})</h3>
            <ul class="signal-list">
              ${longSignals.slice(0, 8).map(rec => `
                <li class="signal-item long-item">
                  <div class="signal-header">
                    <span class="signal-name">${rec.coin} (${rec.ticker})</span>
                    <span class="signal-badge badge-long">${(rec.avg_confidence * 100).toFixed(0)}% confidence</span>
                  </div>
                  <div class="signal-details">
                    $${rec.current_price.toFixed(8)} → $${rec.avg_predicted_24h.toFixed(8)}
                    (${rec.predicted_change_24h >= 0 ? '+' : ''}${rec.predicted_change_24h.toFixed(2)}%) •
                    ${rec.bot_count} bots
                  </div>
                </li>
              `).join('')}
            </ul>
          ` : ''}

          ${shortSignals.length > 0 ? `
            <h3 class="section-title" style="color: #ef4444;">📉 Short Signals (${shortSignals.length})</h3>
            <ul class="signal-list">
              ${shortSignals.slice(0, 8).map(rec => `
                <li class="signal-item short-item">
                  <div class="signal-header">
                    <span class="signal-name">${rec.coin} (${rec.ticker})</span>
                    <span class="signal-badge badge-short">${(rec.avg_confidence * 100).toFixed(0)}% confidence</span>
                  </div>
                  <div class="signal-details">
                    $${rec.current_price.toFixed(8)} → $${rec.avg_predicted_24h.toFixed(8)}
                    (${rec.predicted_change_24h >= 0 ? '+' : ''}${rec.predicted_change_24h.toFixed(2)}%) •
                    ${rec.bot_count} bots
                  </div>
                </li>
              `).join('')}
            </ul>
          ` : ''}

          <div style="text-align: center;">
            <a href="https://cryptooracle.ai/dashboard" class="btn">View Full Analysis</a>
          </div>
        </div>

        <div class="footer">
          <p><strong>Crypto Oracle</strong> - Daily Market Intelligence</p>
          <p style="font-size: 12px; color: #9ca3af; margin-top: 15px;">
            <a href="https://cryptooracle.ai/profile" style="color: #667eea;">Manage email preferences</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}
