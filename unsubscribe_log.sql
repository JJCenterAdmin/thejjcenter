-- ═══════════════════════════════════════════════════════════════
-- JJ CENTER — UNSUBSCRIBE LOG TABLE
-- Run this in Supabase → SQL Editor → New Query
-- Creates an auditable log of every unsubscribe request
-- Required for CAN-SPAM compliance
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS unsubscribe_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT NOT NULL,
  requested_at   TIMESTAMPTZ DEFAULT NOW(),
  source_page    TEXT,
  user_agent     TEXT,
  status         TEXT DEFAULT 'completed',  -- 'completed' | 'pending' | 'failed'
  notified_team  BOOLEAN DEFAULT FALSE,
  notes          TEXT
);

-- Anyone can insert (unsubscribe doesn't require login — CAN-SPAM requirement)
ALTER TABLE unsubscribe_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can log unsubscribe" ON unsubscribe_log FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Admins can view unsubscribe log" ON unsubscribe_log FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');

-- ─────────────────────────────────────────────────────────────
-- AUDIT VIEW — easy way to see all unsubscribes with member info
-- Run this query anytime to do your manual audit:
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW unsubscribe_audit AS
SELECT
  u.id,
  u.email,
  u.requested_at,
  u.source_page,
  u.status,
  u.notified_team,
  m.first_name,
  m.last_name,
  m.pantry_optin,   -- should be FALSE after unsubscribe
  m.created_at AS member_since
FROM unsubscribe_log u
LEFT JOIN members m ON m.email = u.email
ORDER BY u.requested_at DESC;

-- ═══════════════════════════════════════════════════════════════
-- HOW TO DO YOUR MANUAL AUDIT
-- Go to Supabase → SQL Editor → run this query:
-- ═══════════════════════════════════════════════════════════════
-- SELECT * FROM unsubscribe_audit;
--
-- This shows you:
-- • Every unsubscribe request with timestamp
-- • Who they are (if they have a member account)
-- • Whether pantry_optin is actually FALSE (confirms it worked)
-- • Where they came from (privacy page, email link, dashboard)
--
-- For CAN-SPAM compliance — export this as CSV monthly:
-- Right click results → Download CSV → save to Google Drive compliance folder
-- ═══════════════════════════════════════════════════════════════
