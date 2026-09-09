// =====================================================================
// ChamaOne — payment-webhook Edge Function
//
// A provider-agnostic endpoint that records an incoming payment as a PENDING
// row in public.payments, which a Treasurer/Chairperson then confirms in-app
// (turning it into a contribution + ledger entry via confirm_payment).
//
// No gateway is wired yet — this is the seam. A future Daraja/Flutterwave
// integration (or a bank/SMS forwarder, or a manual curl) only needs to POST
// the shape below. It uses the service role, so it bypasses RLS; access is
// gated by a shared secret header instead.
//
// Deploy:
//   supabase secrets set PAYMENT_WEBHOOK_SECRET=<a-long-random-string>
//   supabase functions deploy payment-webhook --no-verify-jwt
//
// Call:
//   POST https://<project-ref>.functions.supabase.co/payment-webhook
//   Header:  x-webhook-secret: <the secret>
//   Body (JSON):
//   { "code": "7QK2M9",        // group join code  (or "group_id": "<uuid>")
//     "amount": 2000,
//     "phone": "254712345678", // payer phone (optional; used to match a member)
//     "provider": "mpesa",     // optional label
//     "provider_ref": "RGH12ABC", // M-Pesa code / gateway reference
//     "note": "", "raw": { } } // raw = original provider payload (optional)
// =====================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-webhook-secret',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const secret = Deno.env.get('PAYMENT_WEBHOOK_SECRET');
  if (!secret) return json({ error: 'Webhook not configured' }, 500);
  if (req.headers.get('x-webhook-secret') !== secret) return json({ error: 'Unauthorized' }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const amount = Number(body.amount);
  if (!amount || amount <= 0) return json({ error: 'amount is required' }, 400);
  const phone = body.phone ? String(body.phone) : null;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Resolve the group by explicit id or by join code.
  let groupId = body.group_id ? String(body.group_id) : null;
  if (!groupId && body.code) {
    const { data } = await supabase.from('groups').select('id').ilike('join_code', String(body.code)).maybeSingle();
    groupId = data?.id ?? null;
  }
  if (!groupId) return json({ error: 'Unknown group (pass code or group_id)' }, 404);

  // Best-effort: match a member by phone within the group.
  let memberId: string | null = null;
  if (phone) {
    const { data } = await supabase.from('group_members')
      .select('id').eq('group_id', groupId).eq('phone', phone).neq('status', 'removed').maybeSingle();
    memberId = data?.id ?? null;
  }

  const { data: inserted, error } = await supabase.from('payments').insert({
    group_id: groupId,
    member_id: memberId,
    amount,
    phone,
    provider: body.provider ? String(body.provider) : 'manual',
    provider_ref: body.provider_ref ? String(body.provider_ref) : '',
    status: 'pending',
    note: body.note ? String(body.note) : '',
    raw: body.raw ?? body,
  }).select('id').single();

  if (error) return json({ error: error.message }, 400);
  return json({ ok: true, payment_id: inserted.id, matched_member: Boolean(memberId) });
});
