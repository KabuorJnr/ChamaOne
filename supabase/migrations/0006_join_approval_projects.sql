-- =====================================================================
-- ChamaOne — 0006_join_approval_projects.sql
--
-- 1) Join approval. People who join with the group-wide invite LINK/CODE
--    are held as a pending request (status 'inactive') until a Chairperson
--    or Treasurer approves them. Pending people can no longer read the
--    group's data. Per-member invite codes (the officer already added that
--    person to the roster) still join instantly — they are pre-approved.
--    The Chairperson can turn approval off per group (groups.require_approval).
-- 2) Projects & investments are stored in the backend (they used to live
--    only in memory and vanished on every refresh / sync).
-- 3) The Merry-go-round roster is stored on the group (groups.rotation).
-- 4) delete_my_account() — in-app account deletion (Google Play requirement).
--
-- Apply via the Supabase Dashboard → SQL Editor → paste this file → Run.
-- Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Membership only counts once approved
-- ---------------------------------------------------------------------
create or replace function public.is_group_member(g uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = g and m.user_id = auth.uid() and m.status = 'active'
  );
$$;

create or replace function public.group_role(g uuid)
returns member_role language sql security definer stable set search_path = public as $$
  select m.role from public.group_members m
  where m.group_id = g and m.user_id = auth.uid() and m.status = 'active'
  limit 1;
$$;

create or replace function public.my_member_id(g uuid)
returns uuid language sql security definer stable set search_path = public as $$
  select m.id from public.group_members m
  where m.group_id = g and m.user_id = auth.uid() and m.status = 'active'
  limit 1;
$$;

-- SECURITY FIX: for a non-member group_role() is NULL, so these returned NULL
-- (not false). In RLS NULL denies, but inside SECURITY DEFINER RPCs
-- `if not can_manage_money(g) then raise` let NULL through — anyone who knew
-- a payment/member id could confirm payments or approve members. Always
-- return a real boolean.
create or replace function public.can_manage_money(g uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce(public.group_role(g) in ('Chairperson', 'Treasurer'), false);
$$;

create or replace function public.can_manage_meetings(g uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce(public.group_role(g) in ('Chairperson', 'Secretary'), false);
$$;

alter table public.groups add column if not exists require_approval boolean not null default true;
alter table public.groups add column if not exists rotation jsonb;

-- Core join logic. Returns { ok, status, groupId, name } where status is
-- 'joined' | 'pending' | 'already_member'. p_force_request = true always
-- files a request (the explicit "Request to join" path).
create or replace function public.join_chama(p_code text, p_force_request boolean default false)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  code      text := upper(trim(coalesce(p_code, '')));
  v_name    text := '';
  v_phone   text := '';
  m_id uuid; m_group uuid; m_user uuid; m_name text; m_phone text;
  g_id uuid; g_name text; g_approval boolean;
  ex_id uuid; ex_status member_status;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if code = '' then raise exception 'Enter an invite code'; end if;

  select coalesce(nullif(full_name, ''), ''), coalesce(phone, '')
    into v_name, v_phone
    from public.profiles where id = auth.uid();
  v_name := coalesce(nullif(v_name, ''), 'Member');
  v_phone := coalesce(v_phone, '');

  -- a) Member-specific invite code → the officer already added this person,
  --    so claim that exact roster row immediately.
  select id, group_id, user_id, name, phone
    into m_id, m_group, m_user, m_name, m_phone
    from public.group_members
   where upper(invite_code) = code and status <> 'removed'
   limit 1;

  if m_id is not null then
    if m_user is not null and m_user <> auth.uid() then
      raise exception 'That invite code has already been used';
    end if;
    -- Drop any separate pending request this user filed for the same group.
    delete from public.group_members
     where group_id = m_group and user_id = auth.uid() and id <> m_id and status <> 'active';
    update public.group_members
       set user_id = auth.uid(),
           status  = 'active',
           name    = coalesce(nullif(m_name, ''), v_name),
           phone   = coalesce(nullif(m_phone, ''), v_phone)
     where id = m_id;
    select name into g_name from public.groups where id = m_group;
    return jsonb_build_object('ok', true, 'status', 'joined', 'groupId', m_group, 'name', g_name);
  end if;

  -- b) Group-wide join code / link.
  select id, name, require_approval into g_id, g_name, g_approval
    from public.groups
   where upper(join_code) = code or id::text = lower(trim(p_code));
  if g_id is null then raise exception 'Invalid invite code'; end if;

  select id, status into ex_id, ex_status
    from public.group_members
   where group_id = g_id and user_id = auth.uid()
   limit 1;

  if ex_status = 'active' then
    return jsonb_build_object('ok', true, 'status', 'already_member', 'groupId', g_id, 'name', g_name);
  end if;

  if g_approval or p_force_request then
    if ex_id is not null then
      if ex_status = 'inactive' then
        -- Already waiting — don't spam the officers again.
        return jsonb_build_object('ok', true, 'status', 'pending', 'groupId', g_id, 'name', g_name);
      end if;
      update public.group_members
         set status = 'inactive', name = v_name, phone = v_phone, role = 'Member', joined_at = now()
       where id = ex_id;
    else
      insert into public.group_members (group_id, user_id, name, phone, role, status)
      values (g_id, auth.uid(), v_name, v_phone, 'Member', 'inactive');
    end if;
    insert into public.notifications (group_id, type, text)
    values (g_id, 'member', v_name || ' used the invite link and is waiting for approval to join ' || g_name || '.');
    return jsonb_build_object('ok', true, 'status', 'pending', 'groupId', g_id, 'name', g_name);
  end if;

  -- Approval switched off by the Chairperson → join straight away.
  if ex_id is not null then
    update public.group_members set status = 'active', name = v_name, phone = v_phone, role = 'Member' where id = ex_id;
  else
    insert into public.group_members (group_id, user_id, name, phone, role, status)
    values (g_id, auth.uid(), v_name, v_phone, 'Member', 'active');
  end if;
  return jsonb_build_object('ok', true, 'status', 'joined', 'groupId', g_id, 'name', g_name);
