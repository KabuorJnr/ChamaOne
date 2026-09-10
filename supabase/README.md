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
editor and run each migration in order: `migrations/0001_init.sql`, then
`migrations/0002_join_and_realtime.sql` (join codes, the self-join RPC,
realtime), `migrations/0003_payments.sql` (payment confirmation), and
`migrations/0004_member_invites.sql` (per-member invite codes). Run
only the ones you haven't applied yet.

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

## Payments (confirmation API)

No card/mobile-money gateway is wired yet. Instead there's a provider-agnostic
seam:

1. A payment is **reported** as a `pending` row in `payments` — either in-app
   by a member ("I've paid", with their M-Pesa code) or by the
   `payment-webhook` Edge Function when any external system posts one.
2. A **Treasurer/Chairperson confirms** it in-app → the `confirm_payment` RPC
   atomically writes the contribution + its ledger row. (Reject is also an RPC.)

### Deploy the webhook (optional, only when you want an external caller)

Requires the Supabase CLI, logged in and linked (`supabase link --project-ref
<ref>`):

```bash
supabase secrets set PAYMENT_WEBHOOK_SECRET=<a-long-random-string>
supabase functions deploy payment-webhook --no-verify-jwt
```

Then any gateway/bank/SMS-forwarder (or a test `curl`) can report a payment:

```bash
curl -X POST https://<project-ref>.functions.supabase.co/payment-webhook \
  -H "x-webhook-secret: <the secret>" -H "content-type: application/json" \
  -d '{"code":"7QK2M9","amount":2000,"phone":"254712345678","provider":"mpesa","provider_ref":"RGH12ABC"}'
```

It creates a `pending` payment (matching the member by phone when it can); the
treasurer confirms it in the app. Wiring Daraja/Flutterwave later is just
mapping their callback to this same POST — no schema or app changes.

## Design notes

- **Members vs. users:** `group_members.user_id` is nullable — a person can be
  added by phone before they have an account, and links to their `profiles`
  row once they join.
- **Ledger is append-only** at the policy level (insert, no update/delete).
  When the store is wired over, money actions should write the money row and
  its ledger row together via a `SECURITY DEFINER` RPC so they stay atomic.
- RLS helper functions are `SECURITY DEFINER` to avoid policy recursion on
  `group_members`.
