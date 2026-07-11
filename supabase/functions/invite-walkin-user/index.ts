import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  try {
    const { visit_id, visitor_email, visitor_name, visit_date } = await req.json()

    if (!visitor_email) {
      return new Response(JSON.stringify({ error: 'visitor_email required' }), { status: 400 })
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Check if user already exists
    const { data: existingUsers } = await admin.auth.admin.listUsers()
    const alreadyExists = existingUsers?.users?.some(u => u.email === visitor_email)

    if (alreadyExists) {
      await admin.from('invite_log').insert({
        visit_id,
        visitor_email,
        visitor_name,
        visit_date,
        status: 'skipped_existing'
      })
      return new Response(JSON.stringify({ status: 'skipped_existing' }), { status: 200 })
    }

    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(visitor_email, {
      data: { full_name: visitor_name }
    })

    if (inviteError) {
      await admin.from('invite_log').insert({
        visit_id,
        visitor_email,
        visitor_name,
        visit_date,
        status: 'failed',
        error_message: inviteError.message
      })
      return new Response(JSON.stringify({ status: 'failed', error: inviteError.message }), { status: 200 })
    }

    await admin.from('invite_log').insert({
      visit_id,
      visitor_email,
      visitor_name,
      visit_date,
      status: 'sent'
    })

    return new Response(JSON.stringify({ status: 'sent' }), { status: 200 })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
