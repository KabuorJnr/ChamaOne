-- =====================================================================
-- ChamaOne — 0003_payments.sql
-- Payment confirmation layer (provider-agnostic).
--
-- A `payments` row is a reported payment awaiting confirmation. It can be
-- created two ways:
--   • in-app by a member ("I've paid — here's my M-Pesa code"), or
--   • by the payment-webhook Edge Function when a gateway/bank/M-Pesa
--     notification arrives (service role, provider-agnostic).
-- A Treasurer/Chairperson then confirms it, which atomically writes the
-- contribution + its ledger row (confirm_payment RPC). No gateway is wired
-- yet — the same table/RPC works whether the report comes from a human or an
-- API, so dropping in Daraja/Flutterwave later means only mapping their
-- payload to a payments insert.
-- =====================================================================

create table if not exists public.payments (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null references public.groups(id) on delete cascade,
  member_id       uuid references public.group_members(id) on delete set null, -- may be unknown from a webhook
  amount          numeric(14,2) not null,
  phone           text,
  provider        text not null default 'manual',   -- manual | mpesa | flutterwave | bank | ...
  provider_ref    text default '',                  -- M-Pesa code / gateway reference
  status          text not null default 'pending',  -- pending | confirmed | rejected
  note            text default '',
  raw             jsonb,                             -- original webhook payload, if any
  contribution_id uuid,                              -- set when confirmed
  reported_by     uuid references auth.users(id),    -- in-app reporter; NULL for webhook
  confirmed_by    uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists payments_group_status_idx on public.payments(group_id, status, created_at desc);

drop trigger if exists set_payments_updated on public.payments;
create trigger set_payments_updated before update on public.payments for each row execute function public.set_updated_at();

alter table public.payments enable row level security;

-- Members see their group's payments; a member may report their own; officers
-- manage them. Confirmation goes through the RPC below, not a direct update.
create policy payments_select on public.payments for select
  using (public.is_group_member(group_id));
create policy payments_insert on public.payments for insert
  with check (public.is_group_member(group_id) and reported_by = auth.uid());
create policy payments_update on public.payments for update
  using (public.can_manage_money(group_id))
  with check (public.can_manage_money(group_id));
create policy payments_delete on public.payments for delete
  using (public.can_manage_money(group_id));

-- ---- confirm: create the contribution + ledger row atomically ----------
create or replace function public.confirm_payment(
  p_payment_id uuid,
  p_member_id  uuid,
  p_cycle_id   uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  pay   record;
  bal   numeric;
  c_id  uuid := gen_random_uuid();
  l_id  uuid := gen_random_uuid();
  mname text;
  clabel text;
begin
  select * into pay from public.payments where id = p_payment_id for update;
  if pay is null then raise exception 'Payment not found'; end if;
  if not public.can_manage_money(pay.group_id) then raise exception 'Not allowed'; end if;
  if pay.status <> 'pending' then raise exception 'Payment already %', pay.status; end if;

  select name into mname from public.group_members where id = p_member_id;
  select label into clabel from public.cycles where id = p_cycle_id;

  -- Contribution
  insert into public.contributions (id, group_id, member_id, cycle_id, amount, method, ref, status, date, recorded_by)
    values (c_id, pay.group_id, p_member_id, p_cycle_id, pay.amount,
            case when pay.provider = 'manual' then 'mpesa' else pay.provider end,
            coalesce(pay.provider_ref, ''), 'confirmed', now(), auth.uid());

  -- Ledger (running balance)
  select coalesce(sum(case when direction = 'in' then amount else -amount end), 0)
    into bal from public.ledger where group_id = pay.group_id;
  insert into public.ledger (id, group_id, type, amount, direction, member_id, note, ref, balance_after, date)
    values (l_id, pay.group_id, 'Contribution', pay.amount, 'in', p_member_id,
            coalesce(mname, 'Member') || ' — ' || coalesce(clabel, ''), coalesce(pay.provider_ref, ''),
            bal + pay.amount, now());

  update public.payments
    set status = 'confirmed', confirmed_by = auth.uid(), member_id = p_member_id, contribution_id = c_id
    where id = p_payment_id;

  return c_id;
end $$;
grant execute on function public.confirm_payment(uuid, uuid, uuid) to authenticated;

-- ---- reject -----------------------------------------------------------
create or replace function public.reject_payment(p_payment_id uuid, p_note text default '')
returns void
language plpgsql security definer set search_path = public as $$
declare pay record;
begin
  select * into pay from public.payments where id = p_payment_id for update;
  if pay is null then raise exception 'Payment not found'; end if;
  if not public.can_manage_money(pay.group_id) then raise exception 'Not allowed'; end if;
  if pay.status <> 'pending' then raise exception 'Payment already %', pay.status; end if;
  update public.payments set status = 'rejected', confirmed_by = auth.uid(), note = coalesce(nullif(p_note, ''), note)
    where id = p_payment_id;
end $$;
grant execute on function public.reject_payment(uuid, text) to authenticated;

-- ---- realtime ---------------------------------------------------------
do $$ begin
  begin execute 'alter publication supabase_realtime add table public.payments';
  exception when duplicate_object then null; when others then null; end;
end $$;
