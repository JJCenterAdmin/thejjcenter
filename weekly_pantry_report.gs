// ═══════════════════════════════════════════════════════════════
// JJ CENTER — WEEKLY PANTRY REPORT
// Sends every Monday at 9am EST to hello@jjcenter.org
// Covers the previous week's pantry visit data
//
// SETUP (one time):
// 1. script.google.com → New Project → name it "JJ Center Weekly Report"
// 2. Paste this entire file
// 3. Fill in CONFIG below
// 4. Run setupReportTrigger() once manually
// 5. Done — runs automatically every Monday at 9am EST
// ═══════════════════════════════════════════════════════════════

const REPORT_CONFIG = {
  SUPABASE_URL:  'https://mkldikwqxninqcmorwsg.supabase.co',
  SUPABASE_KEY:  'YOUR_SUPABASE_SERVICE_ROLE_KEY',  // Supabase → Settings → API → service_role
  TO_EMAIL:      'hello@jjcenter.org',
  FROM_NAME:     'The JJ Center System',
};

// ═══════════════════════════════════════════════════════════════
// MAIN — SEND WEEKLY REPORT
// ═══════════════════════════════════════════════════════════════
function sendWeeklyPantryReport() {
  // Calculate last week's date range (Monday to Sunday)
  const now       = new Date();
  const lastMon   = new Date(now);
  lastMon.setDate(now.getDate() - 7);
  lastMon.setHours(0, 0, 0, 0);
  const lastSun   = new Date(lastMon);
  lastSun.setDate(lastMon.getDate() + 6);
  lastSun.setHours(23, 59, 59, 999);

  const weekLabel = formatDate(lastMon) + ' – ' + formatDate(lastSun);
  const weekOf    = formatDate(lastMon);

  console.log('Fetching report data for week of ' + weekLabel);

  // Fetch visits from Supabase
  const visitsData    = fetchVisits(lastMon.toISOString(), lastSun.toISOString());
  const membersData   = fetchTotalMembers();
  const inviteData    = fetchPendingInvites(lastMon.toISOString());

  if (!visitsData) {
    console.error('Failed to fetch visits data');
    return;
  }

  // Calculate stats
  const totalVisits   = visitsData.length;
  const memberVisits  = visitsData.filter(v => v.member_id).length;
  const walkInVisits  = visitsData.filter(v => !v.member_id).length;
  const uniqueZips    = [...new Set(visitsData.filter(v => v.visitor_zip).map(v => v.visitor_zip))];
  const totalMembers  = membersData || 0;
  const pendingInvites = inviteData || 0;

  // Build daily breakdown
  const dailyBreakdown = buildDailyBreakdown(visitsData, lastMon);

  // Build household stats
  const householdMap = {};
  visitsData.filter(v => v.household_size).forEach(v => {
    householdMap[v.household_size] = (householdMap[v.household_size] || 0) + 1;
  });
  const totalPeopleServed = estimatePeopleServed(visitsData);

  // Build the email HTML
  const html = buildReportEmail(
    weekOf, weekLabel, totalVisits, memberVisits, walkInVisits,
    totalMembers, pendingInvites, uniqueZips, dailyBreakdown,
    householdMap, totalPeopleServed
  );

  // Send the email
  GmailApp.sendEmail(
    REPORT_CONFIG.TO_EMAIL,
    '[JJ Center] Weekly Pantry Report — Week of ' + weekOf,
    'Please view this email in HTML format.',
    {
      htmlBody: html,
      name:     REPORT_CONFIG.FROM_NAME,
      replyTo:  REPORT_CONFIG.TO_EMAIL
    }
  );

  console.log('✅ Weekly report sent to ' + REPORT_CONFIG.TO_EMAIL);
}

