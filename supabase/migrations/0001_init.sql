-- =====================================================================
-- ChamaOne — 0001_init.sql
-- Initial schema + Row Level Security for the shared backend.
--
-- Mirrors store/chama.js: each Chama is a tenant (group_id). Members belong
-- to groups; contributions, loans, meetings, the ledger and notifications all
-- hang off a group. RLS ensures a signed-in user only ever sees/writes data
-- for groups they are an active member of, with money & governance actions
-- gated by officer role.
--
-- Apply via the Supabase SQL editor or the CLI (see supabase/README.md).
-- =====================================================================

-- Enums -----------------------------------------------------------------
do $$ begin
  create type member_role   as enum ('Chairperson', 'Treasurer', 'Secretary', 'Member');
exception when duplicate_object then null; end $$;
do $$ begin
  create type member_status as enum ('active', 'inactive', 'removed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type ledger_dir    as enum ('in', 'out');
exception when duplicate_object then null; end $$;
do $$ begin
  create type vote_choice   as enum ('yes', 'no', 'abstain');
exception when duplicate_object then null; end $$;

-- Shared updated_at trigger ---------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- =====================================================================
-- Tables
-- =====================================================================

-- One row per authenticated user (mirrors auth.users).
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  phone      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.groups (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  type                text not null default 'Savings Group',
  contribution_amount numeric(14,2) not null default 0,
  frequency           text not null default 'monthly',   -- daily | weekly | monthly
  currency            text not null default 'KES',
  loan_interest       numeric(6,2) not null default 10,   -- percent
  active_cycle_id     uuid,                                -- soft ref to cycles.id
  created_by          uuid not null references auth.users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists groups_created_by_idx on public.groups(created_by);

-- A member record. user_id is NULL for people invited/added but not yet on an
-- account; it links to a profile once they join.
create table if not exists public.group_members (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null,
  name       text not null,
  phone      text,
  role       member_role   not null default 'Member',
  status     member_status not null default 'active',
  joined_at  timestamptz not null default now()
);
create unique index if not exists group_members_group_user_uidx
  on public.group_members(group_id, user_id) where user_id is not null;
create index if not exists group_members_group_idx on public.group_members(group_id);
create index if not exists group_members_user_idx  on public.group_members(user_id);

create table if not exists public.cycles (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  label      text not null,
  start_date timestamptz not null default now(),
  end_date   timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists cycles_group_idx on public.cycles(group_id);

create table if not exists public.contributions (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  member_id   uuid not null references public.group_members(id) on delete cascade,
  cycle_id    uuid references public.cycles(id) on delete set null,
  amount      numeric(14,2) not null,
  method      text not null default 'cash',   -- cash | bank | mpesa | other
  ref         text default '',
  status      text not null default 'confirmed',
  date        timestamptz not null default now(),
  recorded_by uuid references auth.users(id)
);
create index if not exists contributions_group_idx on public.contributions(group_id);
create index if not exists contributions_cycle_idx on public.contributions(cycle_id);

create table if not exists public.loans (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.groups(id) on delete cascade,
  member_id     uuid not null references public.group_members(id) on delete cascade,
  principal     numeric(14,2) not null,
  interest_rate numeric(6,2) not null default 10,
  term_months   int not null default 1,
  purpose       text default '',
  status        text not null default 'pending',  -- pending|approved|rejected|active|repaid
  applied_at    timestamptz not null default now(),
  disbursed_at  timestamptz,
  updated_at    timestamptz not null default now()
);
create index if not exists loans_group_idx on public.loans(group_id);

create table if not exists public.loan_votes (
  id               uuid primary key default gen_random_uuid(),
  loan_id          uuid not null references public.loans(id) on delete cascade,
  voter_member_id  uuid not null references public.group_members(id) on delete cascade,
  vote             vote_choice not null,
  created_at       timestamptz not null default now(),
  unique(loan_id, voter_member_id)
);

create table if not exists public.loan_repayments (
  id          uuid primary key default gen_random_uuid(),
  loan_id     uuid not null references public.loans(id) on delete cascade,
  amount      numeric(14,2) not null,
  date        timestamptz not null default now(),
  recorded_by uuid references auth.users(id)
);

create table if not exists public.meetings (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  title      text not null,
  date       timestamptz not null default now(),
  online     boolean not null default false,
  link       text default '',
  location   text default '',
  agenda     jsonb not null default '[]'::jsonb,
  minutes    text default '',
  status     text not null default 'scheduled',  -- scheduled | completed
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists meetings_group_idx on public.meetings(group_id);

create table if not exists public.motions (
  id         uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  text       text not null,
  status     text not null default 'open',  -- open | passed | failed
  created_at timestamptz not null default now()
);

create table if not exists public.motion_votes (
  id              uuid primary key default gen_random_uuid(),
  motion_id       uuid not null references public.motions(id) on delete cascade,
  voter_member_id uuid not null references public.group_members(id) on delete cascade,
  vote            vote_choice not null,
  created_at      timestamptz not null default now(),
  unique(motion_id, voter_member_id)
);

-- Append-only audit trail. Every money movement writes one row.
create table if not exists public.ledger (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.groups(id) on delete cascade,
  type          text not null,               -- Contribution | Loan disbursement | ...
  amount        numeric(14,2) not null,
  direction     ledger_dir not null,
  member_id     uuid references public.group_members(id) on delete set null,
  note          text default '',
  ref           text default '',
  balance_after numeric(14,2),
  date          timestamptz not null default now()
);
create index if not exists ledger_group_idx on public.ledger(group_id, date desc);

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete cascade,  -- NULL = whole group
  type       text not null,
  text       text not null,
  read       boolean not null default false,
  date       timestamptz not null default now()
);
create index if not exists notifications_group_idx on public.notifications(group_id, date desc);

-- updated_at triggers
drop trigger if exists set_profiles_updated  on public.profiles;
create trigger set_profiles_updated  before update on public.profiles  for each row execute function public.set_updated_at();
drop trigger if exists set_groups_updated    on public.groups;
create trigger set_groups_updated    before update on public.groups    for each row execute function public.set_updated_at();
drop trigger if exists set_loans_updated     on public.loans;
create trigger set_loans_updated     before update on public.loans     for each row execute function public.set_updated_at();
drop trigger if exists set_meetings_updated  on public.meetings;
create trigger set_meetings_updated  before update on public.meetings  for each row execute function public.set_updated_at();

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', ''),
          coalesce(new.raw_user_meta_data->>'phone', new.phone))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- =====================================================================
-- RLS helper functions (SECURITY DEFINER — bypass RLS to avoid recursion)
-- =====================================================================
create or replace function public.is_group_member(g uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = g and m.user_id = auth.uid() and m.status <> 'removed'
  );
$$;

create or replace function public.group_role(g uuid)
returns member_role language sql security definer stable set search_path = public as $$
  select m.role from public.group_members m
  where m.group_id = g and m.user_id = auth.uid() and m.status <> 'removed'
  limit 1;
$$;

-- Money & disbursement actions: Chairperson or Treasurer.
create or replace function public.can_manage_money(g uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select public.group_role(g) in ('Chairperson', 'Treasurer');
$$;

-- Governance (meetings, motions): Chairperson or Secretary.
create or replace function public.can_manage_meetings(g uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select public.group_role(g) in ('Chairperson', 'Secretary');
$$;

-- The caller's membership id in a group (for "cast only your own vote").
create or replace function public.my_member_id(g uuid)
returns uuid language sql security definer stable set search_path = public as $$
  select m.id from public.group_members m
  where m.group_id = g and m.user_id = auth.uid() and m.status <> 'removed'
  limit 1;
$$;

-- =====================================================================
-- Enable RLS
-- =====================================================================
alter table public.profiles        enable row level security;
alter table public.groups          enable row level security;
alter table public.group_members   enable row level security;
alter table public.cycles          enable row level security;
alter table public.contributions   enable row level security;
alter table public.loans           enable row level security;
alter table public.loan_votes      enable row level security;
alter table public.loan_repayments enable row level security;
alter table public.meetings        enable row level security;
alter table public.motions         enable row level security;
alter table public.motion_votes    enable row level security;
alter table public.ledger          enable row level security;
alter table public.notifications   enable row level security;

-- ---- profiles ----
create policy profiles_select_self on public.profiles for select
  using (id = auth.uid());
create policy profiles_update_self on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- ---- groups ----
create policy groups_select on public.groups for select
  using (public.is_group_member(id));
create policy groups_insert on public.groups for insert
  with check (created_by = auth.uid());
create policy groups_update on public.groups for update
  using (public.group_role(id) = 'Chairperson')
  with check (public.group_role(id) = 'Chairperson');
create policy groups_delete on public.groups for delete
  using (public.group_role(id) = 'Chairperson');

-- ---- group_members ----
-- The group creator seeds the initial roster (incl. themselves as Chairperson);
-- thereafter officers manage members.
create policy members_select on public.group_members for select
  using (public.is_group_member(group_id));
create policy members_insert on public.group_members for insert
  with check (
    public.can_manage_money(group_id)
    or exists (select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid())
  );
create policy members_update on public.group_members for update
  using (public.can_manage_money(group_id))
  with check (public.can_manage_money(group_id));
create policy members_delete on public.group_members for delete
  using (public.can_manage_money(group_id));

-- ---- cycles ----
create policy cycles_select on public.cycles for select
  using (public.is_group_member(group_id));
create policy cycles_write on public.cycles for all
  using (public.can_manage_money(group_id))
  with check (public.can_manage_money(group_id));

-- ---- contributions ----
create policy contributions_select on public.contributions for select
  using (public.is_group_member(group_id));
create policy contributions_write on public.contributions for all
  using (public.can_manage_money(group_id))
  with check (public.can_manage_money(group_id));

-- ---- loans ----
-- Any member may apply (insert a pending loan for their own membership);
-- officers manage status/disbursement.
create policy loans_select on public.loans for select
  using (public.is_group_member(group_id));
create policy loans_insert on public.loans for insert
  with check (public.is_group_member(group_id));
create policy loans_update on public.loans for update
  using (public.can_manage_money(group_id))
  with check (public.can_manage_money(group_id));
create policy loans_delete on public.loans for delete
  using (public.can_manage_money(group_id));

-- ---- loan_votes ---- (any member casts their OWN vote)
create policy loan_votes_select on public.loan_votes for select
  using (exists (select 1 from public.loans l where l.id = loan_id and public.is_group_member(l.group_id)));
create policy loan_votes_upsert on public.loan_votes for all
  using (exists (
    select 1 from public.loans l join public.group_members m on m.id = voter_member_id
    where l.id = loan_id and m.group_id = l.group_id and m.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.loans l join public.group_members m on m.id = voter_member_id
    where l.id = loan_id and m.group_id = l.group_id and m.user_id = auth.uid()
  ));

-- ---- loan_repayments ----
create policy loan_repayments_select on public.loan_repayments for select
  using (exists (select 1 from public.loans l where l.id = loan_id and public.is_group_member(l.group_id)));
create policy loan_repayments_write on public.loan_repayments for all
  using (exists (select 1 from public.loans l where l.id = loan_id and public.can_manage_money(l.group_id)))
  with check (exists (select 1 from public.loans l where l.id = loan_id and public.can_manage_money(l.group_id)));

-- ---- meetings ----
create policy meetings_select on public.meetings for select
  using (public.is_group_member(group_id));
create policy meetings_write on public.meetings for all
  using (public.can_manage_meetings(group_id))
  with check (public.can_manage_meetings(group_id));

-- ---- motions ----
create policy motions_select on public.motions for select
  using (exists (select 1 from public.meetings mt where mt.id = meeting_id and public.is_group_member(mt.group_id)));
create policy motions_write on public.motions for all
  using (exists (select 1 from public.meetings mt where mt.id = meeting_id and public.can_manage_meetings(mt.group_id)))
  with check (exists (select 1 from public.meetings mt where mt.id = meeting_id and public.can_manage_meetings(mt.group_id)));

-- ---- motion_votes ---- (any member casts their OWN vote)
create policy motion_votes_select on public.motion_votes for select
  using (exists (
    select 1 from public.motions mo join public.meetings mt on mt.id = mo.meeting_id
    where mo.id = motion_id and public.is_group_member(mt.group_id)));
create policy motion_votes_upsert on public.motion_votes for all
  using (exists (
    select 1 from public.motions mo join public.meetings mt on mt.id = mo.meeting_id
      join public.group_members m on m.id = voter_member_id
    where mo.id = motion_id and m.group_id = mt.group_id and m.user_id = auth.uid()))
  with check (exists (
    select 1 from public.motions mo join public.meetings mt on mt.id = mo.meeting_id
      join public.group_members m on m.id = voter_member_id
    where mo.id = motion_id and m.group_id = mt.group_id and m.user_id = auth.uid()));

-- ---- ledger ---- (read by members; written by money managers — append only)
create policy ledger_select on public.ledger for select
  using (public.is_group_member(group_id));
create policy ledger_insert on public.ledger for insert
  with check (public.can_manage_money(group_id));

-- ---- notifications ---- (members read the group's; user-targeted rows only theirs)
create policy notifications_select on public.notifications for select
  using (public.is_group_member(group_id) and (user_id is null or user_id = auth.uid()));
create policy notifications_insert on public.notifications for insert
  with check (public.is_group_member(group_id));
create policy notifications_update on public.notifications for update
  using (public.is_group_member(group_id) and (user_id is null or user_id = auth.uid()))
  with check (public.is_group_member(group_id) and (user_id is null or user_id = auth.uid()));
