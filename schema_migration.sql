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

-- Verify the columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'members'
  AND column_name IN ('user_types', 'zip_code', 'household_size')
ORDER BY column_name;