// ═══════════════════════════════════════════════════════════════
// SUPABASE DATA FETCHERS
// ═══════════════════════════════════════════════════════════════
function fetchVisits(from, to) {
  try {
    const url = REPORT_CONFIG.SUPABASE_URL +
      '/rest/v1/visits?visited_at=gte.' + encodeURIComponent(from) +
      '&visited_at=lte.' + encodeURIComponent(to) +
      '&select=id,member_id,visitor_name,visitor_zip,household_size,visited_at,visit_type';

    const res = UrlFetchApp.fetch(url, {
      headers: {
        'apikey':        REPORT_CONFIG.SUPABASE_KEY,
        'Authorization': 'Bearer ' + REPORT_CONFIG.SUPABASE_KEY
      },
      muteHttpExceptions: true
    });

    return JSON.parse(res.getContentText());
  } catch (e) {
    console.error('fetchVisits error:', e);
    return [];
  }
}

function fetchTotalMembers() {
  try {
    const res = UrlFetchApp.fetch(
      REPORT_CONFIG.SUPABASE_URL + '/rest/v1/members?select=id',
      {
        headers: {
          'apikey':        REPORT_CONFIG.SUPABASE_KEY,
          'Authorization': 'Bearer ' + REPORT_CONFIG.SUPABASE_KEY,
          'Prefer':        'count=exact'
        },
        muteHttpExceptions: true
      }
    );
    const count = res.getHeaders()['content-range'];
    return count ? parseInt(count.split('/')[1]) : JSON.parse(res.getContentText()).length;
  } catch (e) { return 0; }
}

function fetchPendingInvites(from) {
  try {
    const res = UrlFetchApp.fetch(
      REPORT_CONFIG.SUPABASE_URL +
      '/rest/v1/invite_queue?status=eq.pending_call&created_at=gte.' +
      encodeURIComponent(from) + '&select=id',
      {
        headers: {
          'apikey':        REPORT_CONFIG.SUPABASE_KEY,
          'Authorization': 'Bearer ' + REPORT_CONFIG.SUPABASE_KEY
        },
        muteHttpExceptions: true
      }
    );
    return JSON.parse(res.getContentText()).length;
  } catch (e) { return 0; }
}

// ═══════════════════════════════════════════════════════════════
// DATA HELPERS
// ═══════════════════════════════════════════════════════════════
function buildDailyBreakdown(visits, startMonday) {
  const days   = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const counts = [0,0,0,0,0,0,0];
  visits.forEach(v => {
    const d = new Date(v.visited_at);
    let dow = d.getDay(); // 0=Sun
    dow = dow === 0 ? 6 : dow - 1; // convert to Mon=0
    if (dow >= 0 && dow <= 6) counts[dow]++;
  });
  return days.map((d, i) => ({ day: d, count: counts[i] }));
}

function estimatePeopleServed(visits) {
  const sizeMap = { '1': 1, '2': 2, '3-4': 3.5, '5-6': 5.5, '7+': 7 };
  let total = 0;
  visits.forEach(v => {
    if (v.household_size && sizeMap[v.household_size]) {
      total += sizeMap[v.household_size];
    } else {
      total += 1; // default if no household data
    }
  });
  return Math.round(total);
}

