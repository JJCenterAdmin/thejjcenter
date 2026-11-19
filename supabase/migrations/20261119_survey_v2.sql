-- ══════════════════════════════════════════════════════
-- SURVEY V2 MIGRATION — paste each BLOCK separately
-- in the Supabase SQL editor, in order.
-- ══════════════════════════════════════════════════════

-- ── BLOCK 1 ─────────────────────────────────────────
-- app_config table + profile_version column on members
-- ─────────────────────────────────────────────────────
create table if not exists public.app_config (
  key   text primary key,
  value text not null
);
alter table public.app_config enable row level security;
create policy "public read app_config" on public.app_config
  for select using (true);
insert into public.app_config (key, value)
  values ('current_profile_version', '1')
  on conflict (key) do nothing;
alter table public.members
  add column if not exists profile_version int;


-- ── BLOCK 2 ─────────────────────────────────────────
-- Add survey_type to survey_versions,
-- replace global one-active index with per-type index
-- ─────────────────────────────────────────────────────
alter table public.survey_versions
  add column if not exists survey_type text not null default 'community';
drop index if exists survey_versions_one_active;
create unique index if not exists survey_versions_one_active_per_type
  on public.survey_versions (survey_type)
  where is_active = true;


-- ── BLOCK 3 ─────────────────────────────────────────
-- Add survey_type to survey_responses
-- ─────────────────────────────────────────────────────
alter table public.survey_responses
  add column if not exists survey_type text not null default 'community';


-- ── BLOCK 4 ─────────────────────────────────────────
-- Replace Survey 1 (community) with updated questions
-- ─────────────────────────────────────────────────────
insert into public.survey_versions
  (version, title, intro_text, questions, is_active, survey_type)
values (
  1,
  'The JJ Center Community Survey',
  'This survey is anonymous. Your answers help The JJ Center improve our free food, health, education, and advocacy services in Wards 7 and 8. DC is expected to begin Medicaid work requirements for some adults starting January 1, 2027. Rules like these can affect coverage, so we want to hear what you need. Every question is optional. Please do not include your name or personal details.',
  '[
    {
      "id": "q1",
      "type": "dropdown",
      "text": "Which ward do you live in?",
      "options": ["Ward 7", "Ward 8", "Other DC ward", "Outside DC"]
    },
    {
      "id": "q2",
      "type": "dropdown",
      "text": "How often do you use our free food program?",
      "options": ["This is my first time", "Monthly", "Weekly", "More than once a week"]
    },
    {
      "id": "q3",
      "type": "dropdown",
      "text": "What brings you to the JJ Center today?",
      "options": ["Food pantry", "Health services", "Educational program", "Advocacy support", "Referral from another organization", "Just exploring"]
    },
    {
      "id": "q4",
      "type": "single_choice",
      "text": "How easy is it to get to us?",
      "options": ["Very easy", "Okay", "Difficult"]
    },
    {
      "id": "q4b",
      "type": "open_text",
      "text": "What makes it hard? (transportation, hours, location, other)",
      "conditional": {"depends_on": "q4", "show_when": "Difficult"}
    },
    {
      "id": "q5",
      "type": "rating_grid",
      "text": "How well does the food meet your household needs?",
      "scale": {"min": 1, "max": 5, "labels": ["Poor", "Excellent"]},
      "not_sure_col": true,
      "rows": ["Variety", "Freshness", "Quantity", "Healthy options", "Cultural or dietary fit"]
    },
    {
      "id": "q6",
      "type": "multi_choice",
      "text": "Which would help you most?",
      "max_selections": 2,
      "options": ["More fresh produce", "Home delivery", "Evening or weekend hours", "Cooking and nutrition classes", "Shorter wait times", "Other"]
    },
    {
      "id": "q7",
      "type": "multi_choice",
      "text": "Which other services would you use?",
      "options": ["Health screenings", "Medication help", "Health education", "Advocacy for benefits", "Job training", "Housing help", "Other"]
    },
    {
      "id": "q8",
      "type": "dropdown",
      "text": "Do you or anyone in your household have Medicaid?",
      "options": ["Yes", "No", "Applying", "Not sure", "Prefer not to say"]
    },
    {
      "id": "q9",
      "type": "single_choice",
      "text": "How familiar are you with the Medicaid work requirements?",
      "options": ["I have never heard of them", "I have heard a little", "I understand them well"]
    },
    {
      "id": "q10",
      "type": "multi_choice",
      "text": "If your coverage were affected, what help would you need most?",
      "options": ["Understanding the rules", "Proving work or other qualifying activities", "Completing paperwork", "Finding a clinic or pharmacy", "Getting a language or disability accommodation", "Other"]
    },
    {
      "id": "q11",
      "type": "open_text",
      "text": "What is one thing we should start, stop, or change? Please do not include names or personal details."
    }
  ]'::jsonb,
  true,
  'community'
)
on conflict (version) do update set
  title        = excluded.title,
  intro_text   = excluded.intro_text,
  questions    = excluded.questions,
  is_active    = excluded.is_active,
  survey_type  = excluded.survey_type;


