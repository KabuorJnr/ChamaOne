-- =====================================================================
-- ChamaOne — 0002_join_and_realtime.sql
-- Member invite/join by code + realtime sync.
--
-- Adds a shareable join code to each group, a SECURITY DEFINER RPC that lets
-- a signed-in user join a group by code (claiming a phone-matched slot if one
-- exists, else creating their own member row — this is the ONE way a
-- non-officer may add themselves, which normal RLS forbids), and puts the
-- tables on the realtime publication so members see each other's changes live.
-- =====================================================================

-- 1) Join code -----------------------------------------------------------
alter table public.groups add column if not exists join_code text;

-- Backfill any existing groups, then enforce uniqueness.
update public.groups set join_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
  where join_code is null;
create unique index if not exists groups_join_code_uidx on public.groups(join_code);

-- 2) Self-join RPC -------------------------------------------------------
create or replace function public.join_group_by_code(p_code text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  g_id     uuid;
  prof     record;
  existing uuid;
  slot     uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;

  select id into g_id from public.groups where upper(join_code) = upper(trim(p_code));
  if g_id is null then raise exception 'Invalid join code'; end if;

  -- Already a member? Just return the group.
  select id into existing from public.group_members
    where group_id = g_id and user_id = auth.uid() and status <> 'removed' limit 1;
  if existing is not null then return g_id; end if;

  select full_name, phone into prof from public.profiles where id = auth.uid();

  -- Claim a phone-matched, not-yet-linked slot if the chairperson pre-added them.
  if coalesce(prof.phone, '') <> '' then
    select id into slot from public.group_members
      where group_id = g_id and user_id is null and phone = prof.phone and status <> 'removed'
      limit 1;
  end if;

  if slot is not null then
    update public.group_members set user_id = auth.uid(), status = 'active' where id = slot;
  else
    insert into public.group_members (group_id, user_id, name, phone, role, status)
      values (g_id, auth.uid(), coalesce(nullif(prof.full_name, ''), 'Member'), coalesce(prof.phone, ''), 'Member', 'active');
  end if;

  return g_id;
end $$;

grant execute on function public.join_group_by_code(text) to authenticated;

-- 3) Realtime ------------------------------------------------------------
-- Add each table to the supabase_realtime publication (idempotent).
do $$
declare t text;
begin
  foreach t in array array[
    'groups','group_members','cycles','contributions','loans','loan_votes',
    'loan_repayments','meetings','motions','motion_votes','ledger','notifications'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null; when others then null;
    end;
  end loop;
end $$;
