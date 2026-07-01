// Vercel serverless function — sends welcome emails to JJ Center waitlist
// POST /api/send-waitlist-welcome
// Protected by ADMIN_SEND_SECRET env var
// Requires: RESEND_API_KEY, SUPABASE_SERVICE_KEY, ADMIN_SEND_SECRET in Vercel env vars

const SITE_URL    = 'https://jjcenter.org';
const FROM_EMAIL  = 'hello@jjcenter.org';
const FROM_NAME   = 'The JJ Center';
const REPLY_TO    = 'hello@jjcenter.org';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };
}

function welcomeEmailHtml({ first_name, email }) {
  const name = first_name ? first_name.trim() : 'Friend';
  const signupUrl = `${SITE_URL}/auth.html`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Your JJ Center Account is Ready</title>
</head>
<body style="margin:0;padding:0;background:#f3ede8;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3ede8;padding:40px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;">

  <!-- HEADER -->
  <tr><td style="background:linear-gradient(135deg,#16082b 0%,#2a1052 50%,#3d1a7a 100%);border-radius:20px 20px 0 0;padding:36px 40px;">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:700;color:white;margin-bottom:4px;">The JJ Center</div>
    <div style="font-size:11px;color:#c4a8f5;letter-spacing:.12em;text-transform:uppercase;">Ward 8 &middot; Washington, DC</div>
  </td></tr>

  <!-- GOLD STRIPE -->
  <tr><td style="height:5px;background:linear-gradient(90deg,#c8922a,#e8b84b,#c8922a);"></td></tr>

  <!-- BODY -->
  <tr><td style="background:#ffffff;padding:40px 40px 32px;">

    <p style="font-size:16px;color:#6b5f78;margin:0 0 24px;">Hi ${name},</p>

    <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:700;color:#2a1052;line-height:1.15;margin:0 0 16px;">
      Your JJ Center account<br>is <em style="color:#c8922a;font-style:italic;">ready to activate.</em>
    </h1>

    <p style="font-size:14px;color:#6b5f78;line-height:1.8;margin:0 0 20px;">
      You signed up to be notified when The JJ Center member portal launched —
      and it's here! Your free account gives you access to:
    </p>

    <!-- PERKS -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f0ebf8;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="width:36px;height:36px;background:linear-gradient(135deg,#3d1a7a,#5a2da8);border-radius:9px;text-align:center;vertical-align:middle;font-size:16px;">📅</td>
            <td style="padding-left:12px;font-size:13px;color:#1a1520;"><strong>Pantry Visit History</strong> — your full check-in record</td>
          </tr></table>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f0ebf8;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="width:36px;height:36px;background:linear-gradient(135deg,#3d1a7a,#5a2da8);border-radius:9px;text-align:center;vertical-align:middle;font-size:16px;">📱</td>
            <td style="padding-left:12px;font-size:13px;color:#1a1520;"><strong>QR Check-In Code</strong> — skip the line, scan at the door</td>
          </tr></table>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f0ebf8;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="width:36px;height:36px;background:linear-gradient(135deg,#3d1a7a,#5a2da8);border-radius:9px;text-align:center;vertical-align:middle;font-size:16px;">📬</td>
            <td style="padding-left:12px;font-size:13px;color:#1a1520;"><strong>Pantry Updates</strong> — hours, special events &amp; announcements</td>
          </tr></table>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 0;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="width:36px;height:36px;background:linear-gradient(135deg,#3d1a7a,#5a2da8);border-radius:9px;text-align:center;vertical-align:middle;font-size:16px;">🤝</td>
            <td style="padding-left:12px;font-size:13px;color:#1a1520;"><strong>Volunteer &amp; Support</strong> — find ways to give back</td>
          </tr></table>
        </td>
      </tr>
    </table>

    <!-- CTA BUTTON -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr><td align="center">
        <a href="${signupUrl}" style="display:inline-block;background:linear-gradient(135deg,#3d1a7a,#5a2da8);color:white;padding:16px 40px;border-radius:100px;font-size:16px;font-weight:700;text-decoration:none;letter-spacing:.01em;box-shadow:0 6px 22px rgba(90,45,168,.3);">
          Create My Free Account &rarr;
        </a>
      </td></tr>
    </table>

    <p style="font-size:13px;color:#a898b8;line-height:1.7;margin:0 0 8px;">
      Or copy this link into your browser:<br>
      <a href="${signupUrl}" style="color:#5a2da8;text-decoration:none;">${signupUrl}</a>
    </p>

    <p style="font-size:13px;color:#6b5f78;line-height:1.7;margin:24px 0 0;">
      It only takes a minute. Any email address works — no Gmail required.<br>
      We can't wait to serve you.
    </p>

    <p style="font-size:14px;color:#2a1052;font-weight:600;margin:20px 0 4px;">With love from Ward 8,</p>
    <p style="font-size:14px;color:#6b5f78;margin:0;">Dr. Roach &amp; The JJ Center Team</p>

  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#16082b;border-radius:0 0 20px 20px;padding:24px 40px;">
    <p style="font-size:12px;color:#6b5f78;margin:0 0 6px;text-align:center;">
      The Jehovah Jireh Community Development Center Inc. &bull; Ward 8, Washington, DC
    </p>
    <p style="font-size:11px;color:#3d2a5a;margin:0;text-align:center;">
      You're receiving this because you joined our waitlist at jjcenter.org.
      Questions? Reply to this email or contact
      <a href="mailto:hello@jjcenter.org" style="color:#c8922a;text-decoration:none;">hello@jjcenter.org</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function welcomeEmailText({ first_name }) {
  const name = first_name ? first_name.trim() : 'Friend';
  return `Hi ${name},

Your JJ Center member account is ready to activate!

You signed up to be notified when The JJ Center member portal launched — and it's here.

Create your free account now:
${SITE_URL}/auth.html

Your account gives you access to:
- Pantry visit history
- QR check-in code — skip the line at the door
- Pantry updates, hours & announcements
- Volunteer & support opportunities

It only takes a minute. Any email address works — no Gmail required.

With love from Ward 8,
Dr. Roach & The JJ Center Team

---
The Jehovah Jireh Community Development Center Inc. · Ward 8, Washington, DC
You're receiving this because you joined our waitlist at jjcenter.org.
Questions? Reply to this email or contact hello@jjcenter.org`;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, corsHeaders());
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  // Validate admin secret
  const secret = req.headers['x-admin-secret'] || req.body?.secret;
  if (!secret || secret !== process.env.ADMIN_SEND_SECRET) {
    res.writeHead(401, corsHeaders());
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  const RESEND_KEY    = process.env.RESEND_API_KEY;
  const SUPABASE_URL  = 'https://mkldikwqxninqcmorwsg.supabase.co';
  const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY;

  if (!RESEND_KEY || !SUPABASE_KEY) {
    res.writeHead(500, corsHeaders());
    res.end(JSON.stringify({ error: 'Missing RESEND_API_KEY or SUPABASE_SERVICE_KEY env vars' }));
    return;
  }

  // Parse body — support both JSON and empty body
  let body = {};
  try { body = req.body || {}; } catch (_) {}
  const testEmail = body.test_email || null;

  try {
    let waitlist;

    if (testEmail) {
      // TEST MODE — send only to the specified address, do not mark welcomed_at
      waitlist = [{ email: testEmail, first_name: 'Victoria', last_name: '' }];
    } else {
      // LIVE MODE — fetch all waitlist entries not yet welcomed
      const sbRes = await fetch(
        `${SUPABASE_URL}/rest/v1/waitlist?select=email,first_name,last_name,welcomed_at&welcomed_at=is.null&order=created_at.asc`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
          }
        }
      );
      if (!sbRes.ok) throw new Error(`Supabase error: ${sbRes.status}`);
      waitlist = await sbRes.json();
    }

    if (!waitlist || waitlist.length === 0) {
      res.writeHead(200, corsHeaders());
      res.end(JSON.stringify({ ok: true, sent: 0, message: 'No unwelcomed waitlist entries found.' }));
      return;
    }

    const results = [];

    for (const person of waitlist) {
      try {
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `${FROM_NAME} <${FROM_EMAIL}>`,
            to: [person.email],
            reply_to: REPLY_TO,
            subject: '🎉 Your JJ Center account is ready — activate now',
            html: welcomeEmailHtml(person),
            text: welcomeEmailText(person),
          }),
        });

        if (emailRes.ok) {
          // Mark as welcomed in Supabase
          await fetch(
            `${SUPABASE_URL}/rest/v1/waitlist?email=eq.${encodeURIComponent(person.email)}`,
            {
              method: 'PATCH',
              headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ welcomed_at: new Date().toISOString() }),
            }
          );
          results.push({ email: person.email, status: 'sent' });
        } else {
          const err = await emailRes.text();
          results.push({ email: person.email, status: 'failed', error: err });
        }
      } catch (err) {
        results.push({ email: person.email, status: 'failed', error: err.message });
      }

      // Small delay between sends to stay within Resend rate limits
      await new Promise(r => setTimeout(r, 100));
    }

    const sent   = results.filter(r => r.status === 'sent').length;
    const failed = results.filter(r => r.status === 'failed').length;

    res.writeHead(200, corsHeaders());
    res.end(JSON.stringify({ ok: true, sent, failed, total: waitlist.length, results }));

  } catch (err) {
    res.writeHead(500, corsHeaders());
    res.end(JSON.stringify({ ok: false, error: err.message }));
  }
}
