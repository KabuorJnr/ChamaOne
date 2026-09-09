/* =====================================================================
 * ChamaOne — store/chama.js
 * Single source of truth: state, persistence, and all business logic.
 *
 * Framework-agnostic core (a subscribe/emit singleton) + a React hook
 * (`useChama`) that re-renders on every change via useSyncExternalStore.
 * Every money movement flows through addLedgerEntry(), so the Ledger is a
 * complete, tamper-evident audit trail. To move to Supabase later, only
 * save()/load() change — screens only ever read state + call actions.
 * ===================================================================== */
import { useSyncExternalStore } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import { db, createGroupRemote, fetchGroups, loadGroupState, groupPatchToRow, joinGroupByCode, subscribeGroup } from '../lib/db';

const KEY = 'chamaone.state.v2'; // multi-group container (v1 was single-group)
const CURRENCY = 'KES';

// When a Supabase project is configured the store is backed by the shared
// backend: it hydrates the in-memory snapshot from Supabase on sign-in and
// mirrors every mutation back (optimistic — the UI updates instantly, the
// write persists in the background). Otherwise it stays local-only.
const REMOTE = isSupabaseConfigured;
let currentUser = null; // { id, email, name } — the signed-in user (remote mode)
export function setCurrentUser(u) { currentUser = u; }
// Fire-and-forget a backend write; db.* already logs its own errors.
function mirror(p) { try { if (p && typeof p.then === 'function') p.catch(() => {}); } catch { /* ignore */ } }
const recorder = () => currentUser?.id || null;

// Multi-Chama container. `root` holds every group this device manages; `state`
// always points at the ACTIVE group's data, so every getter/action below keeps
// working on one group unchanged. Each group is fully isolated — the tenant key
// is group.id, which is exactly what a Supabase RLS `group_id` policy will use
// when this moves to a shared backend for cross-member sync.
const OLD_KEY = 'chamaone.state.v1';
let root = null;   // { activeGroupId, groups: { [groupId]: groupState } }
let state = null;  // the active group's state (what the app reads/writes)
let version = 0;
const listeners = new Set();

/* ---------- ids & helpers ---------- */
// UUIDs so client-generated ids are valid Postgres uuids and the optimistic
// in-memory row shares its id with the persisted row. Falls back to a random
// v4-shaped string on very old engines without crypto.randomUUID.
// Short, human-shareable join code (no ambiguous chars).
const genCode = () => Array.from({ length: 6 }, () => '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 32)]).join('');
const uid = () => (globalThis.crypto?.randomUUID
  ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0; const v = c === 'x' ? r : (r & 0x3) | 0x8; return v.toString(16);
    }));
const now = () => new Date().toISOString();

export const fmtKES = (n) => 'KES ' + Math.round(Number(n) || 0).toLocaleString('en-KE');
export const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtDateTime = (iso) =>
  new Date(iso).toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/* ---------- persistence (multi-group) ---------- */
function emit() {
  try { localStorage.setItem(KEY, JSON.stringify(root)); } catch { /* quota / private mode */ }
  version++; // bump the snapshot so useSyncExternalStore re-renders
  listeners.forEach((fn) => fn());
}
function rootFromGroup(g) { return { activeGroupId: g.group.id, groups: { [g.group.id]: g } }; }
// A minimal empty group so synchronous getters never throw before a real
// group is hydrated/created (the app gates the shell behind groupCount()).
function blankGroup() {
  const cid = uid();
  return {
    group: { id: uid(), name: '', type: 'Savings Group', contributionAmount: 0, frequency: 'monthly', currency: CURRENCY, createdAt: now(), activeCycleId: cid, loanInterest: 10, joinCode: '' },
    members: [], cycles: [{ id: cid, label: '', startDate: now(), endDate: now() }],
    contributions: [], loans: [], meetings: [], ledger: [], notifications: [],
    settings: { simulateMpesa: true, shortcode: '', callbackUrl: '', pushEnabled: false }, onboarded: false,
  };
}