end $$;
grant execute on function public.join_chama(text, boolean) to authenticated;

-- Older app versions call these — route them through the same approval
-- rules so nobody can skip the queue with an old APK.
create or replace function public.join_by_code(p_code text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  r := public.join_chama(p_code, false);
  return (r->>'groupId')::uuid;
end $$;
grant execute on function public.join_by_code(text) to authenticated;

create or replace function public.join_group_by_code(p_code text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  r := public.join_chama(p_code, false);
  return (r->>'groupId')::uuid;
end $$;
grant execute on function public.join_group_by_code(text) to authenticated;

create or replace function public.request_to_join(p_code text, p_note text default '')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  r := public.join_chama(p_code, true);
  if r->>'status' = 'pending' then r := r || jsonb_build_object('status', 'requested'); end if;
  return r;
end $$;
grant execute on function public.request_to_join(text, text) to authenticated;

-- The caller's own pending requests (they can't read the group itself yet).
create or replace function public.my_join_requests()
returns jsonb
language sql security definer stable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'groupId', g.id, 'name', g.name, 'type', g.type, 'requestedAt', m.joined_at)
           order by m.joined_at desc), '[]'::jsonb)
    from public.group_members m
    join public.groups g on g.id = m.group_id
   where m.user_id = auth.uid() and m.status = 'inactive';
$$;
grant execute on function public.my_join_requests() to authenticated;

