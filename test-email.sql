-- Test Email System
-- Run this in Supabase SQL Editor after configuring RESEND_API_KEY

-- 1. Insert a test email into the queue
INSERT INTO email_queue (
  recipient_email,
  subject,
  html_body,
  email_type,
  status
) VALUES (
  'your-email@example.com', -- CHANGE THIS TO YOUR EMAIL
  'Test Email from Crypto Oracle',
  '<html>
    <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
      <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h1 style="color: #3b82f6; margin-bottom: 20px;">🔮 Crypto Oracle Test</h1>
        <p style="font-size: 16px; color: #333; line-height: 1.6;">
          This is a test email from your Crypto Oracle platform!
        </p>
        <p style="font-size: 14px; color: #666; margin-top: 20px;">
          If you received this email, your email system is working perfectly!
        </p>
        <div style="margin-top: 30px; padding: 20px; background-color: #f0f9ff; border-left: 4px solid #3b82f6; border-radius: 4px;">
          <h3 style="margin: 0 0 10px 0; color: #1e40af;">✅ Email System Status</h3>
          <ul style="margin: 10px 0; padding-left: 20px; color: #333;">
            <li>Resend API: Connected</li>
            <li>Email Queue: Processing</li>
            <li>Delivery: Successful</li>
          </ul>
        </div>
        <p style="font-size: 12px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          Sent by Crypto Oracle Email System
        </p>
      </div>
    </body>
  </html>',
  'test',
  'pending'
);

-- 2. Check that the email was inserted
SELECT
  id,
  recipient_email,
  subject,
  status,
  created_at
FROM email_queue
WHERE email_type = 'test'
ORDER BY created_at DESC
LIMIT 1;

-- 3. Now trigger the email processor
-- Go to Edge Functions → email-processor → Invoke
-- Or run the cron-trigger function

-- 4. After a few seconds, check the status
SELECT
  id,
  recipient_email,
  subject,
  status,
  sent_at,
  error_message
FROM email_queue
WHERE email_type = 'test'
ORDER BY created_at DESC
LIMIT 1;

-- Expected result: status should change from 'pending' to 'sent'
-- If status is 'failed', check error_message column

-- 5. Clean up test email (optional)
-- DELETE FROM email_queue WHERE email_type = 'test';
