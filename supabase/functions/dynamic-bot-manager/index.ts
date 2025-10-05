import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface BotStatus {
  bot_name: string;
  is_enabled: boolean;
  accuracy_rate: number;
  total_predictions: number;
  successful_predictions: number;
  failed_predictions: number;
  consecutive_poor_performance: number;
  cooldown_until: string | null;
  status_reason: string;
}

const ENABLE_THRESHOLD = 60;
const ENABLE_MIN_PREDICTIONS = 10;
const DISABLE_THRESHOLD = 35;
const DISABLE_MIN_PREDICTIONS = 20;
const COOLDOWN_DAYS = 7;
const POOR_PERFORMANCE_STREAK = 3;

// Evaluate bot performance and update status
async function evaluateBot(supabase: any, botName: string): Promise<any> {
  // Get current performance metrics
  const { data: predictions } = await supabase
    .from('bot_predictions')
    .select('*')
    .eq('bot_name', botName)
    .order('created_at', { ascending: false })
    .limit(100);

  if (!predictions || predictions.length === 0) {
    return {
      bot_name: botName,
      action: 'no_data',
      reason: 'No prediction data available',
    };
  }

  const completed = predictions.filter(
    p => p.outcome_status === 'success' || p.outcome_status === 'failed'
  );
  const successful = predictions.filter(p => p.outcome_status === 'success').length;
  const failed = predictions.filter(p => p.outcome_status === 'failed').length;
  const total = completed.length;

  if (total === 0) {
    return {
      bot_name: botName,
      action: 'no_completed',
      reason: 'No completed predictions yet',
    };
  }

  const accuracyRate = (successful / total) * 100;

  // Get current bot status
  const { data: currentStatus } = await supabase
    .from('bot_status_management')
    .select('*')
    .eq('bot_name', botName)
    .maybeSingle();

  // Check for admin override
  const { data: activeOverride } = await supabase
    .from('bot_admin_overrides')
    .select('*')
    .eq('bot_name', botName)
    .eq('is_active', true)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .maybeSingle();

  if (activeOverride) {
    return {
      bot_name: botName,
      action: 'override_active',
      override_type: activeOverride.override_type,
      reason: activeOverride.override_reason,
      is_enabled: currentStatus?.is_enabled || false,
    };
  }

  // Check if bot is in cooldown
  if (currentStatus?.cooldown_until) {
    const cooldownDate = new Date(currentStatus.cooldown_until);
    if (cooldownDate > new Date()) {
      return {
        bot_name: botName,
        action: 'in_cooldown',
        cooldown_until: currentStatus.cooldown_until,
        days_remaining: Math.ceil((cooldownDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      };
    }
  }

  let action = 'no_change';
  let reason = 'Performance within normal range';
  let newStatus = currentStatus?.is_enabled !== false;
  let consecutivePoor = currentStatus?.consecutive_poor_performance || 0;

  // Check for enabling criteria
  if (!currentStatus?.is_enabled && total >= ENABLE_MIN_PREDICTIONS && accuracyRate >= ENABLE_THRESHOLD) {
    action = 'enable';
    reason = `High performance: ${accuracyRate.toFixed(1)}% accuracy over ${total} predictions`;
    newStatus = true;
    consecutivePoor = 0;
  }

  // Check for disabling criteria
  if (currentStatus?.is_enabled !== false && total >= DISABLE_MIN_PREDICTIONS && accuracyRate < DISABLE_THRESHOLD) {
    consecutivePoor++;

    if (consecutivePoor >= POOR_PERFORMANCE_STREAK) {
      action = 'disable';
      reason = `Poor performance: ${accuracyRate.toFixed(1)}% accuracy over ${total} predictions`;
      newStatus = false;

      // Set cooldown period
      const cooldownDate = new Date();
      cooldownDate.setDate(cooldownDate.getDate() + COOLDOWN_DAYS);

      await supabase.from('bot_status_management').upsert({
        bot_name: botName,
        is_enabled: false,
        status_reason: reason,
        auto_disabled_at: new Date().toISOString(),
        cooldown_until: cooldownDate.toISOString(),
        accuracy_rate: accuracyRate,
        total_predictions: total,
        successful_predictions: successful,
        failed_predictions: failed,
        consecutive_poor_performance: consecutivePoor,
        last_performance_check: new Date().toISOString(),
        last_status_change: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'bot_name',
      });

      return {
        bot_name: botName,
        action,
        reason,
        is_enabled: false,
        accuracy_rate: accuracyRate,
        cooldown_until: cooldownDate.toISOString(),
        cooldown_days: COOLDOWN_DAYS,
      };
    }
  } else if (accuracyRate >= DISABLE_THRESHOLD) {
    consecutivePoor = 0;
  }

  // Update status
  await supabase.from('bot_status_management').upsert({
    bot_name: botName,
    is_enabled: newStatus,
    status_reason: reason,
    accuracy_rate: accuracyRate,
    total_predictions: total,
    successful_predictions: successful,
    failed_predictions: failed,
    consecutive_poor_performance: consecutivePoor,
    last_performance_check: new Date().toISOString(),
    last_status_change: action !== 'no_change' ? new Date().toISOString() : currentStatus?.last_status_change,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: 'bot_name',
  });

  return {
    bot_name: botName,
    action,
    reason,
    is_enabled: newStatus,
    accuracy_rate: accuracyRate,
    total_predictions: total,
    consecutive_poor_performance: consecutivePoor,
  };
}

// Apply admin override
async function applyOverride(
  supabase: any,
  botName: string,
  overrideType: string,
  reason: string,
  userId: string | null,
  expiresInDays?: number
): Promise<any> {
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  // Create override record
  await supabase.from('bot_admin_overrides').insert({
    bot_name: botName,
    override_type: overrideType,
    override_reason: reason,
    overridden_by: userId,
    expires_at: expiresAt,
    is_active: true,
  });

  // Apply the override
  if (overrideType === 'force_enable') {
    await supabase.from('bot_status_management').upsert({
      bot_name: botName,
      is_enabled: true,
      status_reason: `Admin override: ${reason}`,
      last_status_change: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'bot_name',
    });
  } else if (overrideType === 'force_disable') {
    await supabase.from('bot_status_management').upsert({
      bot_name: botName,
      is_enabled: false,
      status_reason: `Admin override: ${reason}`,
      last_status_change: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'bot_name',
    });
  } else if (overrideType === 'reset_cooldown') {
    await supabase.from('bot_status_management').update({
      cooldown_until: null,
      consecutive_poor_performance: 0,
      status_reason: `Cooldown reset: ${reason}`,
      updated_at: new Date().toISOString(),
    }).eq('bot_name', botName);
  }

  return {
    success: true,
    bot_name: botName,
    override_type: overrideType,
    reason,
    expires_at: expiresAt,
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

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'evaluate';
    const botName = url.searchParams.get('bot');

    // Get bot status
    if (action === 'status') {
      if (botName) {
        const { data } = await supabase
          .from('bot_status_management')
          .select('*')
          .eq('bot_name', botName)
          .maybeSingle();

        return new Response(JSON.stringify({
          success: true,
          status: data,
        }), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      }

      // Get all bot statuses
      const { data } = await supabase
        .from('bot_status_management')
        .select('*')
        .order('bot_name');

      return new Response(JSON.stringify({
        success: true,
        statuses: data || [],
        enabled_count: data?.filter(b => b.is_enabled).length || 0,
        disabled_count: data?.filter(b => !b.is_enabled).length || 0,
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }

    // Evaluate and update bot statuses
    if (action === 'evaluate') {
      const startTime = Date.now();

      if (botName) {
        const result = await evaluateBot(supabase, botName);
        return new Response(JSON.stringify({
          ...result,
          duration_ms: Date.now() - startTime,
        }), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      }

      // Evaluate all bots
      const { data: botList } = await supabase
        .from('bot_predictions')
        .select('bot_name')
        .limit(1000);

      const uniqueBots = [...new Set(botList?.map((b: any) => b.bot_name) || [])];
      const results = [];
      let enabled = 0;
      let disabled = 0;

      for (const bot of uniqueBots) {
        try {
          const result = await evaluateBot(supabase, bot);
          results.push(result);

          if (result.action === 'enable') enabled++;
          if (result.action === 'disable') disabled++;
        } catch (err) {
          console.error(`Failed to evaluate ${bot}:`, err);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        bots_evaluated: uniqueBots.length,
        bots_enabled: enabled,
        bots_disabled: disabled,
        results,
        duration_ms: Date.now() - startTime,
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }

    // Apply admin override
    if (action === 'override' && req.method === 'POST') {
      const body = await req.json();
      const { bot_name, override_type, reason, user_id, expires_in_days } = body;

      if (!bot_name || !override_type || !reason) {
        throw new Error('bot_name, override_type, and reason are required');
      }

      const result = await applyOverride(
        supabase,
        bot_name,
        override_type,
        reason,
        user_id,
        expires_in_days
      );

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }

    // Get active overrides
    if (action === 'overrides') {
      const { data } = await supabase
        .from('bot_admin_overrides')
        .select('*')
        .eq('is_active', true)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order('created_at', { ascending: false });

      return new Response(JSON.stringify({
        success: true,
        overrides: data || [],
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Invalid action',
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Dynamic bot manager error:', error);
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
