-- survey_versions: stores versioned survey definitions
create table if not exists public.survey_versions (
  id           serial primary key,
  version      int unique not null,
  title        text not null,
  intro_text   text not null,
  questions    jsonb not null,
  is_active    bool not null default false,
  created_at   timestamptz not null default now()
);

-- Only one active version at a time
create unique index if not exists survey_versions_one_active
  on public.survey_versions (is_active)
  where is_active = true;

alter table public.survey_versions enable row level security;
create policy "anon can read active survey" on public.survey_versions
  for select using (is_active = true);

-- survey_responses: anonymous, no PII
create table if not exists public.survey_responses (
  id              uuid primary key default gen_random_uuid(),
  survey_version  int not null references public.survey_versions(version),
  answers         jsonb not null,
  source          text not null check (source in ('checkin','account','standalone')),
  submitted_at    timestamptz not null default now()
);

alter table public.survey_responses enable row level security;
create policy "anon insert only" on public.survey_responses
  for insert with check (true);

-- Add survey_done_version to members
alter table public.members
  add column if not exists survey_done_version int;

-- Seed version 1
insert into public.survey_versions (version, title, intro_text, questions, is_active)
values (
  1,
  'The JJ Center Community Survey',
  'This survey is anonymous. Your answers help The JJ Center improve our free food, health, education, and advocacy services in Wards 7 and 8. DC is expected to begin Medicaid work requirements for some adults starting January 1, 2027. Rules like these can affect coverage, so we want to hear what you need. Every question is optional. Please do not include your name or personal details.',
  '[
    {"id":"q1","type":"single_choice","text":"Which ward do you live in?","options":["Ward 7","Ward 8","Other DC ward","Outside DC"]},
    {"id":"q2","type":"single_choice","text":"How often do you use our free food program?","options":["This is my first time","Monthly","Weekly","More than once a week"]},
    {"id":"q3","type":"single_choice","text":"How easy is it to get to us?","options":["Very easy","Okay","Difficult"]},
    {"id":"q3b","type":"open_text","text":"What makes it hard? (transportation, hours, location, other)","conditional":{"depends_on":"q3","show_when":"Difficult"}},
    {"id":"q4","type":"rating_grid","text":"How well does the food meet your household needs?","scale":{"min":1,"max":5,"labels":["Poor","Excellent"]},"rows":["Variety","Freshness","Quantity","Healthy options","Cultural or dietary fit"]},
    {"id":"q5","type":"multi_choice","text":"Which would help you most?","max_selections":2,"options":["More fresh produce","Home delivery","Evening or weekend hours","Cooking and nutrition classes","Shorter wait times","Other"]},
    {"id":"q6","type":"multi_choice","text":"Which other services would you use?","options":["Health screenings","Medication help","Health education","Advocacy for benefits","Job training","Housing help","Other"]},
    {"id":"q7","type":"single_choice","text":"Do you or anyone in your household have Medicaid?","options":["Yes","No","Applying","Not sure","Prefer not to say"]},
    {"id":"q8","type":"single_choice","text":"How familiar are you with the Medicaid work requirements?","options":["I have never heard of them","I have heard a little","I understand them well"]},
    {"id":"q9","type":"multi_choice","text":"If your coverage were affected, what help would you need most?","options":["Understanding the rules","Proving work or other qualifying activities","Completing paperwork","Finding a clinic or pharmacy","Getting a language or disability accommodation","Other"]},
    {"id":"q10","type":"open_text","text":"What is one thing we should start, stop, or change? Please do not include names or personal details."}
  ]'::jsonb,
  true
)
on conflict (version) do nothing;
