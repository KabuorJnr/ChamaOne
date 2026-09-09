# ChamaOne — Build Plan (v1)

ChamaOne is a digital management platform for **chamas** (Kenyan savings &
investment groups). It replaces the treasurer's paper ledger with an
offline-first app that tracks members, contributions, loans, meetings, and
fines — with transparent statements every member can see.

> **v1 decisions (locked)**
> - **Stack:** reuse the DigiShule stack — React + Vite + Tailwind, Supabase
>   (Postgres / Auth / RLS), offline-first PWA, Capacitor for mobile.
> - **Scope:** Members & roles, Contributions, Loans, Meetings & fines — all in v1.
> - **Payments:** manual entry in v1 (treasurer records cash/transfer);
>   M-Pesa Daraja integration is a later phase.

---

## 1. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React 18 + Vite + Tailwind | Matches DigiShule; fast HMR, small bundles |
| State/data | Supabase JS client + React Query (or light custom hooks) | |
| Backend | Supabase (Postgres + Auth + RLS + Edge Functions) | No separate server to run |
| Offline | PWA + IndexedDB cache + background sync | Chamas meet where connectivity is poor |
| Mobile | Capacitor (Android first, iOS later) | Same web build wrapped natively |
| Auth | Supabase Auth (phone/email + OTP) | Phone-first fits the audience |
| Notifications (later) | Africa's Talking SMS | Payment reminders, meeting alerts |
| Payments (later) | Safaricom Daraja — STK push (C2B), B2C payouts | Phase 3 |

---

## 2. Roles & permissions

A chama is the tenant. Every user belongs to one or more chamas, each with a role:

- **Chairperson** — full visibility, approves loans, manages members.
- **Treasurer** — records contributions, disbursements, loans, fines; owns the books.
- **Secretary** — records meetings, minutes, attendance.
- **Member** — views own statement, group balances, meeting minutes; requests loans.

Permissions are enforced by **Postgres Row Level Security**, so a user can only
read/write rows for chamas they belong to, at the level their role allows.

---

## 3. Domain model

```
chama (group)
 ├── membership (user ↔ chama, with role + join date + status)
 ├── contribution_cycle (e.g. "Monthly dues", amount, frequency, due day)
 │    └── contribution (member payment against a cycle: amount, date, method, recorded_by)
 ├── loan (borrower, principal, interest %, issue date, schedule, status)
 │    ├── loan_guarantor (member backing the loan)
 │    └── loan_repayment (amount, date, recorded_by)
 ├── fine (member, reason, amount, status: pending/paid/waived)
 ├── meeting (date, venue, agenda, minutes)
 │    └── attendance (member ↔ meeting: present/absent/apology)
 └── transaction (unified ledger entry — see §5)
```

---

## 4. Database schema (Supabase / Postgres)

Tables (all with `id uuid pk`, `created_at`, `updated_at`, and RLS enabled):

1. **profiles** — `id (=auth.uid)`, full_name, phone, email, avatar_url.
2. **chamas** — name, description, registration_no, currency (default `KES`),
   created_by.
3. **memberships** — chama_id, user_id, role enum, status enum
   (`active/inactive/exited`), joined_at. Unique `(chama_id, user_id)`.
4. **contribution_cycles** — chama_id, name, amount, frequency
   (`weekly/monthly/custom`), due_day, active bool.
5. **contributions** — chama_id, cycle_id, member_id, amount, paid_on,
   method (`cash/bank/mpesa/other`), reference, recorded_by, notes.
6. **loans** — chama_id, borrower_id, principal, interest_rate,
   interest_method (`flat/reducing`), issued_on, due_on, status
   (`pending/approved/active/repaid/defaulted`), approved_by.
7. **loan_guarantors** — loan_id, member_id, amount_guaranteed.
8. **loan_repayments** — loan_id, amount, paid_on, method, recorded_by.
9. **fines** — chama_id, member_id, reason, amount, status
   (`pending/paid/waived`), issued_on, resolved_on.
