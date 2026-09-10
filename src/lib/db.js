/* =====================================================================
 * ChamaOne — lib/db.js
 * Supabase data-access for the shared backend.
 *
 * The store (store/chama.js) keeps a synchronous in-memory snapshot of the
 * ACTIVE group so screens stay unchanged. This module:
 *   • hydrates that snapshot from Supabase (fetchGroups + loadGroupState),
 *   • mirrors each mutation back to Supabase (the ins/upd/upsert writers).
 *
 * Field mapping: DB is snake_case, the in-memory model is camelCase. The
 * row<->object mappers below are the single place that translation lives.
 * All ids are client-generated UUIDs (see uid() in the store) so the
 * optimistic in-memory row and the persisted row share the same id.
 * ===================================================================== */
import { supabase } from './supabase';

/* ---------- low-level helpers (no-op when unconfigured) ---------- */
async function ins(table, row) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from(table).insert(row);
  if (error) console.error(`[db] insert ${table}`, error.message, row);
  return { error };
}
async function upd(table, id, patch) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from(table).update(patch).eq('id', id);
  if (error) console.error(`[db] update ${table} ${id}`, error.message, patch);
  return { error };
}
async function upsert(table, row, onConflict) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from(table).upsert(row, onConflict ? { onConflict } : undefined);
  if (error) console.error(`[db] upsert ${table}`, error.message, row);
  return { error };
}
async function del(table, id) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) console.error(`[db] delete ${table} ${id}`, error.message);
  return { error };
}

/* ---------- row <-> object mappers ---------- */
const memberToRow = (groupId, m) => ({
  id: m.id, group_id: groupId, user_id: m.userId || null,
  name: m.name, phone: m.phone || '', role: m.role, status: m.status, joined_at: m.joinedAt,
  invite_code: m.inviteCode || null,
});
const rowToMember = (r) => ({
  id: r.id, userId: r.user_id || null, name: r.name, phone: r.phone || '',
  role: r.role, status: r.status, joinedAt: r.joined_at, inviteCode: r.invite_code || '',
});

const cycleToRow = (groupId, c) => ({ id: c.id, group_id: groupId, label: c.label, start_date: c.startDate, end_date: c.endDate });
const rowToCycle = (r) => ({ id: r.id, label: r.label, startDate: r.start_date, endDate: r.end_date });

const contribToRow = (groupId, c, recordedBy) => ({
  id: c.id, group_id: groupId, member_id: c.memberId, cycle_id: c.cycleId,
  amount: c.amount, method: c.method, ref: c.ref || '', status: c.status, date: c.date, recorded_by: recordedBy || null,
});
const rowToContrib = (r) => ({ id: r.id, memberId: r.member_id, cycleId: r.cycle_id, amount: Number(r.amount), method: r.method, ref: r.ref || '', status: r.status, date: r.date });

const loanToRow = (groupId, l) => ({
  id: l.id, group_id: groupId, member_id: l.memberId, principal: l.principal, interest_rate: l.interestRate,
  term_months: l.termMonths, purpose: l.purpose || '', status: l.status, applied_at: l.appliedAt, disbursed_at: l.disbursedAt,
});
const rowToLoan = (r, votes, repayments) => ({
  id: r.id, memberId: r.member_id, principal: Number(r.principal), interestRate: Number(r.interest_rate),
  termMonths: r.term_months, purpose: r.purpose || '', status: r.status, appliedAt: r.applied_at, disbursedAt: r.disbursed_at,
  votes: votes || {}, repayments: repayments || [],
});

const meetingToRow = (groupId, m) => ({
  id: m.id, group_id: groupId, title: m.title, date: m.date, online: m.online, link: m.link || '',
  location: m.location || '', agenda: m.agenda || [], minutes: m.minutes || '', status: m.status,
});
const rowToMeeting = (r, motions) => ({
  id: r.id, title: r.title, date: r.date, online: r.online, link: r.link || '', location: r.location || '',
  agenda: r.agenda || [], minutes: r.minutes || '', status: r.status, motions: motions || [],
});

const ledgerToRow = (groupId, e) => ({
  id: e.id, group_id: groupId, type: e.type, amount: e.amount, direction: e.direction,
  member_id: e.memberId || null, note: e.note || '', ref: e.ref || '', balance_after: e.balanceAfter, date: e.date,
});
const rowToLedger = (r) => ({ id: r.id, type: r.type, amount: Number(r.amount), direction: r.direction, memberId: r.member_id, note: r.note || '', ref: r.ref || '', balanceAfter: Number(r.balance_after), date: r.date });