function formatDate(d) {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatDateShort(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ═══════════════════════════════════════════════════════════════
// BUILD EMAIL HTML
// ═══════════════════════════════════════════════════════════════
function buildReportEmail(weekOf, weekLabel, totalVisits, memberVisits, walkIns,
                           totalMembers, pendingCalls, uniqueZips, daily,
                           householdMap, peopleServed) {

  const maxDaily = Math.max(...daily.map(d => d.count), 1);

  const dailyBars = daily.map(d => {
    const pct = Math.round((d.count / maxDaily) * 100);
    return '<td style="text-align:center;padding:4px 6px;vertical-align:bottom;">' +
      '<div style="background:' + (d.count > 0 ? '#c8922a' : '#3d1a7a') + ';' +
      'height:' + Math.max(pct * 0.6, d.count > 0 ? 4 : 0) + 'px;' +
      'border-radius:4px 4px 0 0;width:32px;margin:0 auto;"></div>' +
      '<div style="font-size:11px;color:#c4a8f5;margin-top:4px;">' + d.day + '</div>' +
      '<div style="font-size:12px;font-weight:600;color:white;">' + d.count + '</div>' +
      '</td>';
  }).join('');

  const householdRows = Object.entries(householdMap).map(([size, count]) =>
    '<tr><td style="padding:6px 12px;font-size:13px;color:#6b5f78;">' + size + '</td>' +
    '<td style="padding:6px 12px;font-size:13px;font-weight:600;color:#2a1052;">' + count + ' household(s)</td></tr>'
  ).join('');

  const pendingCallsRow = pendingCalls > 0
    ? '<div style="background:#fff8e6;border:1px solid #e8b84b;border-radius:10px;padding:14px 16px;margin-top:16px;">' +
      '<strong style="color:#7a5800;font-size:13px;">⚠️ Action Needed — ' + pendingCalls + ' phone-only walk-in(s) this week</strong><br>' +
      '<span style="font-size:12px;color:#7a5800;">These visitors provided only a phone number. Please check the invite_queue table in Supabase and follow up.</span></div>'
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f3ede8;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3ede8;padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

  <!-- HEADER -->
  <tr><td style="background:linear-gradient(135deg,#2a1052,#3d1a7a);border-radius:16px 16px 0 0;padding:32px 36px;">
    <div style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:white;margin-bottom:4px;">The JJ Center</div>
    <div style="font-size:11px;color:#c4a8f5;letter-spacing:.1em;text-transform:uppercase;">Weekly Pantry Report</div>
  </td></tr>
  <tr><td style="height:4px;background:linear-gradient(90deg,#c8922a,#e8b84b);"></td></tr>

  <!-- GREETING -->
  <tr><td style="background:white;padding:32px 36px 24px;">
    <p style="font-size:15px;color:#2a1052;line-height:1.8;margin:0 0 6px;">
      <strong>Hi Operations Team,</strong>
    </p>
    <p style="font-size:14px;color:#6b5f78;line-height:1.8;margin:0 0 20px;">
      Here is the admin dashboard for the food pantry from the <strong>week of ${weekOf}</strong>.
      Please remember to share with <strong>Dr. Mary Roach</strong> and <strong>Victoria Roach</strong>
      via email and in the All Hands team meeting.
    </p>

    <!-- WEEK LABEL -->
    <div style="background:#f0ecff;border-radius:10px;padding:10px 16px;font-size:13px;color:#3d1a7a;font-weight:600;margin-bottom:24px;">
      📅 Reporting Period: ${weekLabel}
    </div>

    <!-- TOP STATS -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="width:25%;text-align:center;padding:16px 8px;background:#f0ecff;border-radius:12px;margin:4px;">
          <div style="font-size:32px;font-weight:700;color:#2a1052;font-family:Georgia,serif;">${totalVisits}</div>
          <div style="font-size:11px;color:#6b5f78;text-transform:uppercase;letter-spacing:.06em;margin-top:4px;">Total Visits</div>
        </td>
        <td style="width:4%;"></td>
        <td style="width:25%;text-align:center;padding:16px 8px;background:#edfaf2;border-radius:12px;">
          <div style="font-size:32px;font-weight:700;color:#1a7a3d;font-family:Georgia,serif;">${peopleServed}</div>
          <div style="font-size:11px;color:#6b5f78;text-transform:uppercase;letter-spacing:.06em;margin-top:4px;">People Served</div>
        </td>
        <td style="width:4%;"></td>
        <td style="width:25%;text-align:center;padding:16px 8px;background:#fff8e6;border-radius:12px;">
          <div style="font-size:32px;font-weight:700;color:#c8922a;font-family:Georgia,serif;">${memberVisits}</div>
          <div style="font-size:11px;color:#6b5f78;text-transform:uppercase;letter-spacing:.06em;margin-top:4px;">Members</div>
        </td>
        <td style="width:4%;"></td>
        <td style="width:25%;text-align:center;padding:16px 8px;background:#fdf0ee;border-radius:12px;">
          <div style="font-size:32px;font-weight:700;color:#b83024;font-family:Georgia,serif;">${walkIns}</div>
          <div style="font-size:11px;color:#6b5f78;text-transform:uppercase;letter-spacing:.06em;margin-top:4px;">Walk-Ins</div>
        </td>
      </tr>
    </table>

    <!-- DAILY CHART -->
    <div style="background:#16082b;border-radius:12px;padding:20px;margin-bottom:20px;">
      <div style="font-size:12px;font-weight:700;color:#c4a8f5;letter-spacing:.08em;text-transform:uppercase;margin-bottom:16px;">Daily Visits This Week</div>
      <table cellpadding="0" cellspacing="0" style="width:100%;">
        <tr>${dailyBars}</tr>
      </table>
    </div>

    <!-- MEMBER STATS -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="width:48%;background:#f0ecff;border-radius:12px;padding:18px 20px;">
          <div style="font-size:11px;font-weight:700;color:#3d1a7a;letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px;">Member Portal</div>
          <div style="font-size:24px;font-weight:700;color:#2a1052;font-family:Georgia,serif;">${totalMembers}</div>
          <div style="font-size:12px;color:#6b5f78;margin-top:3px;">Total registered members</div>
        </td>
        <td style="width:4%;"></td>
        <td style="width:48%;background:#f0ecff;border-radius:12px;padding:18px 20px;">
          <div style="font-size:11px;font-weight:700;color:#3d1a7a;letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px;">ZIP Codes Reached</div>
          <div style="font-size:24px;font-weight:700;color:#2a1052;font-family:Georgia,serif;">${uniqueZips.length}</div>
          <div style="font-size:12px;color:#6b5f78;margin-top:3px;">${uniqueZips.slice(0,5).join(', ')}${uniqueZips.length > 5 ? ' +' + (uniqueZips.length-5) + ' more' : ''}</div>
        </td>
      </tr>
    </table>

    <!-- HOUSEHOLD BREAKDOWN -->
    ${householdRows ? `
    <div style="margin-bottom:20px;">
      <div style="font-size:12px;font-weight:700;color:#3d1a7a;letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px;">Household Size Breakdown</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f7ff;border-radius:10px;overflow:hidden;">
        ${householdRows}
      </table>
    </div>` : ''}

    <!-- PENDING CALLS ACTION ITEM -->
    ${pendingCallsRow}

    <!-- LINKS -->
    <div style="margin-top:24px;padding-top:20px;border-top:1px solid #e4ddf0;">
      <div style="font-size:12px;font-weight:700;color:#3d1a7a;letter-spacing:.08em;text-transform:uppercase;margin-bottom:12px;">Quick Links</div>
      <a href="https://supabase.com/dashboard/project/mkldikwqxninqcmorwsg/editor?query=SELECT%20*%20FROM%20visits%20ORDER%20BY%20visited_at%20DESC%20LIMIT%2050"
         style="display:inline-block;background:linear-gradient(135deg,#3d1a7a,#5a2da8);color:white;padding:10px 20px;border-radius:100px;text-decoration:none;font-size:12px;font-weight:600;margin-right:8px;margin-bottom:8px;">
        View Visit Data in Supabase →
      </a>
      <a href="https://thejjcenter.vercel.app/checkin.html"
         style="display:inline-block;background:#c8922a;color:#16082b;padding:10px 20px;border-radius:100px;text-decoration:none;font-size:12px;font-weight:600;margin-bottom:8px;">
        Check-In Page →
      </a>
    </div>

  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#16082b;padding:22px 36px;border-radius:0 0 16px 16px;text-align:center;">
    <p style="font-size:12px;color:#6b5f78;margin:0 0 4px;">The Jehovah Jireh Community Development Center Inc. &bull; 501(c)(3) Nonprofit</p>
    <p style="font-size:11px;color:#3d1a7a;margin:0;">This is an automated weekly report &bull; hello@jjcenter.org &bull; Internal use only</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════
// SETUP TRIGGER — run this once manually
// ═══════════════════════════════════════════════════════════════
function setupReportTrigger() {
  // Delete existing triggers first
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'sendWeeklyPantryReport')
    .forEach(t => ScriptApp.deleteTrigger(t));

  // Create Monday 9am trigger
  ScriptApp.newTrigger('sendWeeklyPantryReport')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(9)
    .inTimezone('America/New_York')
    .create();

  console.log('✅ Weekly report trigger set — every Monday at 9am EST');
}

// TEST — run manually to preview report immediately
function testReport() {
  sendWeeklyPantryReport();
  console.log('Test report sent to ' + REPORT_CONFIG.TO_EMAIL);
}