10. **meetings** — chama_id, title, held_on, venue, agenda, minutes.
11. **attendance** — meeting_id, member_id, status (`present/absent/apology`).
12. **transactions** *(ledger, §5)* — chama_id, type, amount, direction
    (`in/out`), source_table, source_id, occurred_on, recorded_by.

**RLS pattern:** a helper `is_member_of(chama_id)` and `role_in(chama_id)` used
in policies. Reads: any active member of the chama. Writes: gated by role
(treasurer for money, secretary for meetings, chairperson/treasurer for members).

Delivered as ordered SQL migrations under `supabase/migrations/`.

---

## 5. The ledger (single source of truth)

Contributions in, loan disbursements out, repayments in, fines in — every money
movement writes a row to **transactions**. Member statements and the group
balance are derived by summing the ledger, never by hand-editing a balance
field. This keeps the books auditable and reconcilable, and makes the later
M-Pesa integration a matter of *writing ledger rows*, not reworking the schema.

---

## 6. Feature modules (v1)

1. **Onboarding & groups** — sign up (phone/email + OTP), create a chama, invite
   members, assign roles.
2. **Members** — directory, roles, status, per-member profile & statement.
3. **Contributions** — define cycles, record payments, arrears view (who owes
   what), per-member & group statements.
4. **Loans** — request → approve → disburse → repay; schedule & balance;
   guarantors; overdue flags.
5. **Meetings & fines** — schedule meetings, record attendance & minutes, issue
   and clear fines.
6. **Dashboard** — group balance, total savings, outstanding loans, arrears,
   upcoming meeting — role-aware.
7. **Offline** — cache the active chama's data; queue writes and sync when back
   online.

---

## 7. App structure

```
src/
 ├── lib/           supabase client, offline sync, auth context
 ├── components/    shared UI (cards, tables, forms, layout, nav)
 ├── features/
 │    ├── auth/
 │    ├── chamas/
 │    ├── members/
 │    ├── contributions/
 │    ├── loans/
 │    ├── meetings/
 │    └── fines/
 ├── pages/         route-level screens
 ├── hooks/         data hooks (useContributions, useLoans, …)
 ├── data/          enums, constants (roles, methods, frequencies)
 └── tests/         Vitest unit + integration
supabase/
 ├── migrations/    ordered SQL
 └── seed.sql       demo chama + members for local dev
```

Routing: `/` dashboard · `/members` · `/contributions` · `/loans` ·
`/meetings` · `/fines` · `/settings`. A chama switcher in the header for users
in multiple groups.

---

## 8. Phased roadmap

**Phase 0 — Scaffold** *(first build step)*
Vite + React + Tailwind project, Supabase client, auth shell, base layout,
routing, lint + Vitest, PWA manifest. Commit a running skeleton.

**Phase 1 — Data foundation**
Migrations for all tables + RLS policies + `seed.sql`. Auth + chama
creation/switching working end to end.

**Phase 2 — Core modules**
Members → Contributions → Loans → Meetings & fines, each with UI, data hooks,
and tests. Dashboard last, once the numbers exist to show.

**Phase 3 — Offline & mobile**
IndexedDB cache, write queue + background sync, Capacitor Android build.

**Phase 4 — Integrations (post-v1)**
M-Pesa Daraja (STK push for contributions, B2C payouts), Africa's Talking SMS
reminders, PDF statements/reports.

---

## 9. Security

- RLS on every table — no client ever reads another chama's data.
- Role checks enforced in the database, not just the UI.
- Money-writing operations (contributions, disbursements, repayments) go through
  RPCs that also write the ledger row atomically.
- No secrets in the repo; `.env.example` documents required keys.

---

## 10. Immediate next step

On approval: **Phase 0** — scaffold the project and push a running skeleton to
`KabuorJnr/ChamaOne`, then move into Phase 1 migrations.
