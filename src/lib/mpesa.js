/* =====================================================================
 * ChamaOne — lib/mpesa.js
 * Safaricom Daraja (M-Pesa) integration.
 *   1. SIMULATION (default): mimics the STK-push flow, no backend needed.
 *   2. LIVE: talks to YOUR backend, which proxies Daraja (credentials stay
 *      server-side). Flip Settings → "Simulate M-Pesa" off to use it.
 * Both paths finish by calling recordContribution() so reconciliation is
 * identical whether the receipt is simulated or real.
 * ===================================================================== */
import { recordContribution } from '../store/chama';

const API_BASE = ''; // e.g. 'https://your-project.functions.supabase.co'

export async function requestPayment({ phone, amount, memberId, accountRef, simulate = true, onUpdate }) {
  const emit = (s) => onUpdate && onUpdate(s);
  if (simulate || !API_BASE) return simulateStk({ phone, amount, memberId, emit });
  return liveStk({ phone, amount, memberId, accountRef, emit });
}

function pretty(p) { const s = String(p || ''); return s.startsWith('254') ? '0' + s.slice(3) : s; }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function simulateStk({ phone, amount, memberId, emit }) {
  return new Promise((resolve) => {
    emit({ stage: 'sending', text: `Sending STK push to ${pretty(phone)}…` });
    setTimeout(() => emit({ stage: 'prompted', text: 'Prompt delivered. Waiting for PIN…' }), 900);
    setTimeout(() => {
      const ok = Math.random() > 0.15;
      if (ok) {
        const receipt = 'R' + Math.random().toString(36).slice(2, 9).toUpperCase();
        recordContribution({ memberId, amount, method: 'mpesa', ref: receipt });
        emit({ stage: 'success', receipt, text: `Confirmed. Receipt ${receipt}.` });
        resolve({ ok: true, receipt });
      } else {
        emit({ stage: 'failed', text: 'Request cancelled or timed out.' });
        resolve({ ok: false });
      }
    }, 3200);
  });
}

async function liveStk({ phone, amount, memberId, accountRef, emit }) {
  try {
    emit({ stage: 'sending', text: `Sending STK push to ${pretty(phone)}…` });
    const res = await fetch(`${API_BASE}/stk-push`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, amount, accountRef }),
    });
    const { checkoutRequestId } = await res.json();
    emit({ stage: 'prompted', text: 'Prompt delivered. Waiting for PIN…' });
    for (let i = 0; i < 20; i++) {
      await wait(2500);
      try {
        const j = await (await fetch(`${API_BASE}/stk-status/${checkoutRequestId}`)).json();
        if (j.status === 'success') {
          recordContribution({ memberId, amount, method: 'mpesa', ref: j.receipt });
          emit({ stage: 'success', receipt: j.receipt, text: `Confirmed. Receipt ${j.receipt}.` });
          return { ok: true, receipt: j.receipt };
        }
        if (j.status === 'failed') break;
      } catch { /* keep polling */ }
    }
    emit({ stage: 'failed', text: 'Payment not confirmed.' });
    return { ok: false };
  } catch (e) {
    emit({ stage: 'failed', text: 'Network error reaching M-Pesa backend.' });
    return { ok: false, error: String(e) };
  }
}