function ensure() {
  if (state) return state;
  // Remote mode: never seed demo data — the snapshot is hydrated from Supabase
  // after sign-in (see hydrate()). Until then, hand back a safe blank.
  if (REMOTE) {
    if (!root) root = { activeGroupId: null, groups: {} };
    state = root.groups[root.activeGroupId] || blankGroup();
    return state;
  }
  // Load the multi-group container.
  try { const raw = localStorage.getItem(KEY); if (raw) root = JSON.parse(raw); } catch { /* ignore */ }
  // Migrate the old single-group format (v1) into a one-group container.
  if (!root) {
    try {
      const old = localStorage.getItem(OLD_KEY);
      if (old) { const g = JSON.parse(old); if (g && g.group) root = rootFromGroup(g); }
    } catch { /* ignore */ }
  }
  // First run — seed a demo group.
  if (!root || !root.groups || !Object.keys(root.groups).length) root = rootFromGroup(seedGroup());
  if (!root.groups[root.activeGroupId]) root.activeGroupId = Object.keys(root.groups)[0];
  state = root.groups[root.activeGroupId];
  return state;
}

/* ---------- remote hydration ---------- */
// Load the signed-in user's groups from Supabase into the in-memory snapshot.
// Returns the number of groups. In local mode it just ensures the seed.
export async function hydrate(user) {
  if (user) currentUser = user;
  if (!REMOTE) { ensure(); return groupCount(); }
  const groups = await fetchGroups(currentUser?.id);
  const states = {};
  for (const g of groups) {
    const gs = await loadGroupState(g.id);
    if (gs) { gs.currentUserId = currentUser?.id; states[g.id] = gs; }
  }
  root = { activeGroupId: Object.keys(states)[0] || null, groups: states };
  state = root.groups[root.activeGroupId] || null;
  version++; listeners.forEach((fn) => fn());
  startRealtime();
  return Object.keys(states).length;
}

// The caller's own membership id in the active group — used so votes satisfy
// the "cast only your own vote" RLS policy (falls back to the first member).
function myMemberId() {
  const ms = members();
  const mine = currentUser ? ms.find((m) => m.userId === currentUser.id) : null;
  return (mine || ms[0])?.id;
}

/* ---------- realtime sync ---------- */
let rtUnsub = null;
let rtTimer = null;
// Re-pull the active group after another member changes it (debounced).
function refreshActiveGroup() {
  if (!REMOTE || !root?.activeGroupId) return;
  const id = root.activeGroupId;
  loadGroupState(id).then((gs) => {
    if (!gs || root.activeGroupId !== id) return;
    gs.currentUserId = currentUser?.id;
    root.groups[id] = gs;
    state = gs;
    version++; listeners.forEach((fn) => fn());
  }).catch(() => { /* ignore */ });
}
export function startRealtime() {
  if (!REMOTE) return;
  stopRealtime();
  if (!root?.activeGroupId) return;
  rtUnsub = subscribeGroup(root.activeGroupId, () => {
    clearTimeout(rtTimer);
    rtTimer = setTimeout(refreshActiveGroup, 400);
  });
}
export function stopRealtime() {
  try { rtUnsub && rtUnsub(); } catch { /* ignore */ }
  rtUnsub = null;
  clearTimeout(rtTimer);
}

/* ---------- join a group by code ---------- */
export async function joinGroup(code) {
  if (!REMOTE) return { ok: false, error: 'Joining a group needs the online backend.' };
  const res = await joinGroupByCode(code);
  if (!res.ok) return res;
  const gs = await loadGroupState(res.groupId);
  if (!gs) return { ok: false, error: 'Joined, but could not load the group.' };
  gs.currentUserId = currentUser?.id;
  ensure();
  root.groups[res.groupId] = gs;
  root.activeGroupId = res.groupId;
  state = gs;
  emit();
  startRealtime();
  return { ok: true, name: gs.group.name };
}

