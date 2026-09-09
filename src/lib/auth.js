/* =====================================================================
 * ChamaOne — lib/auth.js
 * Device-local account gate: the user creates a username + password to lock
 * the app on this device. Passwords are NEVER stored in plaintext — we store a
 * random salt + a PBKDF2-SHA-256 derived hash (Web Crypto). Login re-derives
 * and compares. A lightweight session flag keeps them signed in until logout.
 *
 * This is on-device auth (offline-first). When ChamaOne moves to a shared
 * backend, swap these for Supabase Auth — the UI (MobileAuth) stays the same.
 * ===================================================================== */
const ACCT_KEY = 'chamaone.account.v1';
const SESSION_KEY = 'chamaone.session.v1';
const ITER = 100000;

const bufToHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const hexToBuf = (hex) => new Uint8Array(hex.match(/.{1,2}/g).map((h) => parseInt(h, 16)));

async function derive(password, saltBytes) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: saltBytes, iterations: ITER, hash: 'SHA-256' }, key, 256);
  return bufToHex(bits);
}

export function hasAccount() {
  try { return !!localStorage.getItem(ACCT_KEY); } catch { return false; }
}

export function accountUsername() {
  try { return JSON.parse(localStorage.getItem(ACCT_KEY) || 'null')?.username || ''; } catch { return ''; }
}

export async function createAccount(username, password) {
  username = (username || '').trim();
  if (username.length < 3) return { ok: false, error: 'Username must be at least 3 characters.' };
  if ((password || '').length < 6) return { ok: false, error: 'Password must be at least 6 characters.' };
  try {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await derive(password, salt);
    localStorage.setItem(ACCT_KEY, JSON.stringify({ username, salt: bufToHex(salt), hash, createdAt: Date.now() }));
    startSession(username);
    return { ok: true, username };
  } catch (e) {
    return { ok: false, error: 'Could not create the account on this device.' };
  }
}

export async function login(username, password) {
  try {
    const acct = JSON.parse(localStorage.getItem(ACCT_KEY) || 'null');
    if (!acct) return { ok: false, error: 'No account on this device. Create one first.' };
    if ((username || '').trim().toLowerCase() !== acct.username.toLowerCase()) {
      return { ok: false, error: 'Incorrect username or password.' };
    }
    const hash = await derive(password, hexToBuf(acct.salt));
    // constant-time-ish compare
    if (hash.length !== acct.hash.length) return { ok: false, error: 'Incorrect username or password.' };
    let diff = 0;
    for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ acct.hash.charCodeAt(i);
    if (diff !== 0) return { ok: false, error: 'Incorrect username or password.' };
    startSession(acct.username);
    return { ok: true, username: acct.username };
  } catch (e) {
    return { ok: false, error: 'Sign-in failed. Please try again.' };
  }
}

export async function changePassword(current, next) {
  const u = accountUsername();
  const chk = await login(u, current);
  if (!chk.ok) return { ok: false, error: 'Current password is incorrect.' };
  return createAccount(u, next); // re-derive with a fresh salt; keeps same username
}

export function startSession(username) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ username, ts: Date.now() })); } catch { /* ignore */ }
}
export function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}
export function logout() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}