create or replace function public.cancel_join_request(p_group uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  delete from public.group_members
   where group_id = p_group and user_id = auth.uid() and status = 'inactive';
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.cancel_join_request(uuid) to authenticated;

create or replace function public.approve_join_request(p_member_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare m record;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into m from public.group_members where id = p_member_id;
  if m.id is null then return jsonb_build_object('ok', false, 'error', 'Request not found.'); end if;
  if not (public.can_manage_money(m.group_id) or public.is_group_creator(m.group_id)) then
    raise exception 'Only the Chairperson or Treasurer can approve members';
  end if;
  update public.group_members set status = 'active', joined_at = now() where id = p_member_id;
  insert into public.notifications (group_id, type, text)
  values (m.group_id, 'member', m.name || ' was approved and is now a member.');
  return jsonb_build_object('ok', true, 'groupId', m.group_id);
end $$;
grant execute on function public.approve_join_request(uuid) to authenticated;

create or replace function public.reject_join_request(p_member_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare m record;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into m from public.group_members where id = p_member_id;
  if m.id is null then return jsonb_build_object('ok', false, 'error', 'Request not found.'); end if;
  if not (public.can_manage_money(m.group_id) or public.is_group_creator(m.group_id)) then
    raise exception 'Only the Chairperson or Treasurer can decline requests';
  end if;
  if m.status <> 'inactive' then return jsonb_build_object('ok', false, 'error', 'That person is not a pending request.'); end if;
  delete from public.group_members where id = p_member_id;
  return jsonb_build_object('ok', true, 'groupId', m.group_id);
end $$;
grant execute on function public.reject_join_request(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2) Projects & investments
-- ---------------------------------------------------------------------
create table if not exists public.projects (
  id               uuid primary key default gen_random_uuid(),
  group_id         uuid not null references public.groups(id) on delete cascade,
  title            text not null,
  description      text default '',
  category         text not null default 'Investment',
  target_budget    numeric(14,2) not null default 0,
  allocated_amount numeric(14,2) not null default 0,
  status           text not null default 'active',   -- active | funded | completed
  target_date      date,
  milestones       jsonb not null default '[]'::jsonb,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists projects_group_idx on public.projects(group_id, created_at desc);

drop trigger if exists set_projects_updated on public.projects;
create trigger set_projects_updated before update on public.projects for each row execute function public.set_updated_at();

alter table public.projects enable row level security;
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select
  using (public.is_group_member(group_id));
drop policy if exists projects_write on public.projects;
create policy projects_write on public.projects for all
  using (public.can_manage_money(group_id))
  with check (public.can_manage_money(group_id));

-- ---------------------------------------------------------------------
-- 3) Merry-go-round roster (Treasurer can disburse, so not via groups_update)
-- ---------------------------------------------------------------------
create or replace function public.set_group_rotation(p_group uuid, p_rotation jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_money(p_group) then raise exception 'Only the Chairperson or Treasurer can change the roster'; end if;
  update public.groups set rotation = p_rotation where id = p_group;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.set_group_rotation(uuid, jsonb) to authenticated;

-- Realtime for the new table.
do $$ begin
  begin execute 'alter publication supabase_realtime add table public.projects';
  exception when duplicate_object then null; when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.payments';
  exception when duplicate_object then null; when others then null; end;
end $$;

-- ---------------------------------------------------------------------
-- 4) In-app account deletion (Google Play User Data policy)
--    Deletes the login and personal profile. Chamas the user created are
--    handed to the next officer/member, or deleted if nobody else is in
--    them. The group's shared ledger keeps the member's name for the
--    group's accounting, but the phone number is erased and the row is
--    unlinked from any account.
-- ---------------------------------------------------------------------
create or replace function public.delete_my_account()
returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  me   uuid := auth.uid();
  g    record;
  heir uuid;
begin
  if me is null then raise exception 'Not signed in'; end if;

  for g in select id from public.groups where created_by = me loop
    select m.user_id into heir
      from public.group_members m
     where m.group_id = g.id and m.user_id is not null and m.user_id <> me and m.status = 'active'
     order by case m.role when 'Chairperson' then 0 when 'Treasurer' then 1 when 'Secretary' then 2 else 3 end, m.joined_at
     limit 1;
    if heir is null then
      delete from public.groups where id = g.id;
    else
      update public.groups set created_by = heir where id = g.id;
      if not exists (select 1 from public.group_members
                      where group_id = g.id and role = 'Chairperson' and status = 'active'
                        and user_id is not null and user_id <> me) then
        update public.group_members set role = 'Chairperson' where group_id = g.id and user_id = heir;
      end if;
    end if;
  end loop;

  update public.contributions   set recorded_by  = null where recorded_by  = me;
  update public.loan_repayments set recorded_by  = null where recorded_by  = me;
  update public.payments        set reported_by  = null where reported_by  = me;
  update public.payments        set confirmed_by = null where confirmed_by = me;
  update public.projects        set created_by   = null where created_by   = me;

  delete from public.group_members where user_id = me and status = 'inactive';
  update public.group_members set user_id = null, phone = '', status = 'removed' where user_id = me;

  delete from auth.users where id = me;   -- cascades to profiles & personal notifications
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.delete_my_account() to authenticated;