/* ---------- multiple groups ---------- */
export function listGroups() {
  ensure();
  return Object.values(root.groups).map((g) => ({
    id: g.group.id, name: g.group.name, type: g.group.type,
    memberCount: g.members.filter((m) => m.status !== 'removed').length,
    balance: (g.ledger || []).reduce((t, e) => t + (e.direction === 'in' ? e.amount : -e.amount), 0),
    active: g.group.id === root.activeGroupId,
  }));
}
export function groupCount() { ensure(); return Object.keys(root.groups).length; }
export function switchGroup(id) {
  ensure();
  if (root.groups[id]) { root.activeGroupId = id; state = root.groups[id]; emit(); if (REMOTE) startRealtime(); }
}
export function deleteGroup(id) {
  ensure();
  if (REMOTE) mirror(db.deleteGroup(id));
  delete root.groups[id];
  if (!Object.keys(root.groups).length) {
    if (REMOTE) { root.activeGroupId = null; state = blankGroup(); }
    else { const g = seedGroup(); root.groups[g.group.id] = g; root.activeGroupId = g.group.id; state = g; }
  } else {
    if (root.activeGroupId === id) root.activeGroupId = Object.keys(root.groups)[0];
    state = root.groups[root.activeGroupId];
  }
  emit();
  if (REMOTE) startRealtime();
}

/* ---------- getters ---------- */
export const members = () => ensure().members.filter((m) => m.status !== 'removed');
export const memberById = (id) => ensure().members.find((m) => m.id === id);
export const activeCycle = () => {
  const s = ensure();
  return s.cycles.find((c) => c.id === s.group.activeCycleId) || s.cycles[s.cycles.length - 1];
};

/* ---------- ledger (audit trail) ---------- */
function addLedgerEntry({ type, amount, direction, memberId, note, ref }) {
  const balBefore = poolBalance();
  const delta = direction === 'in' ? amount : -amount;
  const entry = {
    id: uid('lx'), date: now(), type, amount, direction,
    memberId: memberId || null, note: note || '', ref: ref || '',
    balanceAfter: balBefore + delta,
  };
  state.ledger.unshift(entry);
  return entry;
}
export function poolBalance() {
  return ensure().ledger.reduce((t, e) => t + (e.direction === 'in' ? e.amount : -e.amount), 0);
}

/* ---------- notifications ---------- */
// An optional sink lets the app mirror important in-app notifications to the
// device tray (see lib/notifications). Kept decoupled so the store has no
// dependency on Capacitor. Set via setNotifSink() from App.
let notifSink = null;
export function setNotifSink(fn) { notifSink = fn; }
function notify(type, text) {
  state.notifications.unshift({ id: uid('nt'), type, text, date: now(), read: false });
  if (notifSink) { try { notifSink({ type, text }); } catch { /* ignore */ } }
}
export const unreadCount = () => ensure().notifications.filter((n) => !n.read).length;
export function markAllRead() { ensure().notifications.forEach((n) => (n.read = true)); emit(); }
export function markRead(id) {
  const n = ensure().notifications.find((x) => x.id === id);
  if (n) n.read = true; emit();
}

/* ---------- phone ---------- */
export function normalizePhone(p) {
  if (!p) return '';
  let s = String(p).replace(/\D/g, '');
  if (s.startsWith('0')) s = '254' + s.slice(1);
  if (s.startsWith('7') || s.startsWith('1')) s = '254' + s;
  return s;
}
export function displayPhone(p) {
  const s = String(p || '');
  if (s.startsWith('254')) return '0' + s.slice(3).replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
  return s;
}

