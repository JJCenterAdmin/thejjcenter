// Daily site audit — checks jjcenter.org pages, links, images, and key elements
// Emails hello@jjcenter.org only if failures are found
// Run by GitHub Actions daily

import { chromium } from 'playwright';
import { sendEmail } from './send-email-gmail.mjs';

const SITE         = 'https://jjcenter.org';
const REPORT_TO    = 'hello@jjcenter.org';
const SUPABASE_URL = 'https://mkldikwqxninqcmorwsg.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function alreadyAuditedToday() {
  if (!SUPABASE_KEY) return false;
  const today = new Date().toISOString().slice(0, 10);
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/audit_log?select=audit_date&audit_date=eq.${today}&limit=1`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  );
  if (!res.ok) return false;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

async function markAuditedToday() {
  if (!SUPABASE_KEY) return;
  const today = new Date().toISOString().slice(0, 10);
  await fetch(`${SUPABASE_URL}/rest/v1/audit_log`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ audit_date: today }),
  });
}

const PAGES = [
  { name: 'Home',      url: '/',           checks: ['The JJ Center', 'Ward 8', 'Create My Free Account'] },
  { name: 'Auth',      url: '/auth.html',  checks: ['Send My Code', 'email'] },
  { name: 'Privacy',   url: '/privacy.html', checks: ['Privacy'] },
  { name: 'Terms',     url: '/terms.html',   checks: ['Terms'] },
  { name: 'Resources', url: '/resources.html', checks: [] },
];

const API_ENDPOINTS = [
  { name: 'Idealist Listings', url: '/api/idealist-listings', method: 'GET' },
];

async function auditPage(page, pageInfo) {
  const failures = [];
  const url = SITE + pageInfo.url;

  try {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    if (!res || res.status() >= 400) {
      failures.push(`❌ Page returned ${res?.status() || 'no response'}: ${url}`);
      return failures;
    }

    // Check expected text is present
    for (const text of pageInfo.checks) {
      const found = await page.locator(`text=${text}`).count();
      if (found === 0) failures.push(`❌ Missing text "${text}" on ${pageInfo.name}`);
    }

    // Check for broken images (skip inline data: URIs — those are always valid)
    const brokenImages = await page.evaluate(() => {
      return Array.from(document.images)
        .filter(img => !img.src.startsWith('data:') && (!img.complete || img.naturalWidth === 0))
        .map(img => img.src);
    });
    for (const src of brokenImages) {
      failures.push(`❌ Broken image on ${pageInfo.name}: ${src}`);
    }

    // Check for JS console errors
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    if (errors.length > 0) {
      failures.push(`⚠️ JS errors on ${pageInfo.name}: ${errors.join('; ')}`);
    }

  } catch (err) {
    failures.push(`❌ Failed to load ${pageInfo.name} (${url}): ${err.message}`);
  }

  return failures;
}

async function auditApi(endpoint) {
  const failures = [];
  try {
    const res = await fetch(SITE + endpoint.url);
    if (!res.ok) {
      failures.push(`❌ API ${endpoint.name} returned ${res.status}`);
    }
  } catch (err) {
    failures.push(`❌ API ${endpoint.name} unreachable: ${err.message}`);
  }
  return failures;
}

function buildEmailHtml(failures, checkedAt) {
  const rows = failures.map(f =>
    `<tr><td style="padding:10px 14px;font-size:13px;color:#1a1520;border-bottom:1px solid #f0ebf8;">${f}</td></tr>`
  ).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f3ede8;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3ede8;padding:40px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;">
  <tr><td style="background:linear-gradient(135deg,#16082b,#3d1a7a);border-radius:20px 20px 0 0;padding:28px 36px;">
    <div style="font-family:Georgia,serif;font-size:20px;font-weight:700;color:white;">The JJ Center</div>
    <div style="font-size:11px;color:#c4a8f5;letter-spacing:.1em;text-transform:uppercase;margin-top:4px;">Site Audit Alert</div>
  </td></tr>
  <tr><td style="height:4px;background:linear-gradient(90deg,#c8922a,#e8b84b,#c8922a);"></td></tr>
  <tr><td style="background:#ffffff;padding:32px 36px;">
    <p style="font-size:15px;color:#2a1052;font-weight:700;margin:0 0 6px;">⚠️ ${failures.length} issue${failures.length !== 1 ? 's' : ''} detected</p>
    <p style="font-size:13px;color:#6b5f78;margin:0 0 24px;">Checked: ${checkedAt}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e0f5;border-radius:10px;overflow:hidden;">
      ${rows}
    </table>
    <p style="font-size:13px;color:#9a8fa0;margin:24px 0 0;">
      View your site at <a href="${SITE}" style="color:#5a2da8;">${SITE}</a>
    </p>
  </td></tr>
  <tr><td style="background:#16082b;border-radius:0 0 20px 20px;padding:20px 36px;">
    <p style="font-size:11px;color:#3d2a5a;margin:0;text-align:center;">
      Daily audit — The Jehovah Jireh Community Development Center Inc. · Ward 8, Washington, DC
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

async function run() {
  if (await alreadyAuditedToday()) {
    console.log('Audit already ran today — skipping.');
    process.exit(0);
  }

  const checkedAt = new Date().toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short',
  });

  const allFailures = [];

  // Audit pages with Playwright
  const browser = await chromium.launch();
  const context = await browser.newContext();

  for (const pageInfo of PAGES) {
    const page = await context.newPage();
    const failures = await auditPage(page, pageInfo);
    allFailures.push(...failures);
    await page.close();
  }

  await browser.close();

  // Audit API endpoints
  for (const endpoint of API_ENDPOINTS) {
    const failures = await auditApi(endpoint);
    allFailures.push(...failures);
  }

  await markAuditedToday();

  if (allFailures.length === 0) {
    console.log(`✓ All checks passed — ${checkedAt}`);
    process.exit(0);
  }

  console.log(`✗ ${allFailures.length} failure(s) found:`);
  allFailures.forEach(f => console.log(' ', f));

  // Send alert email
  await sendEmail({
    to: REPORT_TO,
    subject: `⚠️ JJ Center Site Alert — ${allFailures.length} issue${allFailures.length !== 1 ? 's' : ''} found`,
    html: buildEmailHtml(allFailures, checkedAt),
    text: `JJ Center Site Audit — ${checkedAt}\n\n${allFailures.join('\n')}`,
  });

  console.log(`Alert sent to ${REPORT_TO}`);
  process.exit(1); // fail the workflow so GitHub also flags it
}

run().catch(err => { console.error(err); process.exit(1); });
