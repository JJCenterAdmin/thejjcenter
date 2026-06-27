// ═══════════════════════════════════════════════════════════════
// JJ CENTER — UNSUBSCRIBE NOTIFICATION EDGE FUNCTION
// Sends an alert email to hello@jjcenter.org whenever
// someone unsubscribes — gives your team a paper trail
// for manual audit verification
//
// HOW TO DEPLOY:
// 1. Install Supabase CLI: npm install -g supabase
// 2. Login: supabase login
// 3. Link project: supabase link --project-ref mkldikwqxninqcmorwsg
// 4. Create function: supabase functions new notify-unsubscribe
// 5. Replace the index.ts content with this file
// 6. Deploy: supabase functions deploy notify-unsubscribe
// 7. Set secret: supabase secrets set RESEND_API_KEY=your_resend_api_key
// ═══════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY  = Deno.env.get('RESEND_API_KEY')!;
const NOTIFY_EMAIL    = 'hello@jjcenter.org';
const FROM_EMAIL      = 'hello@jjcenter.org';
const FROM_NAME       = 'The JJ Center System';

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    });
  }

  try {
    const { email, requested_at, source } = await req.json();

    // Format the date nicely
    const dt = new Date(requested_at);
    const formatted = dt.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    // Send notification email via Resend
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [NOTIFY_EMAIL],
        subject: `[Action Required] Unsubscribe Request — ${email}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head><meta charset="UTF-8"></head>
          <body style="font-family:Arial,sans-serif;background:#f3ede8;padding:40px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;">
            <tr><td style="background:linear-gradient(135deg,#2a1052,#3d1a7a);padding:28px 32px;">
              <div style="font-size:20px;font-weight:700;color:white;font-family:Georgia,serif;">The JJ Center</div>
              <div style="font-size:11px;color:#c4a8f5;letter-spacing:.1em;text-transform:uppercase;margin-top:4px;">System Notification</div>
            </td></tr>
            <tr><td style="height:4px;background:linear-gradient(90deg,#c8922a,#e8b84b);"></td></tr>
            <tr><td style="padding:32px;">
              <h2 style="color:#2a1052;font-size:20px;margin:0 0 16px;">⚠️ Unsubscribe Request Received</h2>
              <p style="color:#6b5f78;font-size:14px;line-height:1.7;margin:0 0 20px;">
                Someone has requested to be removed from JJ Center email communications.
                Please verify this was processed correctly in Supabase.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ecff;border-radius:12px;padding:20px;margin-bottom:20px;">
                <tr><td>
                  <div style="font-size:12px;font-weight:700;color:#3d1a7a;letter-spacing:.08em;text-transform:uppercase;margin-bottom:12px;">Request Details</div>
                  <table width="100%" cellpadding="4" cellspacing="0">
                    <tr>
                      <td style="font-size:13px;color:#6b5f78;width:140px;"><strong>Email:</strong></td>
                      <td style="font-size:13px;color:#2a1052;font-weight:600;">${email}</td>
                    </tr>
                    <tr>
                      <td style="font-size:13px;color:#6b5f78;"><strong>Requested at:</strong></td>
                      <td style="font-size:13px;color:#2a1052;">${formatted}</td>
                    </tr>
                    <tr>
                      <td style="font-size:13px;color:#6b5f78;"><strong>Source:</strong></td>
                      <td style="font-size:13px;color:#2a1052;">${source || 'Privacy page'}</td>
                    </tr>
                  </table>
                </td></tr>
              </table>

              <div style="background:#fff8e6;border:1px solid #e8b84b;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
                <div style="font-size:13px;font-weight:700;color:#7a5800;margin-bottom:8px;">✅ Audit Checklist</div>
                <div style="font-size:13px;color:#7a5800;line-height:1.8;">
                  □ Confirm <strong>${email}</strong> shows pantry_optin = false in Supabase<br>
                  □ Confirm entry exists in unsubscribe_log table<br>
                  □ Confirm they will not receive future marketing emails<br>
                  □ Log this audit check with today's date
                </div>
              </div>

              <a href="https://supabase.com/dashboard/project/mkldikwqxninqcmorwsg/editor" 
                 style="display:inline-block;background:linear-gradient(135deg,#3d1a7a,#5a2da8);color:white;padding:12px 24px;border-radius:100px;text-decoration:none;font-size:13px;font-weight:600;">
                Verify in Supabase →
              </a>

              <p style="font-size:12px;color:#a898b8;margin-top:20px;line-height:1.6;">
                CAN-SPAM requires unsubscribe requests be honored within 10 business days.<br>
                This request was automatically processed. Please verify and log your audit confirmation.
              </p>
            </td></tr>
            <tr><td style="background:#16082b;padding:20px 32px;text-align:center;">
              <p style="font-size:12px;color:#6b5f78;margin:0;">The Jehovah Jireh Community Development Center Inc. &bull; Internal System Alert</p>
              <p style="font-size:11px;color:#3d1a7a;margin:6px 0 0;">This email is for internal operations use only &bull; hello@jjcenter.org</p>
            </td></tr>
          </table>
          </body>
          </html>
        `
      })
    });

    if (!emailRes.ok) {
      const err = await emailRes.text();
      throw new Error(`Resend error: ${err}`);
    }

    // Update unsubscribe_log to mark team as notified
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    await sb.from('unsubscribe_log')
      .update({ notified_team: true })
      .eq('email', email)
      .order('requested_at', { ascending: false })
      .limit(1);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (err) {
    console.error('notify-unsubscribe error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
});