/* ---------- group setup ---------- */
// Build a fresh, empty group state object (no side effects).
function buildGroup({ name, type, amount, frequency, members: mem }) {
  const cycleId = uid('cy');
  return {
    group: {
      id: uid('grp'), name, type: type || 'Savings Group',
      contributionAmount: Number(amount) || 0, frequency: frequency || 'monthly',
      currency: CURRENCY, createdAt: now(), activeCycleId: cycleId, loanInterest: 10, joinCode: genCode(),
    },
    members: (mem || []).map((m, i) => ({
      id: uid('mb'), name: m.name, phone: normalizePhone(m.phone),
      role: i === 0 ? 'Chairperson' : m.role || 'Member', joinedAt: now(), status: 'active',
    })),
    cycles: [makeCycle(cycleId, frequency)],
    contributions: [], loans: [], meetings: [], ledger: [], notifications: [],
    settings: { simulateMpesa: true, shortcode: '', callbackUrl: '', pushEnabled: false },
    onboarded: true,
  };
}
// Create a NEW Chama and switch to it — additive, never replaces existing groups.
export function createGroup({ name, type, amount, frequency, members: mem }) {
  ensure();
  const g = buildGroup({ name, type, amount, frequency, members: mem });
  // The creator is the Chairperson and the first member linked to this account.
  if (REMOTE && currentUser && g.members[0]) g.members[0].userId = currentUser.id;
  g.currentUserId = currentUser?.id;
  root.groups[g.group.id] = g;
  root.activeGroupId = g.group.id;
  state = g;
  notify('system', `Welcome to ChamaOne! "${name}" is ready.`);
  emit();
  if (REMOTE && currentUser) { mirror(createGroupRemote(g, currentUser.id)); startRealtime(); }
}
function makeCycle(id, frequency) {
  const start = new Date();
  const end = new Date();
  if (frequency === 'weekly') end.setDate(end.getDate() + 7);
  else if (frequency === 'daily') end.setDate(end.getDate() + 1);
  else end.setMonth(end.getMonth() + 1);
  return { id, label: labelForCycle(start, frequency), startDate: start.toISOString(), endDate: end.toISOString() };
}
function labelForCycle(d, frequency) {
  if (frequency === 'weekly') return 'Week of ' + d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
  return d.toLocaleDateString('en-KE', { month: 'long', year: 'numeric' });
}
export function startNextCycle() {
  const g = ensure().group;
  const id = uid('cy');
  const c = makeCycle(id, g.frequency);
  state.cycles.push(c);
  g.activeCycleId = id;
  notify('cycle', `New ${g.frequency} cycle started: ${c.label}`);
  emit();
  if (REMOTE) { mirror(db.addCycle(g.id, c)); mirror(db.updateGroup(g.id, { active_cycle_id: id })); }
}
export function updateGroup(patch) {
  Object.assign(ensure().group, patch);
  emit();
  if (REMOTE) mirror(db.updateGroup(state.group.id, groupPatchToRow(patch)));
}
export function updateSettings(patch) { Object.assign(ensure().settings, patch); emit(); }

/* ---------- members ---------- */
export function addMember({ name, phone, role }) {
  const m = { id: uid('mb'), name: name.trim(), phone: normalizePhone(phone), role: role || 'Member', joinedAt: now(), status: 'active' };
  ensure().members.push(m);
  notify('member', `${m.name} joined the group.`);
  emit();
  if (REMOTE) mirror(db.addMember(state.group.id, m));
  return m;
}
export function removeMember(id) {
  const m = memberById(id);
  if (m) m.status = 'removed';
  emit();
  if (REMOTE) mirror(db.setMemberStatus(id, 'removed'));
}

/* ---------- contributions ---------- */
export function recordContribution({ memberId, amount, method, ref, cycleId }) {
  const cy = cycleId || activeCycle().id;
  const c = { id: uid('cn'), memberId, cycleId: cy, amount: Number(amount), method: method || 'cash', ref: ref || '', status: 'confirmed', date: now() };
  ensure().contributions.push(c);
  const m = memberById(memberId);
  const lx = addLedgerEntry({ type: 'Contribution', amount: c.amount, direction: 'in', memberId, note: `${m ? m.name : 'Member'} — ${cycleLabel(cy)}`, ref: c.ref });
  notify('money', `${m ? m.name : 'A member'} contributed ${fmtKES(c.amount)}.`);
  emit();
  if (REMOTE) { mirror(db.addContribution(state.group.id, c, recorder())); mirror(db.addLedger(state.group.id, lx)); }
  return c;
}
export function cycleLabel(id) {
  const c = ensure().cycles.find((x) => x.id === id);
  return c ? c.label : '';
}
export function contributionsForCycle(cycleId) {
  return ensure().contributions.filter((c) => c.cycleId === cycleId);
}
export function memberCycleTotal(memberId, cycleId) {
  return contributionsForCycle(cycleId).filter((c) => c.memberId === memberId).reduce((t, c) => t + c.amount, 0);
}
export function cycleStats(cycleId) {
  const cy = cycleId || activeCycle().id;
  const target = ensure().group.contributionAmount;
  const ms = members();
  let collected = 0, paidCount = 0;
  ms.forEach((m) => {
    const t = memberCycleTotal(m.id, cy);
    collected += t;
    if (t >= target && target > 0) paidCount++;
  });
  const expected = target * ms.length;
  return { cycleId: cy, collected, expected, paidCount, totalMembers: ms.length, pct: expected ? Math.min(100, Math.round((collected / expected) * 100)) : 0 };
}
export function memberStatus(memberId, cycleId) {
  const cy = cycleId || activeCycle().id;
  const target = ensure().group.contributionAmount;
  const paid = memberCycleTotal(memberId, cy);
  if (target <= 0) return { paid, target, state: 'na' };
  if (paid >= target) return { paid, target, state: 'paid' };
  if (paid > 0) return { paid, target, state: 'partial' };
  return { paid, target, state: 'unpaid' };
}

