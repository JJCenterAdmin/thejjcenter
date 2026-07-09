-- ============================================================
-- The JJ Center — Schema Migration
-- Run in Supabase SQL Editor at:
-- https://mkldikwqxninqcmorwsg.supabase.co
-- ============================================================

-- Add user_types (text array) to members table
-- Stores all selected connection types from signup form:
-- food_assistance, volunteer, partner, coalition, donate, informed
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS user_types text[] DEFAULT NULL;

-- zip_code is already present in the schema (was used in prior code)
-- but add it safely in case it does not exist yet
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS zip_code text DEFAULT NULL;

-- household_size — store as text to match select values (1, 2, 3, 4, 5, 6, 7, 8)
-- The column was previously used in code; add safely
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS household_size text DEFAULT NULL;

-- Optional: index on user_types for efficient filtering by type
CREATE INDEX IF NOT EXISTS idx_members_user_types ON members USING GIN (user_types);

-- Add welcomed_at to waitlist so we never send duplicate welcome emails
ALTER TABLE waitlist
  ADD COLUMN IF NOT EXISTS welcomed_at timestamptz DEFAULT NULL;

-- report_log table — tracks which dates the weekly report was sent
-- prevents duplicate sends when GitHub runs the cron multiple times on Friday
CREATE TABLE IF NOT EXISTS report_log (
  id         bigint generated always as identity primary key,
  sent_date  date not null unique,
  created_at timestamptz default now()
);

-- audit_log table — tracks which dates the daily site audit ran
-- prevents duplicate audit runs when GitHub fires the cron multiple times per day
CREATE TABLE IF NOT EXISTS audit_log (
  id          bigint generated always as identity primary key,
  audit_date  date not null unique,
  created_at  timestamptz default now()
);

-- admin_member_count — returns the total number of accounts in the
-- members table. Row-level security normally limits each signed-in
-- member to their own row, so this SECURITY DEFINER function is the
-- only way to surface a site-wide total, and it checks the caller's
-- email itself rather than trusting the client to gate access.
CREATE OR REPLACE FUNCTION admin_member_count()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total integer;
BEGIN
  IF (auth.jwt() ->> 'email') IS DISTINCT FROM 'roachvictoriaa@gmail.com' THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  SELECT count(*) INTO total FROM members;
  RETURN total;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_member_count() TO authenticated;

-- checkin_lookup_member — lets the check-in page (staff scanning a member's
-- QR code, no staff login) look up a member by id without needing row-level
-- security to allow arbitrary reads of the members table. Only returns the
-- handful of fields the check-in success screen displays — no email/phone/PII.
CREATE OR REPLACE FUNCTION checkin_lookup_member(p_member_id uuid)
RETURNS TABLE (id uuid, first_name text, last_name text, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, first_name, last_name, created_at
  FROM members
  WHERE id = p_member_id;
$$;

GRANT EXECUTE ON FUNCTION checkin_lookup_member(uuid) TO anon;
GRANT EXECUTE ON FUNCTION checkin_lookup_member(uuid) TO authenticated;

-- Verify the columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'members'
  AND column_name IN ('user_types', 'zip_code', 'household_size')
ORDER BY column_name;
