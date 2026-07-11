import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const resendApiKey = Deno.env.get('RESEND_API_KEY')!

Deno.serve(async (_req) => {
  try {
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

    const { data: logs, error } = await admin
      .from('invite_log')
      .select('visitor_name, visitor_email, status, created_at')
      .eq('visit_date', today)
      .order('created_at', { ascending: true })

    if (error) throw error
    if (!logs || logs.length === 0) {
      return new Response(JSON.stringify({ message: 'no invites today' }), { status: 200 })
    }

    const dateLabel = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York'
    })

    const rows = logs.map(l => {
      const statusLabel = l.status === 'sent' ? '✅ Sent'
        : l.status === 'skipped_existing' ? '⏭️ Already member'
        : '❌ Failed'
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${l.visitor_name || '—'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${l.visitor_email}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${statusLabel}</td>
      </tr>`
    }).join('')

    const sentCount = logs.filter(l => l.status === 'sent').length
    const skippedCount = logs.filter(l => l.status === 'skipped_existing').length
    const failedCount = logs.filter(l => l.status === 'failed').length

    const html = `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#1a1520;max-width:600px;margin:0 auto;padding:20px;">
  <h2 style="color:#3d1a7a;">JJ Center — Walk-In Invite Summary</h2>
  <p style="color:#4a3f5c;">${dateLabel}</p>
  <p><strong>Total:</strong> ${logs.length} &nbsp;|&nbsp;
     <strong>Sent:</strong> ${sentCount} &nbsp;|&nbsp;
     <strong>Already Members:</strong> ${skippedCount} &nbsp;|&nbsp;
     <strong>Failed:</strong> ${failedCount}</p>
  <table style="width:100%;border-collapse:collapse;margin-top:16px;">
    <thead>
      <tr style="background:#f5f0ff;">
        <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #cfc5e8;">Name</th>
        <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #cfc5e8;">Email</th>
        <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #cfc5e8;">Status</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`
      },
      body: JSON.stringify({
        from: 'JJ Center <noreply@jjcenter.org>',
        to: ['operations@jjcenter.org'],
        subject: `JJ Center — Walk-In Invite Summary — ${dateLabel}`,
        html
      })
    })

    if (!emailRes.ok) {
      const errText = await emailRes.text()
      throw new Error(`Resend error: ${errText}`)
    }

    return new Response(JSON.stringify({ message: 'summary sent', count: logs.length }), { status: 200 })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