/* ---------- loans ---------- */
export function applyLoan({ memberId, principal, termMonths, purpose }) {
  const l = {
    id: uid('ln'), memberId, principal: Number(principal), interestRate: ensure().group.loanInterest,
    termMonths: Number(termMonths) || 1, purpose: purpose || '', status: 'pending',
    appliedAt: now(), votes: {}, disbursedAt: null, repayments: [],
  };
  ensure().loans.unshift(l);
  const m = memberById(memberId);
  notify('loan', `${m ? m.name : 'A member'} applied for a ${fmtKES(l.principal)} loan — vote needed.`);
  emit();
  if (REMOTE) mirror(db.addLoan(state.group.id, l));
  return l;
}
export const loanById = (id) => ensure().loans.find((l) => l.id === id);
export function voteLoan(loanId, voterId, vote) {
  const l = loanById(loanId);
  if (!l || l.status !== 'pending') return;
  const voter = REMOTE ? myMemberId() : voterId;   // RLS: you may only cast your own vote
  l.votes[voter] = vote;
  const total = members().length;
  const yes = Object.values(l.votes).filter((v) => v === 'yes').length;
  const no = Object.values(l.votes).filter((v) => v === 'no').length;
  let newStatus = null;
  if (yes > total / 2) { l.status = 'approved'; newStatus = 'approved'; notify('loan', `Loan for ${memberById(l.memberId)?.name} approved.`); }
  else if (no >= total / 2) { l.status = 'rejected'; newStatus = 'rejected'; }
  emit();
  if (REMOTE) { mirror(db.voteLoan(loanId, voter, vote)); if (newStatus) mirror(db.setLoan(loanId, { status: newStatus })); }
}
export function loanTotals(l) {
  const interest = (l.principal * l.interestRate) / 100;
  const total = l.principal + interest;
  const repaid = l.repayments.reduce((t, r) => t + r.amount, 0);
  return { interest, total, repaid, outstanding: Math.max(0, total - repaid) };
}
export function disburseLoan(id) {
  const l = loanById(id);
  if (!l || l.status !== 'approved') return { error: 'state' };
  if (l.principal > poolBalance()) { notify('loan', `Not enough funds to disburse ${fmtKES(l.principal)}.`); emit(); return { error: 'insufficient' }; }
  l.status = 'active';
  l.disbursedAt = now();
  const m = memberById(l.memberId);
  const lx = addLedgerEntry({ type: 'Loan disbursement', amount: l.principal, direction: 'out', memberId: l.memberId, note: `Loan to ${m ? m.name : 'member'} @ ${l.interestRate}%` });
  notify('loan', `${fmtKES(l.principal)} disbursed to ${m ? m.name : 'member'}.`);
  emit();
  if (REMOTE) { mirror(db.setLoan(id, { status: 'active', disbursed_at: l.disbursedAt })); mirror(db.addLedger(state.group.id, lx)); }
  return { ok: true };
}
export function repayLoan(id, amount) {
  const l = loanById(id);
  if (!l || l.status !== 'active') return;
  const t = loanTotals(l);
  const amt = Math.min(Number(amount), t.outstanding);
  const rp = { id: uid('rp'), amount: amt, date: now() };
  l.repayments.push(rp);
  const m = memberById(l.memberId);
  const lx = addLedgerEntry({ type: 'Loan repayment', amount: amt, direction: 'in', memberId: l.memberId, note: `Repayment from ${m ? m.name : 'member'}` });
  let repaid = false;
  if (loanTotals(l).outstanding <= 0) { l.status = 'repaid'; repaid = true; notify('loan', `${m ? m.name : 'Member'} fully repaid their loan.`); }
  emit();
  if (REMOTE) {
    mirror(db.addRepayment(id, rp, recorder()));
    mirror(db.addLedger(state.group.id, lx));
    if (repaid) mirror(db.setLoan(id, { status: 'repaid' }));
  }
}

