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
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!resendApiKey) {
      console.log('RESEND_API_KEY not configured - emails will be logged only');
    }

    const { data: pendingEmails, error: fetchError } = await supabase
      .from('email_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10);

    if (fetchError) throw fetchError;

    let processed = 0;
    let failed = 0;

    for (const email of pendingEmails || []) {
      try {
        await supabase
          .from('email_queue')
          .update({ status: 'processing' })
          .eq('id', email.id);

        if (resendApiKey) {
          const emailPayload = {
            from: 'Crypto Oracle <noreply@cryptooracle.app>',
            to: email.recipient_email,
            subject: email.subject,
            html: email.html_body,
          };

          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify(emailPayload),
          });

          if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Resend API error: ${errorData}`);
          }

          const result = await response.json();

          await supabase
            .from('email_queue')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              metadata: { ...email.metadata, resend_id: result.id },
            })
            .eq('id', email.id);

          processed++;
        } else {
          console.log('Email would be sent:', {
            to: email.recipient_email,
            subject: email.subject,
          });

          await supabase
            .from('email_queue')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              metadata: { ...email.metadata, test_mode: true },
            })
            .eq('id', email.id);

          processed++;
        }
      } catch (emailError) {
        console.error(`Failed to send email ${email.id}:`, emailError);

        await supabase
          .from('email_queue')
          .update({
            status: 'failed',
            error_message: emailError.message,
            retry_count: (email.retry_count || 0) + 1,
          })
          .eq('id', email.id);

        failed++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        failed,
        total: pendingEmails?.length || 0,
        configured: !!resendApiKey,
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
    console.error('Email processor error:', error);
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