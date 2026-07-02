// Standalone script — run by GitHub Actions every Friday
// Uses GMAIL_USER, GMAIL_APP_PASSWORD, and SUPABASE_SERVICE_KEY from GitHub secrets

import { sendEmail } from './send-email-gmail.mjs';

const SITE_URL     = 'https://jjcenter.org';
const REPORT_TO    = 'hello@jjcenter.org';
const SUPABASE_URL = 'https://mkldikwqxninqcmorwsg.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const USER_TYPE_LABELS = {
  food_assistance: 'Food Assistance',
  volunteer:       'Volunteer',
  partner:         'Partner',
  coalition:       'Coalition',
  donate:          'Donate',
  informed:        'Stay Informed',
};

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

function buildCsv(members) {
  const headers = ['First Name','Last Name','Email','Phone','Zip Code','Household Size','Connection Types','Signed Up'];
  const escape = v => {
    if (v == null) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g,'""')}"` : s;
  };
  const rows = members.map(m => [
    escape(m.first_name), escape(m.last_name), escape(m.email), escape(m.phone),
    escape(m.zip_code), escape(m.household_size), escape(formatTypes(m.user_types)), escape(formatDate(m.created_at)),
  ].join(','));
  return [headers.join(','), ...rows].join('\r\n');
}

function buildHtml(members, generatedAt) {
  const total = members.length;
  const typeCount = {};
  members.forEach(m => (m.user_types || []).forEach(t => { typeCount[t] = (typeCount[t] || 0) + 1; }));

  const summaryRows = Object.entries(USER_TYPE_LABELS).map(([key, label]) =>
    `<tr><td style="padding:6px 12px;font-size:13px;color:#1a1520;">${label}</td><td style="padding:6px 12px;font-size:13px;color:#2a1052;font-weight:700;text-align:right;">${typeCount[key] || 0}</td></tr>`
  ).join('');

  const memberRows = members.map((m, i) =>
    `<tr style="background:${i % 2 === 0 ? '#ffffff' : '#faf8ff'};">
      <td style="padding:8px 10px;font-size:12px;color:#1a1520;">${m.first_name || ''} ${m.last_name || ''}</td>
      <td style="padding:8px 10px;font-size:12px;color:#3d1a7a;">${m.email || '—'}</td>
      <td style="padding:8px 10px;font-size:12px;color:#6b5f78;">${m.phone || '—'}</td>
      <td style="padding:8px 10px;font-size:12px;color:#6b5f78;">${m.zip_code || '—'}</td>
      <td style="padding:8px 10px;font-size:12px;color:#6b5f78;text-align:center;">${m.household_size || '—'}</td>
      <td style="padding:8px 10px;font-size:12px;color:#6b5f78;">${formatTypes(m.user_types)}</td>
      <td style="padding:8px 10px;font-size:12px;color:#6b5f78;">${formatDate(m.created_at)}</td>
    </tr>`
  ).join('');

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Weekly Member Report</title></head>
<body style="margin:0;padding:0;background:#f3ede8;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3ede8;padding:40px 16px;">
<tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:720px;margin:0 auto;">
  <tr><td style="background:linear-gradient(135deg,#16082b 0%,#2a1052 50%,#3d1a7a 100%);border-radius:20px 20px 0 0;padding:32px 40px;">
    <div style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:white;margin-bottom:4px;">The JJ Center</div>
    <div style="font-size:11px;color:#c4a8f5;letter-spacing:.12em;text-transform:uppercase;">Ward 8 &middot; Washington, DC</div>
    <div style="margin-top:16px;font-size:18px;font-weight:700;color:white;">Weekly Member Report</div>
    <div style="font-size:12px;color:#c4a8f5;margin-top:4px;">Generated ${generatedAt}</div>
  </td></tr>
  <tr><td style="height:5px;background:linear-gradient(90deg,#c8922a,#e8b84b,#c8922a);"></td></tr>
  <tr><td style="background:#ffffff;padding:32px 40px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        <td style="background:linear-gradient(135deg,#3d1a7a,#5a2da8);border-radius:16px;padding:24px;text-align:center;width:50%;">
          <div style="font-size:42px;font-weight:700;color:white;">${total}</div>
          <div style="font-size:12px;color:#c4a8f5;text-transform:uppercase;letter-spacing:.1em;margin-top:4px;">Total Members</div>
        </td>
        <td style="width:16px;"></td>
        <td style="background:#faf8ff;border:1px solid #e8e0f5;border-radius:16px;padding:16px 20px;vertical-align:top;">
          <div style="font-size:11px;color:#9a8fa0;text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px;">By Connection Type</div>
          <table width="100%" cellpadding="0" cellspacing="0">${summaryRows}</table>
        </td>
      </tr>
    </table>
    <p style="font-size:13px;color:#9a8fa0;margin:0 0 20px;">Full member list below. A CSV file is attached for import into Google Sheets or Excel.</p>
    <div style="overflow-x:auto;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;min-width:580px;">
      <thead><tr style="background:#16082b;">
        <th style="padding:10px;font-size:11px;color:#c4a8f5;text-align:left;letter-spacing:.06em;text-transform:uppercase;">Name</th>
        <th style="padding:10px;font-size:11px;color:#c4a8f5;text-align:left;letter-spacing:.06em;text-transform:uppercase;">Email</th>
        <th style="padding:10px;font-size:11px;color:#c4a8f5;text-align:left;letter-spacing:.06em;text-transform:uppercase;">Phone</th>
        <th style="padding:10px;font-size:11px;color:#c4a8f5;text-align:left;letter-spacing:.06em;text-transform:uppercase;">Zip</th>
        <th style="padding:10px;font-size:11px;color:#c4a8f5;text-align:center;letter-spacing:.06em;text-transform:uppercase;">HH</th>
        <th style="padding:10px;font-size:11px;color:#c4a8f5;text-align:left;letter-spacing:.06em;text-transform:uppercase;">Connection Types</th>
        <th style="padding:10px;font-size:11px;color:#c4a8f5;text-align:left;letter-spacing:.06em;text-transform:uppercase;">Signed Up</th>
      </tr></thead>
      <tbody>${memberRows || '<tr><td colspan="7" style="padding:20px;text-align:center;color:#9a8fa0;font-size:13px;">No members yet.</td></tr>'}</tbody>
    </table></div>
  </td></tr>
  <tr><td style="background:#16082b;border-radius:0 0 20px 20px;padding:24px 40px;">
    <p style="font-size:12px;color:#6b5f78;margin:0;text-align:center;">The Jehovah Jireh Community Development Center Inc. &bull; Ward 8, Washington, DC</p>
    <p style="font-size:11px;color:#3d2a5a;margin:4px 0 0;text-align:center;">
      This report is sent weekly to <a href="mailto:hello@jjcenter.org" style="color:#c8922a;text-decoration:none;">hello@jjcenter.org</a>
    </p>
  </td></tr>
</table></td></tr></table>
</body></html>`;
}

async function alreadySentToday() {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD in UTC
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/report_log?select=sent_date&sent_date=eq.${today}&limit=1`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  );
  if (!res.ok) return false; // if table doesn't exist yet, proceed
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

async function markSentToday() {
  const today = new Date().toISOString().slice(0, 10);
  await fetch(
    `${SUPABASE_URL}/rest/v1/report_log`,
    {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ sent_date: today }),
    }
  );
}