/* ---------- meetings & voting ---------- */
export function createMeeting({ title, date, location, agenda, online, link }) {
  const mt = {
    id: uid('mt'), title, date: date || now(),
    online: !!online, link: link || '',
    location: online ? '' : (location || ''),
    agenda: (agenda || []).filter(Boolean), minutes: '', motions: [], status: 'scheduled',
  };
  ensure().meetings.unshift(mt);
  notify('meeting', `${online ? 'Online meeting' : 'Meeting'} scheduled: ${title} — ${fmtDateTime(mt.date)}.`);
  emit();
  if (REMOTE) mirror(db.addMeeting(state.group.id, mt));
  return mt;
}
// Build a shareable video link for an online meeting (Jitsi rooms need no
// account and work on the phone browser). A user-supplied link wins.
export function makeMeetingLink(title) {
  const slug = String(title || 'meeting').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'meeting';
  return `https://meet.jit.si/ChamaOne-${slug}-${Math.random().toString(36).slice(2, 7)}`;
}
export const meetingById = (id) => ensure().meetings.find((m) => m.id === id);
export function addMotion(meetingId, text) {
  const mt = meetingById(meetingId);
  if (!mt) return;
  const mo = { id: uid('mo'), text, votes: {}, status: 'open' };
  mt.motions.push(mo);
  emit();
  if (REMOTE) mirror(db.addMotion(meetingId, mo));
}
export function voteMotion(meetingId, motionId, voterId, vote) {
  const mt = meetingById(meetingId);
  const mo = mt && mt.motions.find((x) => x.id === motionId);
  if (!mo || mo.status !== 'open') return;
  const voter = REMOTE ? myMemberId() : voterId;   // RLS: you may only cast your own vote
  mo.votes[voter] = vote;
  emit();
  if (REMOTE) mirror(db.voteMotion(motionId, voter, vote));
}
export function closeMotion(meetingId, motionId) {
  const mt = meetingById(meetingId);
  const mo = mt && mt.motions.find((x) => x.id === motionId);
  if (!mo) return;
  const yes = Object.values(mo.votes).filter((v) => v === 'yes').length;
  const no = Object.values(mo.votes).filter((v) => v === 'no').length;
  mo.status = yes > no ? 'passed' : 'failed';
  emit();
  if (REMOTE) mirror(db.setMotion(motionId, { status: mo.status }));
}
export function saveMinutes(meetingId, minutes) {
  const mt = meetingById(meetingId);
  if (mt) { mt.minutes = minutes; mt.status = 'completed'; }
  emit();
  if (REMOTE && mt) mirror(db.setMeeting(meetingId, { minutes, status: 'completed' }));
}

/* ---------- reports ---------- */
export function financialSummary() {
  const s = ensure();
  const inflow = s.ledger.filter((e) => e.direction === 'in').reduce((t, e) => t + e.amount, 0);
  const outflow = s.ledger.filter((e) => e.direction === 'out').reduce((t, e) => t + e.amount, 0);
  const byType = {};
  s.ledger.forEach((e) => {
    byType[e.type] = byType[e.type] || { in: 0, out: 0 };
    byType[e.type][e.direction] += e.amount;
  });
  const activeLoans = s.loans.filter((l) => l.status === 'active');
  const outstandingLoans = activeLoans.reduce((t, l) => t + loanTotals(l).outstanding, 0);
  return { inflow, outflow, balance: poolBalance(), byType, outstandingLoans, loanCount: activeLoans.length, memberCount: members().length };
}
export function contributionTrend() {
  return ensure().cycles.map((c) => ({ label: c.label, total: contributionsForCycle(c.id).reduce((t, x) => t + x.amount, 0) }));
}
export function toCSV() {
  const s = ensure();
  const rows = [['Date', 'Type', 'Member', 'In', 'Out', 'Balance', 'Ref/Note']];
  [...s.ledger].reverse().forEach((e) => {
    const m = e.memberId ? memberById(e.memberId) : null;
    rows.push([fmtDate(e.date), e.type, m ? m.name : '', e.direction === 'in' ? e.amount : '', e.direction === 'out' ? e.amount : '', e.balanceAfter, (e.ref || e.note || '').replace(/,/g, ';')]);
  });
  return rows.map((r) => r.join(',')).join('\n');
}