const notifToRow = (groupId, n) => ({ id: n.id, group_id: groupId, user_id: n.userId || null, type: n.type, text: n.text, read: n.read, date: n.date });
const rowToNotif = (r) => ({ id: r.id, type: r.type, text: r.text, read: r.read, date: r.date });

const rowToPayment = (r) => ({
  id: r.id, memberId: r.member_id, amount: Number(r.amount), phone: r.phone || '',
  provider: r.provider, providerRef: r.provider_ref || '', status: r.status, note: r.note || '',
  reportedBy: r.reported_by, createdAt: r.created_at,
});

const groupToRow = (g, userId) => ({
  id: g.id, name: g.name, type: g.type, contribution_amount: g.contributionAmount, frequency: g.frequency,
  currency: g.currency, loan_interest: g.loanInterest, active_cycle_id: g.activeCycleId,
  join_code: g.joinCode || null, created_by: userId,
});
const rowToGroup = (r) => ({
  id: r.id, name: r.name, type: r.type, contributionAmount: Number(r.contribution_amount), frequency: r.frequency,
  currency: r.currency, loanInterest: Number(r.loan_interest), activeCycleId: r.active_cycle_id,
  joinCode: r.join_code || '', createdAt: r.created_at,
});

/* ---------- read: which groups am I in ---------- */
export async function fetchGroups(userId) {
  if (!supabase) return [];
  const { data: mships, error } = await supabase
    .from('group_members').select('group_id').eq('user_id', userId).neq('status', 'removed');
  if (error) { console.error('[db] fetchGroups memberships', error.message); return []; }
  const ids = [...new Set((mships || []).map((m) => m.group_id))];
  if (!ids.length) return [];
  const { data: groups, error: gerr } = await supabase.from('groups').select('id').in('id', ids);
  if (gerr) { console.error('[db] fetchGroups groups', gerr.message); return []; }
  return groups || [];
}

/* ---------- read: assemble one group's full state ---------- */
export async function loadGroupState(groupId) {
  if (!supabase) return null;
  const [g, members, cycles, contributions, loans, loanVotes, repayments, meetings, motions, motionVotes, ledger, notifications, paymentsRes] =
    await Promise.all([
      supabase.from('groups').select('*').eq('id', groupId).single(),
      supabase.from('group_members').select('*').eq('group_id', groupId),
      supabase.from('cycles').select('*').eq('group_id', groupId),
      supabase.from('contributions').select('*').eq('group_id', groupId),
      supabase.from('loans').select('*').eq('group_id', groupId),
      supabase.from('loan_votes').select('*'),
      supabase.from('loan_repayments').select('*'),
      supabase.from('meetings').select('*').eq('group_id', groupId),
      supabase.from('motions').select('*'),
      supabase.from('motion_votes').select('*'),
      supabase.from('ledger').select('*').eq('group_id', groupId).order('date', { ascending: false }),
      supabase.from('notifications').select('*').eq('group_id', groupId).order('date', { ascending: false }),
      supabase.from('payments').select('*').eq('group_id', groupId).order('created_at', { ascending: false }),
    ]);
  if (g.error) { console.error('[db] loadGroupState', g.error.message); return null; }

  const loanIds = new Set((loans.data || []).map((l) => l.id));
  const votesByLoan = {};
  (loanVotes.data || []).forEach((v) => {
    if (!loanIds.has(v.loan_id)) return;
    (votesByLoan[v.loan_id] ||= {})[v.voter_member_id] = v.vote;
  });
  const repayByLoan = {};
  (repayments.data || []).forEach((r) => {
    if (!loanIds.has(r.loan_id)) return;
    (repayByLoan[r.loan_id] ||= []).push({ id: r.id, amount: Number(r.amount), date: r.date });
  });

  const meetingIds = new Set((meetings.data || []).map((m) => m.id));
  const groupMotions = (motions.data || []).filter((mo) => meetingIds.has(mo.meeting_id));
  const motionIds = new Set(groupMotions.map((mo) => mo.id));
  const votesByMotion = {};
  (motionVotes.data || []).forEach((v) => {
    if (!motionIds.has(v.motion_id)) return;
    (votesByMotion[v.motion_id] ||= {})[v.voter_member_id] = v.vote;
  });
  const motionsByMeeting = {};
  groupMotions.forEach((mo) => {
    (motionsByMeeting[mo.meeting_id] ||= []).push({ id: mo.id, text: mo.text, status: mo.status, votes: votesByMotion[mo.id] || {} });
  });

  const groupObj = rowToGroup(g.data);
  return {
    group: groupObj,
    members: (members.data || []).map(rowToMember),
    cycles: (cycles.data || []).map(rowToCycle),
    contributions: (contributions.data || []).map(rowToContrib),
    loans: (loans.data || []).map((l) => rowToLoan(l, votesByLoan[l.id], repayByLoan[l.id]))
      .sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt)),
    meetings: (meetings.data || []).map((m) => rowToMeeting(m, motionsByMeeting[m.id]))
      .sort((a, b) => new Date(b.date) - new Date(a.date)),
    ledger: (ledger.data || []).map(rowToLedger),
    notifications: (notifications.data || []).map(rowToNotif),
    payments: (paymentsRes?.data || []).map(rowToPayment),
    settings: { simulateMpesa: true, shortcode: '', callbackUrl: '', pushEnabled: false },
    rotation: { recipientId: null, history: [], order: [] },
    projects: [],
    onboarded: true,
  };
}

