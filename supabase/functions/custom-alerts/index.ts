import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CustomAlert {
  id?: string;
  user_id: string;
  alert_type: 'PRICE' | 'SIGNAL' | 'BOT' | 'REGIME';
  coin_symbol?: string;
  bot_name?: string;
  condition: Record<string, any>;
  notification_method: 'EMAIL' | 'BROWSER' | 'BOTH';
  is_active: boolean;
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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'list';

    switch (action) {
      case 'list':
        return await listAlerts(supabase, user.id);

      case 'create':
        const createData = await req.json();
        return await createAlert(supabase, user.id, createData);

      case 'update':
        const updateData = await req.json();
        return await updateAlert(supabase, user.id, updateData);

      case 'delete':
        const alertId = url.searchParams.get('alertId');
        if (!alertId) throw new Error('Alert ID required');
        return await deleteAlert(supabase, user.id, alertId);

      case 'check':
        return await checkAlerts(supabase);

      default:
        throw new Error('Invalid action');
    }
  } catch (error) {
    console.error('Custom alerts error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function listAlerts(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('user_alerts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return new Response(
    JSON.stringify({ alerts: data }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function createAlert(supabase: any, userId: string, alertData: Partial<CustomAlert>) {
  const alert: CustomAlert = {
    user_id: userId,
    alert_type: alertData.alert_type!,
    coin_symbol: alertData.coin_symbol,
    bot_name: alertData.bot_name,
    condition: alertData.condition!,
    notification_method: alertData.notification_method || 'EMAIL',
    is_active: true,
  };

  const { data, error } = await supabase
    .from('user_alerts')
    .insert(alert)
    .select()
    .single();

  if (error) throw error;

  return new Response(
    JSON.stringify({ alert: data }),
    {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function updateAlert(supabase: any, userId: string, alertData: Partial<CustomAlert>) {
  if (!alertData.id) throw new Error('Alert ID required');

  const { data, error } = await supabase
    .from('user_alerts')
    .update({
      alert_type: alertData.alert_type,
      coin_symbol: alertData.coin_symbol,
      bot_name: alertData.bot_name,
      condition: alertData.condition,
      notification_method: alertData.notification_method,
      is_active: alertData.is_active,
    })
    .eq('id', alertData.id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;

  return new Response(
    JSON.stringify({ alert: data }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function deleteAlert(supabase: any, userId: string, alertId: string) {
  const { error } = await supabase
    .from('user_alerts')
    .delete()
    .eq('id', alertId)
    .eq('user_id', userId);

  if (error) throw error;

  return new Response(
    JSON.stringify({ success: true }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function checkAlerts(supabase: any) {
  const { data: alerts, error } = await supabase
    .from('user_alerts')
    .select('*')
    .eq('is_active', true);

  if (error) throw error;

  const { data: latestRecommendations } = await supabase
    .from('recommendations')
    .select('*')
    .gte('created_at', new Date(Date.now() - 3600000).toISOString())
    .order('created_at', { ascending: false });

  const triggeredAlerts = [];

  for (const alert of alerts) {
    let triggered = false;
    let triggerData: any = {};

    switch (alert.alert_type) {
      case 'PRICE':
        triggered = await checkPriceAlert(alert, supabase);
        if (triggered) {
          triggerData = { type: 'price', alert };
        }
        break;

      case 'SIGNAL':
        triggered = checkSignalAlert(alert, latestRecommendations);
        if (triggered) {
          const matchingRec = latestRecommendations.find(
            (r: any) => r.coin_symbol === alert.coin_symbol &&
                       r.bot_confidence >= alert.condition.min_confidence
          );
          triggerData = { type: 'signal', alert, recommendation: matchingRec };
        }
        break;

      case 'BOT':
        triggered = checkBotAlert(alert, latestRecommendations);
        if (triggered) {
          const matchingRec = latestRecommendations.find(
            (r: any) => r.bot_predictions?.some((bp: any) => bp.botName === alert.bot_name)
          );
          triggerData = { type: 'bot', alert, recommendation: matchingRec };
        }
        break;

      case 'REGIME':
        triggered = checkRegimeAlert(alert, latestRecommendations);
        if (triggered) {
          const matchingRec = latestRecommendations.find(
            (r: any) => r.coin_symbol === alert.coin_symbol && r.regime === alert.condition.regime
          );
          triggerData = { type: 'regime', alert, recommendation: matchingRec };
        }
        break;
    }

    if (triggered) {
      triggeredAlerts.push(triggerData);
      await sendNotification(supabase, alert, triggerData);
    }
  }

  return new Response(
    JSON.stringify({ checked: alerts.length, triggered: triggeredAlerts.length }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function checkPriceAlert(alert: CustomAlert, supabase: any): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${alert.coin_symbol?.toLowerCase()}&vs_currencies=usd`
    );
    const data = await response.json();
    const price = data[alert.coin_symbol?.toLowerCase()]?.usd;

    if (!price) return false;

    const { target_price, direction } = alert.condition;

    if (direction === 'ABOVE' && price >= target_price) {
      return true;
    } else if (direction === 'BELOW' && price <= target_price) {
      return true;
    }

    return false;
  } catch (error) {
    console.error('Price check error:', error);
    return false;
  }
}

function checkSignalAlert(alert: CustomAlert, recommendations: any[]): boolean {
  return recommendations.some(
    (rec: any) =>
      rec.coin_symbol === alert.coin_symbol &&
      rec.bot_confidence >= (alert.condition.min_confidence || 0.85) &&
      rec.consensus === (alert.condition.direction || rec.consensus)
  );
}

function checkBotAlert(alert: CustomAlert, recommendations: any[]): boolean {
  return recommendations.some(
    (rec: any) =>
      rec.coin_symbol === alert.coin_symbol &&
      rec.bot_predictions?.some((bp: any) => bp.botName === alert.bot_name)
  );
}

function checkRegimeAlert(alert: CustomAlert, recommendations: any[]): boolean {
  return recommendations.some(
    (rec: any) =>
      rec.coin_symbol === alert.coin_symbol &&
      rec.regime === alert.condition.regime
  );
}

async function sendNotification(supabase: any, alert: CustomAlert, triggerData: any) {
  const { data: user } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', alert.user_id)
    .single();

  if (!user?.email) return;

  let title = '';
  let message = '';

  switch (alert.alert_type) {
    case 'PRICE':
      title = `Price Alert: ${alert.coin_symbol}`;
      message = `${alert.coin_symbol} has ${alert.condition.direction === 'ABOVE' ? 'risen above' : 'fallen below'} $${alert.condition.target_price}`;
      break;
    case 'SIGNAL':
      title = `High Confidence Signal: ${alert.coin_symbol}`;
      message = `${alert.coin_symbol} received a ${triggerData.recommendation?.consensus} signal with ${(triggerData.recommendation?.bot_confidence * 100).toFixed(0)}% confidence`;
      break;
    case 'BOT':
      title = `Bot Alert: ${alert.bot_name}`;
      message = `${alert.bot_name} detected a signal for ${alert.coin_symbol}`;
      break;
    case 'REGIME':
      title = `Regime Change: ${alert.coin_symbol}`;
      message = `${alert.coin_symbol} entered ${alert.condition.regime} regime`;
      break;
  }

  if (alert.notification_method === 'EMAIL' || alert.notification_method === 'BOTH') {
    await supabase.functions.invoke('email-alerts', {
      body: {
        action: 'send_custom',
        email: user.email,
        subject: title,
        message: message,
      },
    });
  }

  if (alert.notification_method === 'BROWSER' || alert.notification_method === 'BOTH') {
    await supabase
      .from('user_notifications')
      .insert({
        user_id: alert.user_id,
        type: 'ALERT',
        title: title,
        message: message,
        data: triggerData,
        is_read: false,
      });
  }
}
