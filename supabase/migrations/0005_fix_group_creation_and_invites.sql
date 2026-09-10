-- =====================================================================
-- ChamaOne — 0005_fix_group_creation_and_invites.sql
-- Fixes RLS policies for group creators, adds atomic group creation RPC,
-- and supports direct join links and join requests.
--
-- Apply via the Supabase Dashboard SQL Editor (https://supabase.com/dashboard)
-- =====================================================================

-- 1) Allow group creators to view their created groups even before membership
drop policy if exists groups_select on public.groups;
create policy groups_select on public.groups for select
  using (public.is_group_member(id) or created_by = auth.uid());

-- 2) Helper function to check if caller is the creator of a group (SECURITY DEFINER)
create or replace function public.is_group_creator(g uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.groups where id = g and created_by = auth.uid()
  );
$$;

grant execute on function public.is_group_creator(uuid) to authenticated;

-- 3) Fix group_members insert/update policies to allow the creator to manage roster
drop policy if exists members_insert on public.group_members;
create policy members_insert on public.group_members for insert
  with check (
    public.can_manage_money(group_id)
    or public.is_group_creator(group_id)
  );

drop policy if exists members_update on public.group_members;
create policy members_update on public.group_members for update
  using (
    public.can_manage_money(group_id)
    or public.is_group_creator(group_id)
  )
  with check (
    public.can_manage_money(group_id)
    or public.is_group_creator(group_id)
  );

-- 4) Fix cycles write policy to allow the creator to create initial cycles
drop policy if exists cycles_write on public.cycles;
create policy cycles_write on public.cycles for all
  using (
    public.can_manage_money(group_id)
    or public.is_group_creator(group_id)
  )
  with check (
    public.can_manage_money(group_id)
    or public.is_group_creator(group_id)
  );

-- 5) Atomic SECURITY DEFINER RPC to create a group, creator member, cycles & roster
create or replace function public.create_chama_group(
  p_group jsonb,
  p_creator jsonb,
  p_members jsonb default '[]'::jsonb,
  p_cycles jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_group_id uuid := (p_group->>'id')::uuid;
  v_cycle_id uuid := (p_group->>'active_cycle_id')::uuid;
  m jsonb;
  c jsonb;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;

  -- 1. Insert or update the group
  insert into public.groups (
    id, name, type, contribution_amount, frequency, currency,
    loan_interest, active_cycle_id, join_code, created_by
  ) values (
    v_group_id,
    coalesce(p_group->>'name', 'My Chama'),
    coalesce(p_group->>'type', 'Savings Group'),
    coalesce((p_group->>'contribution_amount')::numeric, 0),
    coalesce(p_group->>'frequency', 'monthly'),
    coalesce(p_group->>'currency', 'KES'),
    coalesce((p_group->>'loan_interest')::numeric, 10),
    v_cycle_id,
    coalesce(p_group->>'join_code', upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))),
    auth.uid()
  ) on conflict (id) do update set
    name = excluded.name,
    active_cycle_id = excluded.active_cycle_id;

  -- 2. Insert creator as Chairperson
  insert into public.group_members (
    id, group_id, user_id, name, phone, role, status
  ) values (
    coalesce((p_creator->>'id')::uuid, gen_random_uuid()),
    v_group_id,
    auth.uid(),
    coalesce(nullif(p_creator->>'name', ''), 'Chairperson'),
    coalesce(p_creator->>'phone', ''),
    'Chairperson',
    'active'
  ) on conflict (group_id, user_id) where user_id is not null do update set
    role = 'Chairperson',
    status = 'active';

  -- 3. Insert cycles
  for c in select * from jsonb_array_elements(p_cycles) loop
    insert into public.cycles (id, group_id, label, start_date, end_date)
    values (
      (c->>'id')::uuid,
      v_group_id,
      coalesce(c->>'label', 'First Cycle'),
      coalesce((c->>'start_date')::timestamptz, now()),
      (c->>'end_date')::timestamptz
    ) on conflict (id) do nothing;
  end loop;

  -- 4. Insert additional roster members if provided
  for m in select * from jsonb_array_elements(p_members) loop
    insert into public.group_members (
      id, group_id, user_id, name, phone, role, status, invite_code
    ) values (
      (m->>'id')::uuid,
      v_group_id,
      null,
      coalesce(m->>'name', 'Member'),
      coalesce(m->>'phone', ''),
      coalesce((m->>'role')::member_role, 'Member'::member_role),
      'active',
      coalesce(m->>'invite_code', upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)))
    ) on conflict (id) do nothing;
  end loop;

  return jsonb_build_object('ok', true, 'groupId', v_group_id);
end $$;

grant execute on function public.create_chama_group(jsonb, jsonb, jsonb, jsonb) to authenticated;

-- 6) Support requesting to join a group
create or replace function public.request_to_join(p_code text, p_note text default '')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_group_id uuid;
  v_group_name text;
  v_existing record;
  prof record;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;

  select id, name into v_group_id, v_group_name
    from public.groups
   where upper(join_code) = upper(trim(p_code))
      or id::text = trim(p_code);

  if v_group_id is null then
    return jsonb_build_object('ok', false, 'error', 'Chama not found with that code or link.');
  end if;

  select * into v_existing from public.group_members
   where group_id = v_group_id and user_id = auth.uid();

  if v_existing.id is not null then
    if v_existing.status = 'active' then
      return jsonb_build_object('ok', true, 'status', 'already_member', 'groupId', v_group_id, 'name', v_group_name);
    end if;
    update public.group_members set status = 'inactive' where id = v_existing.id;
  else
    select full_name, phone into prof from public.profiles where id = auth.uid();
    insert into public.group_members (group_id, user_id, name, phone, role, status)
    values (v_group_id, auth.uid(), coalesce(nullif(prof.full_name, ''), 'Member'), coalesce(prof.phone, ''), 'Member', 'inactive');
  end if;

  insert into public.notifications (group_id, type, text)
  values (v_group_id, 'system', coalesce(nullif(prof.full_name, ''), 'A member') || ' has requested to join ' || v_group_name || '.');

  return jsonb_build_object('ok', true, 'status', 'requested', 'groupId', v_group_id, 'name', v_group_name);
end $$;

grant execute on function public.request_to_join(text, text) to authenticated;

-- 7) Officers approve pending join request
create or replace function public.approve_join_request(p_member_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  m record;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into m from public.group_members where id = p_member_id;
  if m.id is null then return jsonb_build_object('ok', false, 'error', 'Request not found.'); end if;

  if not (public.can_manage_money(m.group_id) or public.is_group_creator(m.group_id)) then
    raise exception 'Unauthorized to approve members';
  end if;

  update public.group_members set status = 'active' where id = p_member_id;
  insert into public.notifications (group_id, type, text)
  values (m.group_id, 'member', m.name || ' was approved and is now an active member.');

  return jsonb_build_object('ok', true, 'groupId', m.group_id);
end $$;

grant execute on function public.approve_join_request(uuid) to authenticated;