-- ── BLOCK 5 ─────────────────────────────────────────
-- Insert Survey 2 (post-visit, inactive)
-- ─────────────────────────────────────────────────────
insert into public.survey_versions
  (version, title, intro_text, questions, is_active, survey_type)
values (
  2,
  'How Was Your Visit?',
  'Thanks for visiting the JJ Center today. This quick survey is anonymous and helps us improve. All questions are optional.',
  '[
    {
      "id": "pv1",
      "type": "single_choice",
      "text": "How was your overall experience today?",
      "options": ["Great", "Good", "Okay", "Could be better", "Poor"]
    },
    {
      "id": "pv1b",
      "type": "open_text",
      "text": "What could we do better?",
      "conditional": {"depends_on": "pv1", "show_when": "Could be better"}
    },
    {
      "id": "pv2",
      "type": "rating_grid",
      "text": "Please rate different parts of your visit:",
      "scale": {"min": 1, "max": 5, "labels": ["Poor", "Excellent"]},
      "not_sure_col": true,
      "rows": ["Staff helpfulness", "Wait time", "Food quality", "Overall experience"]
    },
    {
      "id": "pv3",
      "type": "open_text",
      "text": "Any other feedback for us?"
    }
  ]'::jsonb,
  false,
  'post_visit'
)
on conflict (version) do update set
  title        = excluded.title,
  intro_text   = excluded.intro_text,
  questions    = excluded.questions,
  survey_type  = excluded.survey_type;


-- ── BLOCK 6 ─────────────────────────────────────────
-- Updated claim_walkin_profile() — no visitor_name parsing
-- ─────────────────────────────────────────────────────
create or replace function public.claim_walkin_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid;
  v_email text;
  v_visit record;
begin
  v_uid   := auth.uid();
  v_email := lower((auth.jwt() ->> 'email'));

  if v_uid is null or v_email is null then
    return;
  end if;

  if exists (select 1 from public.members where id = v_uid) then
    return;
  end if;

  select * into v_visit
  from public.visits
  where lower(visitor_email) = v_email
    and source = 'checkin_form'
  order by visited_at desc
  limit 1;

  if v_visit is null then
    return;
  end if;

  insert into public.members (
    id, email, first_name, last_name,
    zip_code, household_size, source
  ) values (
    v_uid, v_email, '', '',
    v_visit.visitor_zip, v_visit.household_size, 'walkin_invite'
  )
  on conflict (id) do nothing;

  update public.visits
  set member_id = v_uid
  where lower(visitor_email) = v_email
    and source = 'checkin_form'
    and member_id is null;
end;
$$;

grant execute on function public.claim_walkin_profile() to authenticated;
