-- ============================================================
-- invite_log table
-- ============================================================
create table if not exists public.invite_log (
  id            bigserial primary key,
  visit_id      bigint references public.visits(id) on delete set null,
  visitor_email text not null,
  visitor_name  text,
  visit_date    date,
  status        text not null check (status in ('sent','skipped_existing','failed')),
  error_message text,
  created_at    timestamptz not null default now()
);

alter table public.invite_log enable row level security;

-- Service role only — no public reads
create policy "service role only" on public.invite_log
  using (false);

-- ============================================================
-- pg_net extension (required for HTTP calls from triggers)
-- ============================================================
create extension if not exists pg_net schema extensions;

-- ============================================================
-- Trigger function: fires invite-walkin-user Edge Function
-- Called after every INSERT on visits where source = 'checkin_form'
-- and visitor_email is not null
-- ============================================================
create or replace function public.trigger_invite_walkin()
returns trigger language plpgsql security definer as $$
declare
  v_visit_date date;
begin
  -- Only process walk-ins with an email
  if NEW.source <> 'checkin_form' or NEW.visitor_email is null then
    return NEW;
  end if;

  v_visit_date := (NEW.visited_at at time zone 'America/New_York')::date;

  perform extensions.http_post(
    url     := 'https://mkldikwqxninqcmorwsg.supabase.co/functions/v1/invite-walkin-user',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body    := jsonb_build_object(
      'visit_id',      NEW.id,
      'visitor_email', NEW.visitor_email,
      'visitor_name',  NEW.visitor_name,
      'visit_date',    v_visit_date
    )::text
  );

  return NEW;
end;
$$;

drop trigger if exists on_walkin_visit_inserted on public.visits;
create trigger on_walkin_visit_inserted
  after insert on public.visits
  for each row execute function public.trigger_invite_walkin();

-- ============================================================
-- pg_cron job: daily invite summary at 6 PM ET (23:00 UTC)
-- Adjust to 22:00 UTC during EDT (summer)
-- ============================================================
-- Enable pg_cron (run once in Supabase SQL editor if not already enabled)
-- create extension if not exists pg_cron;

-- Remove old job if it exists
select cron.unschedule('invite-daily-summary') where exists (
  select 1 from cron.job where jobname = 'invite-daily-summary'
);

select cron.schedule(
  'invite-daily-summary',
  '0 23 * * *',  -- 6 PM ET (EST) / 7 PM EDT — adjust seasonally if needed
  $$
  select extensions.http_post(
    url     := 'https://mkldikwqxninqcmorwsg.supabase.co/functions/v1/invite-daily-summary',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body    := '{}'
  );
  $$
);

-- ============================================================
-- NOTE: Set app.service_role_key in Supabase database settings
-- Dashboard → Settings → Database → Configuration → Extra options
-- Add:  app.service_role_key = '<your service role key>'
-- This keeps the key out of source code.
-- ============================================================
