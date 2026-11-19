-- claim_walkin_profile(): called by authenticated user after invite sign-in
-- Finds their walk-in visit record and creates a members row from it
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
  v_first text;
  v_last  text;
  v_parts text[];
begin
  v_uid   := auth.uid();
  v_email := lower((auth.jwt() ->> 'email'));

  if v_uid is null or v_email is null then
    return;
  end if;

  -- No-op if member row already exists
  if exists (select 1 from public.members where id = v_uid) then
    return;
  end if;

  -- Find most recent matching walk-in visit
  select * into v_visit
  from public.visits
  where lower(visitor_email) = v_email
    and source = 'checkin_form'
  order by visited_at desc
  limit 1;

  if v_visit is null then
    return;
  end if;

  -- Parse visitor_name into first/last
  v_parts := string_to_array(trim(coalesce(v_visit.visitor_name,'')), ' ');
  if array_length(v_parts, 1) >= 2 then
    v_first := v_parts[1];
    v_last  := array_to_string(v_parts[2:], ' ');
  else
    v_first := coalesce(v_parts[1], '');
    v_last  := '';
  end if;

  -- Insert member row
  insert into public.members (
    id, email, first_name, last_name,
    zip_code, household_size, source
  ) values (
    v_uid, v_email, v_first, v_last,
    v_visit.visitor_zip, v_visit.household_size, 'walkin_invite'
  )
  on conflict (id) do nothing;

  -- Link visits to this member
  update public.visits
  set member_id = v_uid
  where lower(visitor_email) = v_email
    and source = 'checkin_form'
    and member_id is null;

end;
$$;

grant execute on function public.claim_walkin_profile() to authenticated;