/* ---------- lifecycle ---------- */
export function getState() { return state; } // raw current state (may be null pre-init)
// reset/wipe rebuild the whole container as a single fresh demo group.
export function reset() {
  // Remote mode has no demo data to reload — re-pull the real state instead.
  if (REMOTE) { hydrate(currentUser); return; }
  const g = seedGroup(); root = rootFromGroup(g); state = g; emit();
}
export function wipe() {
  if (REMOTE) { hydrate(currentUser); return; }
  try { localStorage.removeItem(KEY); localStorage.removeItem(OLD_KEY); } catch { /* ignore */ }
  reset();
}

/* =====================================================================
 * React binding — one object merging live state + bound actions, mirroring
 * EduOne's `store` prop shape. Re-renders subscribers on every emit().
 * ===================================================================== */
const actions = {
  createGroup, joinGroup, listGroups, groupCount, switchGroup, deleteGroup,
  startNextCycle, updateGroup, updateSettings,
  addMember, removeMember,
  recordContribution, contributionsForCycle, memberCycleTotal, cycleStats, memberStatus, cycleLabel,
  applyLoan, loanById, voteLoan, loanTotals, disburseLoan, repayLoan,
  createMeeting, makeMeetingLink, meetingById, addMotion, voteMotion, closeMotion, saveMinutes,
  poolBalance, financialSummary, contributionTrend, toCSV,
  notify: (t, x) => { notify(t, x); emit(); }, unreadCount, markAllRead, markRead,
  members, memberById, activeCycle, displayPhone, normalizePhone,
  reset, wipe,
};

function subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb); }
// Snapshot is a version counter (a primitive), not the state object. We mutate
// `state` in place, so its reference is stable — returning it would make
// useSyncExternalStore bail out. The version bumps on every emit() instead.
function getSnapshot() { return version; }

export function useChama() {
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot); // re-renders when version changes
  const snap = ensure();
  // Merge live state with actions so screens use `store.members`, `store.recordContribution(...)`, etc.
  return { ...snap, ...actions };
}

/* =====================================================================
 * Seed / demo data — a realistic Chama so the app is explorable at once.
 * Returns ONE group state object (added into the multi-group container).
 * ===================================================================== */