/* ---------- create a whole group (creator + roster + first cycle) ---------- */
export async function createGroupRemote(g, userId) {
  if (!supabase) return { error: null };
  const { error: gerr } = await ins('groups', groupToRow(g.group, userId));
  if (gerr) return { error: gerr };
  // Creator membership first (unlocks officer policies), then the rest.
  const creator = g.members[0];
  await ins('group_members', memberToRow(g.group.id, creator));
  const rest = g.members.slice(1);
  if (rest.length) await ins('group_members', rest.map((m) => memberToRow(g.group.id, m)));
  if (g.cycles.length) await ins('cycles', g.cycles.map((c) => cycleToRow(g.group.id, c)));
  await upd('groups', g.group.id, { active_cycle_id: g.group.activeCycleId });
  return { error: null };
}

/* ---------- per-action writers ---------- */
export const db = {
  addMember: (groupId, m) => ins('group_members', memberToRow(groupId, m)),
  setMemberStatus: (memberId, status) => upd('group_members', memberId, { status }),
  setMemberRole: (memberId, role) => upd('group_members', memberId, { role }),

  addContribution: (groupId, c, recordedBy) => ins('contributions', contribToRow(groupId, c, recordedBy)),
  addLedger: (groupId, e) => ins('ledger', ledgerToRow(groupId, e)),

  addLoan: (groupId, l) => ins('loans', loanToRow(groupId, l)),
  setLoan: (loanId, patch) => upd('loans', loanId, patch),
  voteLoan: (loanId, voterMemberId, vote) =>
    upsert('loan_votes', { loan_id: loanId, voter_member_id: voterMemberId, vote }, 'loan_id,voter_member_id'),
  addRepayment: (loanId, r, recordedBy) =>
    ins('loan_repayments', { id: r.id, loan_id: loanId, amount: r.amount, date: r.date, recorded_by: recordedBy || null }),

  addMeeting: (groupId, m) => ins('meetings', meetingToRow(groupId, m)),
  setMeeting: (meetingId, patch) => upd('meetings', meetingId, patch),
  addMotion: (meetingId, mo) => ins('motions', { id: mo.id, meeting_id: meetingId, text: mo.text, status: mo.status }),
  setMotion: (motionId, patch) => upd('motions', motionId, patch),
  voteMotion: (motionId, voterMemberId, vote) =>
    upsert('motion_votes', { motion_id: motionId, voter_member_id: voterMemberId, vote }, 'motion_id,voter_member_id'),

  addCycle: (groupId, c) => ins('cycles', cycleToRow(groupId, c)),
  updateGroup: (groupId, patch) => upd('groups', groupId, patch),

  addNotification: (groupId, n) => ins('notifications', notifToRow(groupId, n)),
  setNotificationRead: (id, read) => upd('notifications', id, { read }),

  addPayment: (groupId, p, reportedBy) => ins('payments', {
    id: p.id, group_id: groupId, member_id: p.memberId || null, amount: p.amount,
    phone: p.phone || '', provider: p.provider || 'manual', provider_ref: p.providerRef || '',
    status: 'pending', note: p.note || '', reported_by: reportedBy || null,
  }),

  deleteGroup: (groupId) => del('groups', groupId),  // cascades to all child rows
};

// Confirm/reject go through SECURITY DEFINER RPCs (officer-gated, atomic).
export async function confirmPayment(paymentId, memberId, cycleId) {
  if (!supabase) return { ok: false, error: 'No backend configured.' };
  const { data, error } = await supabase.rpc('confirm_payment', { p_payment_id: paymentId, p_member_id: memberId, p_cycle_id: cycleId });
  if (error) return { ok: false, error: error.message.replace(/^.*?:\s*/, '') };
  return { ok: true, contributionId: data };
}
export async function rejectPayment(paymentId, note = '') {
  if (!supabase) return { ok: false, error: 'No backend configured.' };
  const { error } = await supabase.rpc('reject_payment', { p_payment_id: paymentId, p_note: note });
  if (error) return { ok: false, error: error.message.replace(/^.*?:\s*/, '') };
  return { ok: true };
}

