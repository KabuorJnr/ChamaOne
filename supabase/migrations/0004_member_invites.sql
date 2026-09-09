-- =====================================================================
-- ChamaOne — 0004_member_invites.sql
-- Per-member invite codes.
--
-- When the chairperson adds a member they get their OWN one-time code,
-- shared to their WhatsApp number. The member signs up (their own name +
-- password), enters the code, and is linked to exactly that member row —
-- so their history (contributions, loans) is already theirs.
-- =====================================================================

alter table public.group_members add column if not exists invite_code text;

update public.group_members
  set invite_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
  where invite_code is null;

create unique index if not exists group_members_invite_code_uidx
  on public.group_members(invite_code);

-- One entry point: accepts a member invite code OR a group-wide join code.
create or replace function public.join_by_code(p_code text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  code    text := upper(trim(p_code));
  m_id    uuid; m_group uuid; m_user uuid; m_name text; m_phone text;
  g_id    uuid; existing uuid; prof record;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if code = '' then raise exception 'Enter an invite code'; end if;

  select full_name, phone into prof from public.profiles where id = auth.uid();

  -- 1) Member-specific invite code → claim that exact member row.
  select id, group_id, user_id, name, phone
    into m_id, m_group, m_user, m_name, m_phone
    from public.group_members
   where upper(invite_code) = code and status <> 'removed'
   limit 1;

  if m_id is not null then
    if m_user is not null and m_user <> auth.uid() then
      raise exception 'That invite code has already been used';
    end if;
    update public.group_members
       set user_id = auth.uid(),
           status  = 'active',
           name    = coalesce(nullif(m_name, ''), nullif(prof.full_name, ''), 'Member'),
           phone   = coalesce(nullif(m_phone, ''), prof.phone, '')
     where id = m_id;
    return m_group;
  end if;

  -- 2) Otherwise treat it as the group-wide join code.
  select id into g_id from public.groups where upper(join_code) = code;
  if g_id is null then raise exception 'Invalid invite code'; end if;

  select id into existing from public.group_members
   where group_id = g_id and user_id = auth.uid() and status <> 'removed' limit 1;
  if existing is not null then return g_id; end if;

  insert into public.group_members (group_id, user_id, name, phone, role, status)
    values (g_id, auth.uid(), coalesce(nullif(prof.full_name, ''), 'Member'), coalesce(prof.phone, ''), 'Member', 'active');
  return g_id;
end $$;

grant execute on function public.join_by_code(text) to authenticated;
