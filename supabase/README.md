# ChamaOne — Supabase backend

The shared backend for ChamaOne: real accounts (Supabase Auth) and
cross-member sync guarded by Row Level Security. The app still runs fully
offline on `localStorage` today (`src/store/chama.js`); this is the
foundation the data layer moves onto next.

## Configure the app

1. Copy `.env.example` to `.env` in the project root.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from your project
   (Supabase dashboard → Project Settings → API). The **anon** key only —
   never the `service_role` key.

`src/lib/supabase.js` reads these. If unset, the app stays local-only and
nothing breaks.

## Apply the schema

**Option A — SQL editor (quickest):** open the Supabase dashboard → SQL
editor and run each migration in order: first `migrations/0001_init.sql`,
then `migrations/0002_join_and_realtime.sql` (join codes, the self-join RPC,
and realtime). If you already ran 0001, just run 0002.

**Option B — Supabase CLI:**
```bash
supabase link --project-ref <your-ref>
supabase db push
```

## What the migration creates

- **Tables:** `profiles`, `groups`, `group_members`, `cycles`,
  `contributions`, `loans`, `loan_votes`, `loan_repayments`, `meetings`,
  `motions`, `motion_votes`, `ledger`, `notifications` — mirroring the shapes
  in `store/chama.js`.
- **Tenancy:** every row hangs off a `group_id`. A user only sees/writes data
  for groups they are an active member of.
- **Roles:** money actions (contributions, loan disbursement/repayment,
  cycles, ledger) require **Chairperson/Treasurer**; meetings & motions
  require **Chairperson/Secretary**; any member can apply for a loan and cast
  their own vote.
- **Auth glue:** a trigger auto-creates a `profiles` row on sign-up.

## Design notes

- **Members vs. users:** `group_members.user_id` is nullable — a person can be
  added by phone before they have an account, and links to their `profiles`
  row once they join.
- **Ledger is append-only** at the policy level (insert, no update/delete).
  When the store is wired over, money actions should write the money row and
  its ledger row together via a `SECURITY DEFINER` RPC so they stay atomic.
- RLS helper functions are `SECURITY DEFINER` to avoid policy recursion on
  `group_members`.
