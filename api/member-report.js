// Vercel serverless function — weekly member report
// Triggered by Vercel Cron every Friday at 8 am EST (13:00 UTC)
// Also callable manually: POST /api/member-report with x-admin-secret header
// Requires: RESEND_API_KEY, SUPABASE_SERVICE_KEY env vars

const SITE_URL     = 'https://jjcenter.org';
const FROM_EMAIL   = 'hello@jjcenter.org';
const FROM_NAME    = 'The JJ Center';
const REPORT_TO    = 'hello@jjcenter.org';
const SUPABASE_URL = 'https://mkldikwqxninqcmorwsg.supabase.co';

const USER_TYPE_LABELS = {
  food_assistance: 'Food Assistance',
  volunteer:       'Volunteer',
  partner:         'Partner',
  coalition:       'Coalition',
  donate:          'Donate',
  informed:        'Stay Informed',
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-secret',
    'Content-Type': 'application/json',
  };
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    timeZone: 'America/New_York',
  });
}

function formatTypes(arr) {
  if (!arr || arr.length === 0) return '—';
  return arr.map(t => USER_TYPE_LABELS[t] || t).join(', ');
}

// ── CSV builder ──────────────────────────────────────────────────────────────
function buildCsv(members) {
  const headers = [
    'First Name', 'Last Name', 'Email', 'Phone',
    'Zip Code', 'Household Size', 'Connection Types', 'Signed Up',
  ];
  const escape = v => {
    if (v == null) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = members.map(m => [
    escape(m.first_name),
    escape(m.last_name),
    escape(m.email),
    escape(m.phone),
    escape(m.zip_code),
    escape(m.household_size),
    escape(formatTypes(m.user_types)),
    escape(formatDate(m.created_at)),
  ].join(','));
  return [headers.join(','), ...rows].join('\r\n');
}

// ── HTML email builder ───────────────────────────────────────────────────────
function buildHtml(members, generatedAt) {
  const total = members.length;
  const typeCount = {};
  members.forEach(m => {
    (m.user_types || []).forEach(t => {
      typeCount[t] = (typeCount[t] || 0) + 1;
    });
  });

  const summaryRows = Object.entries(USER_TYPE_LABELS).map(([key, label]) => `
    <tr>
      <td style="padding:6px 12px;font-size:13px;color:#1a1520;">${label}</td>
      <td style="padding:6px 12px;font-size:13px;color:#2a1052;font-weight:700;text-align:right;font-variant-numeric:tabular-nums;">${typeCount[key] || 0}</td>
    </tr>`).join('');

  const memberRows = members.map((m, i) => `
    <tr style="background:${i % 2 === 0 ? '#ffffff' : '#faf8ff'};">
      <td style="padding:8px 10px;font-size:12px;color:#1a1520;white-space:nowrap;">${m.first_name || ''} ${m.last_name || ''}</td>
      <td style="padding:8px 10px;font-size:12px;color:#3d1a7a;">${m.email || '—'}</td>
      <td style="padding:8px 10px;font-size:12px;color:#6b5f78;white-space:nowrap;">${m.phone || '—'}</td>
      <td style="padding:8px 10px;font-size:12px;color:#6b5f78;">${m.zip_code || '—'}</td>
      <td style="padding:8px 10px;font-size:12px;color:#6b5f78;text-align:center;">${m.household_size || '—'}</td>
      <td style="padding:8px 10px;font-size:12px;color:#6b5f78;">${formatTypes(m.user_types)}</td>
      <td style="padding:8px 10px;font-size:12px;color:#6b5f78;white-space:nowrap;">${formatDate(m.created_at)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Weekly Member Report — The JJ Center</title>
</head>
<body style="margin:0;padding:0;background:#f3ede8;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3ede8;padding:40px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:720px;margin:0 auto;">

  <!-- HEADER -->
  <tr><td style="background:linear-gradient(135deg,#16082b 0%,#2a1052 50%,#3d1a7a 100%);border-radius:20px 20px 0 0;padding:32px 40px;">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:white;margin-bottom:4px;">The JJ Center</div>
    <div style="font-size:11px;color:#c4a8f5;letter-spacing:.12em;text-transform:uppercase;">Ward 8 &middot; Washington, DC</div>
    <div style="margin-top:16px;font-size:18px;font-weight:700;color:white;">Weekly Member Report</div>
    <div style="font-size:12px;color:#c4a8f5;margin-top:4px;">Generated ${generatedAt}</div>
  </td></tr>

  <!-- GOLD STRIPE -->
  <tr><td style="height:5px;background:linear-gradient(90deg,#c8922a,#e8b84b,#c8922a);"></td></tr>

  <!-- SUMMARY STATS -->
  <tr><td style="background:#ffffff;padding:32px 40px 24px;">

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        <td style="background:linear-gradient(135deg,#3d1a7a,#5a2da8);border-radius:16px;padding:24px;text-align:center;width:50%;">
          <div style="font-size:42px;font-weight:700;color:white;font-variant-numeric:tabular-nums;">${total}</div>
          <div style="font-size:12px;color:#c4a8f5;text-transform:uppercase;letter-spacing:.1em;margin-top:4px;">Total Members</div>
        </td>
        <td style="width:16px;"></td>
        <td style="background:#faf8ff;border:1px solid #e8e0f5;border-radius:16px;padding:16px 20px;vertical-align:top;">
          <div style="font-size:11px;color:#9a8fa0;text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px;">By Connection Type</div>
          <table width="100%" cellpadding="0" cellspacing="0">
            ${summaryRows}
          </table>
        </td>
      </tr>
    </table>

    <p style="font-size:13px;color:#9a8fa0;margin:0 0 20px;">
      Full member list below. A CSV file is attached for import into Google Sheets or Excel.
    </p>

    <!-- MEMBER TABLE -->
    <div style="overflow-x:auto;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;min-width:580px;">
      <thead>
        <tr style="background:#16082b;">
          <th style="padding:10px 10px;font-size:11px;color:#c4a8f5;text-align:left;font-weight:600;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;">Name</th>
          <th style="padding:10px 10px;font-size:11px;color:#c4a8f5;text-align:left;font-weight:600;letter-spacing:.06em;text-transform:uppercase;">Email</th>
          <th style="padding:10px 10px;font-size:11px;color:#c4a8f5;text-align:left;font-weight:600;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;">Phone</th>
          <th style="padding:10px 10px;font-size:11px;color:#c4a8f5;text-align:left;font-weight:600;letter-spacing:.06em;text-transform:uppercase;">Zip</th>
          <th style="padding:10px 10px;font-size:11px;color:#c4a8f5;text-align:center;font-weight:600;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;">HH Size</th>
          <th style="padding:10px 10px;font-size:11px;color:#c4a8f5;text-align:left;font-weight:600;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;">Connection Types</th>
          <th style="padding:10px 10px;font-size:11px;color:#c4a8f5;text-align:left;font-weight:600;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;">Signed Up</th>
        </tr>
      </thead>
      <tbody>
        ${memberRows || '<tr><td colspan="7" style="padding:20px;text-align:center;color:#9a8fa0;font-size:13px;">No members yet.</td></tr>'}
      </tbody>
    </table>
    </div>

  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#16082b;border-radius:0 0 20px 20px;padding:24px 40px;">
    <p style="font-size:12px;color:#6b5f78;margin:0 0 4px;text-align:center;">
      The Jehovah Jireh Community Development Center Inc. &bull; Ward 8, Washington, DC
    </p>
    <p style="font-size:11px;color:#3d2a5a;margin:0;text-align:center;">
      This report is sent weekly to <a href="mailto:hello@jjcenter.org" style="color:#c8922a;text-decoration:none;">hello@jjcenter.org</a>.
      View your member portal at <a href="${SITE_URL}" style="color:#c8922a;text-decoration:none;">jjcenter.org</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  // Allow GET for cron (Vercel calls cron endpoints with GET)
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.writeHead(405, corsHeaders());
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  // Protect manual POST calls; cron calls bypass via Authorization header set in vercel.json
  if (req.method === 'POST') {
    const secret = req.headers['x-admin-secret'] || req.body?.secret;
    if (!secret || secret !== process.env.ADMIN_SEND_SECRET) {
      res.writeHead(401, corsHeaders());
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
  }

  const RESEND_KEY   = process.env.RESEND_API_KEY;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!RESEND_KEY || !SUPABASE_KEY) {
    res.writeHead(500, corsHeaders());
    res.end(JSON.stringify({ error: 'Missing RESEND_API_KEY or SUPABASE_SERVICE_KEY' }));
    return;
  }

  try {
    // Fetch all members, all fields, ordered by signup date
    const sbRes = await fetch(
      `${SUPABASE_URL}/rest/v1/members?select=first_name,last_name,email,phone,zip_code,household_size,user_types,created_at&order=created_at.desc`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!sbRes.ok) throw new Error(`Supabase error: ${sbRes.status}`);
    const members = await sbRes.json();

    const generatedAt = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
      timeZoneName: 'short',
    });

    const csvContent  = buildCsv(members);
    const htmlContent = buildHtml(members, generatedAt);

    // Encode CSV as base64 for Resend attachment
    const csvBase64 = Buffer.from(csvContent, 'utf-8').toString('base64');
    const dateStamp = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).replace(/\//g, '-');

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to:   [REPORT_TO],
        subject: `📋 JJ Center Member Report — ${generatedAt}`,
        html: htmlContent,
        text: `JJ Center Member Report\nGenerated: ${generatedAt}\nTotal Members: ${members.length}\n\nSee attached CSV for full member list.`,
        attachments: [
          {
            filename: `jjcenter-members-${dateStamp}.csv`,
            content:  csvBase64,
          },
        ],
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.text();
      throw new Error(`Resend error: ${err}`);
    }

    res.writeHead(200, corsHeaders());
    res.end(JSON.stringify({
      ok: true,
      members: members.length,
      sentTo: REPORT_TO,
      generatedAt,
    }));

  } catch (err) {
    res.writeHead(500, corsHeaders());
    res.end(JSON.stringify({ ok: false, error: err.message }));
  }
}