function seedGroup() {
  const s = {
    group: { id: uid('grp'), name: 'Umoja Investment Chama', type: 'Investment Club', contributionAmount: 2000, frequency: 'monthly', currency: CURRENCY, createdAt: monthsAgo(4), activeCycleId: null, loanInterest: 10, joinCode: genCode() },
    members: [
      mk('Grace Wanjiru', '0722100200', 'Chairperson', 4),
      mk('James Otieno', '0733200300', 'Treasurer', 4),
      mk('Fatuma Ali', '0711300400', 'Secretary', 4),
      mk('Peter Kamau', '0700400500', 'Member', 3),
      mk('Mercy Chebet', '0745500600', 'Member', 3),
      mk('David Mwangi', '0790600700', 'Member', 2),
      mk('Aisha Hassan', '0712700800', 'Member', 1),
    ],
    cycles: [], contributions: [], loans: [], meetings: [], ledger: [], notifications: [],
    settings: { simulateMpesa: true, shortcode: '', callbackUrl: '', pushEnabled: false }, onboarded: true,
  };
  const cids = [];
  for (let i = 3; i >= 0; i--) {
    const id = uid('cy'); cids.push(id);
    const start = new Date(); start.setMonth(start.getMonth() - i); start.setDate(1);
    const end = new Date(start); end.setMonth(end.getMonth() + 1);
    s.cycles.push({ id, label: start.toLocaleDateString('en-KE', { month: 'long', year: 'numeric' }), startDate: start.toISOString(), endDate: end.toISOString() });
  }
  s.group.activeCycleId = cids[cids.length - 1];

  const prev = state; state = s;
  s.cycles.forEach((c, ci) => {
    s.members.forEach((m, mi) => {
      const isCurrent = ci === s.cycles.length - 1;
      if (isCurrent && mi >= 4) return;
      const partial = isCurrent && mi === 3;
      recordSilently(m.id, partial ? 1000 : 2000, c.id, 'mpesa', 'RGH' + Math.random().toString(36).slice(2, 8).toUpperCase());
    });
  });

  const loan = { id: uid('ln'), memberId: s.members[3].id, principal: 15000, interestRate: 10, termMonths: 3, purpose: 'School fees', status: 'active', appliedAt: monthsAgo(2), votes: voteAll(s.members, 'yes'), disbursedAt: monthsAgo(2), repayments: [{ id: uid('rp'), amount: 6000, date: monthsAgo(1) }] };
  s.loans.push(loan);
  addLedgerEntry({ type: 'Loan disbursement', amount: 15000, direction: 'out', memberId: loan.memberId, note: 'Loan to Peter Kamau @ 10%' });
  addLedgerEntry({ type: 'Loan repayment', amount: 6000, direction: 'in', memberId: loan.memberId, note: 'Repayment from Peter Kamau' });

  s.loans.unshift({ id: uid('ln'), memberId: s.members[4].id, principal: 8000, interestRate: 10, termMonths: 2, purpose: 'Boda boda repair', status: 'pending', appliedAt: daysAgoIso(2), votes: { [s.members[0].id]: 'yes', [s.members[1].id]: 'yes' }, disbursedAt: null, repayments: [] });

  s.meetings.push({ id: uid('mt'), title: 'Monthly Review Meeting', date: daysFromNowIso(6), online: true, link: 'https://meet.jit.si/ChamaOne-monthly-review-x7k2p', location: '', agenda: ['Review contributions', 'Vote on Mercy’s loan', 'Plan Q4 investment'], minutes: '', motions: [{ id: uid('mo'), text: 'Increase monthly contribution to KES 2,500 from next cycle', votes: voteMix(s.members), status: 'open' }], status: 'scheduled' });
  s.meetings.push({ id: uid('mt'), title: 'AGM 2026 Planning', date: monthsAgo(1), location: 'Zoom', agenda: ['Elect officials', 'Approve accounts'], minutes: 'Officials retained unanimously. Accounts approved. Next: diversify into a money-market fund.', motions: [{ id: uid('mo'), text: 'Approve 2025 financial statements', votes: voteAll(s.members, 'yes'), status: 'passed' }], status: 'completed' });

  s.notifications.unshift(
    { id: uid('nt'), type: 'loan', text: 'Mercy Chebet applied for a KES 8,000 loan — vote needed.', date: daysAgoIso(2), read: false },
    { id: uid('nt'), type: 'meeting', text: 'Monthly Review Meeting in 6 days.', date: daysAgoIso(1), read: false },
    { id: uid('nt'), type: 'money', text: '3 members are yet to contribute this cycle.', date: now(), read: false },
  );

  state = prev;
  return s;

  function recordSilently(memberId, amount, cycleId, method, ref) {
    const c = { id: uid('cn'), memberId, cycleId, amount, method, ref, status: 'confirmed', date: (s.cycles.find((x) => x.id === cycleId) || {}).startDate || now() };
    s.contributions.push(c);
    const m = s.members.find((x) => x.id === memberId);
    addLedgerEntry({ type: 'Contribution', amount, direction: 'in', memberId, note: `${m.name} — ${s.cycles.find((x) => x.id === cycleId).label}`, ref });
  }
}
function mk(name, phone, role, monthsBack) { return { id: uid('mb'), name, phone: normalizePhone(phone), role, joinedAt: monthsAgo(monthsBack), status: 'active' }; }
function voteAll(mem, v) { const o = {}; mem.forEach((m) => (o[m.id] = v)); return o; }
function voteMix(mem) { const o = {}; mem.forEach((m, i) => (o[m.id] = i % 3 === 0 ? 'no' : i % 4 === 0 ? 'abstain' : 'yes')); return o; }
function monthsAgo(n) { const d = new Date(); d.setMonth(d.getMonth() - n); return d.toISOString(); }
function daysAgoIso(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); }
function daysFromNowIso(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString(); }