async function run() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD || !SUPABASE_KEY) {
    console.error('Missing GMAIL_USER, GMAIL_APP_PASSWORD, or SUPABASE_SERVICE_KEY');
    process.exit(1);
  }

  // Skip if report already sent today (handles multiple Friday cron attempts)
  if (await alreadySentToday()) {
    console.log('Report already sent today — skipping.');
    process.exit(0);
  }

  const sbRes = await fetch(
    `${SUPABASE_URL}/rest/v1/members?select=first_name,last_name,email,phone,zip_code,household_size,user_types,created_at&order=created_at.desc`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' } }
  );
  if (!sbRes.ok) {
    const errText = await sbRes.text();
    throw new Error(`Supabase error: ${sbRes.status} — ${errText}`);
  }
  const members = await sbRes.json();
  console.log(`Supabase returned ${members.length} members:`, JSON.stringify(members.map(m => m.email)));

  const generatedAt = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short',
  });

  const csvContent = buildCsv(members);
  const htmlContent = buildHtml(members, generatedAt);
  const dateStamp = new Date().toISOString().slice(0, 10);

  await sendEmail({
    to: REPORT_TO,
    subject: `📋 JJ Center Member Report — ${generatedAt}`,
    html: htmlContent,
    text: `JJ Center Member Report\nGenerated: ${generatedAt}\nTotal Members: ${members.length}\n\nSee attached CSV for full member list.`,
    attachments: [{
      filename: `jjcenter-members-${dateStamp}.csv`,
      content: Buffer.from(csvContent, 'utf-8'),
    }],
  });

  await markSentToday();
  console.log(`✓ Report sent — ${members.length} members — ${generatedAt}`);
}

run().catch(err => { console.error(err); process.exit(1); });