/* ---------- join by code (SECURITY DEFINER RPC) ----------
 * Accepts either a member-specific invite code (claims that member row) or
 * the group-wide join code. Falls back to the older RPC on projects that
 * haven't run migration 0004 yet, AND tries a direct member-invite-code
 * claim so per-member codes always work. */
export async function joinGroupByCode(code) {
  if (!supabase) return { ok: false, error: 'No backend configured.' };
  const p_code = (code || '').trim().toUpperCase();

  // 1) Preferred path: the unified RPC that handles both code types.
  const { data, error } = await supabase.rpc('join_by_code', { p_code });
  if (!error && data) return { ok: true, groupId: data };

  // 2) RPC missing (migration 0004 not applied) — try the legacy group-code RPC
  //    AND a direct member-invite-code claim as a fallback.
  const rpcMissing = error && /could not find|does not exist|schema cache/i.test(error.message);

  if (rpcMissing || (error && /invalid invite code/i.test(error.message))) {
    // 2a) Try the group-wide join code via the legacy RPC.
    if (rpcMissing) {
      const legacy = await supabase.rpc('join_group_by_code', { p_code });
      if (!legacy.error && legacy.data) return { ok: true, groupId: legacy.data };
    }

    // 2b) Try claiming a member-specific invite code directly.
    //     This covers the case where the RPC doesn't exist OR the RPC
    //     couldn't find the code because of a data/migration mismatch.
    const claimed = await claimMemberInvite(p_code);
    if (claimed.ok) return claimed;
  }

  // 3) Surface the original error (or "Invalid invite code" from the RPC).
  return { ok: false, error: (error?.message || 'Invalid invite code').replace(/^.*?:\s*/, '') };
}

/* Direct member invite code claim — used as a fallback when the unified RPC
 * is unavailable. Finds the member row, checks it's unclaimed, links it to
 * the current user, and returns the group id. */
async function claimMemberInvite(code) {
  try {
    // Look up the member row by invite code (the column may not exist on
    // very old schemas — the query will just return nothing).
    const { data: rows } = await supabase
      .from('group_members')
      .select('id, group_id, user_id')
      .eq('invite_code', code)
      .neq('status', 'removed')
      .limit(1);
    const m = rows?.[0];
    if (!m) return { ok: false };

    // Already claimed by someone else?
    const { data: me } = await supabase.auth.getUser();
    const myId = me?.user?.id;
    if (m.user_id && m.user_id !== myId) {
      return { ok: false, error: 'That invite code has already been used.' };
    }

    // Claim the member row.
    if (!m.user_id) {
      const { error: uerr } = await supabase
        .from('group_members')
        .update({ user_id: myId, status: 'active' })
        .eq('id', m.id);
      if (uerr) return { ok: false, error: uerr.message };
    }

    return { ok: true, groupId: m.group_id };
  } catch {
    return { ok: false };
  }
}

/* ---------- realtime: reload the active group when anything changes ---------- */
// Broad but simple: any change to a table involved in this group triggers the
// caller's onChange (debounced upstream), which re-pulls the group. RLS means
// only rows the user can see reach them. Returns an unsubscribe function.
const RT_TABLES = [
  'groups', 'group_members', 'cycles', 'contributions', 'loans', 'loan_votes',
  'loan_repayments', 'meetings', 'motions', 'motion_votes', 'ledger', 'notifications', 'payments',
];
export function subscribeGroup(groupId, onChange) {
  if (!supabase || !groupId) return () => {};
  try {
    const channel = supabase.channel(`group:${groupId}`);
    RT_TABLES.forEach((table) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        try { onChange(); } catch { /* ignore */ }
      });
    });
    channel.subscribe();
    return () => { try { supabase.removeChannel(channel); } catch { /* ignore */ } };
  } catch { return () => {}; }
}

// snake_case patch helpers for group updates (in-memory patch is camelCase).
export function groupPatchToRow(patch) {
  const map = {
    name: 'name', type: 'type', contributionAmount: 'contribution_amount', frequency: 'frequency',
    currency: 'currency', loanInterest: 'loan_interest', activeCycleId: 'active_cycle_id',
  };
  const row = {};
  for (const k of Object.keys(patch)) if (map[k]) row[map[k]] = patch[k];
  return row;
}
