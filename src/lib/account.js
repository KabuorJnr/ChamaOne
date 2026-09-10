/* =====================================================================
 * ChamaOne — lib/account.js
 * Auth abstraction with two backends:
 *   • Supabase Auth (email + password) when a project is configured
 *   • the device-local PBKDF2 gate (lib/auth.js) otherwise — so the app
 *     still runs fully offline with no backend.
 *
 * The UI (MobileAuth) and App only talk to this module, so switching the
 * store to Supabase later doesn't touch the auth screens again.
 * ===================================================================== */
import { supabase, isSupabaseConfigured } from './supabase';
import * as local from './auth';

export const authMode = isSupabaseConfigured ? 'supabase' : 'local';

function mapUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email || '',
    name: u.user_metadata?.full_name || (u.email ? u.email.split('@')[0] : 'Member'),
  };
}

// Turn Supabase auth errors into short, human messages.
function friendly(error) {
  const m = (error?.message || '').toLowerCase();
  if (m.includes('invalid login')) return 'Incorrect email or password.';
  if (m.includes('already registered') || m.includes('already exists')) return 'That email is already registered — sign in instead.';
  if (m.includes('password')) return error.message; // e.g. "Password should be at least 6 characters"
  if (m.includes('email')) return 'Enter a valid email address.';
  if (m.includes('rate limit')) return 'Too many attempts — please wait a moment and try again.';
  return error?.message || 'Something went wrong. Please try again.';
}

const USER_KEY = 'chamaone.user.v1';

function cacheUser(u) {
  try {
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
    else localStorage.removeItem(USER_KEY);
  } catch { /* ignore */ }
}

function getCachedUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/** Create an account. Returns { ok, user?, needsConfirmation?, error? }. */
export async function signUp({ name, email, password, phone }) {
  if (supabase) {
    const { data, error } = await supabase.auth.signUp({
      email: (email || '').trim(),
      password,
      options: { data: { full_name: (name || '').trim(), phone: (phone || '').trim() } },
    });
    if (error) return { ok: false, error: friendly(error) };
    const u = mapUser(data.user);
    if (data.session && u) cacheUser(u);
    return { ok: true, user: u, needsConfirmation: !data.session };
  }
  const r = await local.createAccount((email || '').trim(), password);
  if (r.ok) {
    const u = { name: r.username, email: r.username };
    cacheUser(u);
    return { ok: true, user: u };
  }
  return r;
}

/** Sign in. Returns { ok, user?, error? }. */
export async function signIn({ email, password }) {
  if (supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: (email || '').trim(), password });
    if (!error && data?.user) {
      const u = mapUser(data.user);
      cacheUser(u);
      return { ok: true, user: u };
    }
    // Fallback: check device-local account
    const loc = await local.login((email || '').trim(), password);
    if (loc.ok) {
      const u = { id: 'local-user', name: loc.username, email: loc.username };
      cacheUser(u);
      return { ok: true, user: u };
    }
    return { ok: false, error: friendly(error) };
  }
  const r = await local.login((email || '').trim(), password);
  if (r.ok) {
    const u = { name: r.username, email: r.username };
    cacheUser(u);
    return { ok: true, user: u };
  }
  return r;
}

export async function signOut() {
  cacheUser(null);
  local.logout();
  if (supabase) { try { await supabase.auth.signOut(); } catch { /* ignore */ } }
}

/** Change the signed-in user's password (verifies the current one first). */
export async function changePassword(current, next) {
  if (supabase) {
    const { data } = await supabase.auth.getUser();
    const email = data?.user?.email;
    if (!email) return { ok: false, error: 'You are not signed in.' };
    const check = await supabase.auth.signInWithPassword({ email, password: current });
    if (check.error) return { ok: false, error: 'Current password is incorrect.' };
    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) return { ok: false, error: friendly(error) };
    return { ok: true };
  }
  return local.changePassword(current, next);
}

/** The current user (async — checks Supabase, cached user, and local session). */
export async function currentUser() {
  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      const u = mapUser(data?.session?.user || null);
      if (u) { cacheUser(u); return u; }
    } catch { /* ignore */ }
  }
  // If Supabase session is pending or offline, check cached user
  const cached = getCachedUser();
  if (cached && (cached.name || cached.email)) return cached;

  // Fallback to local session
  const s = local.getSession();
  if (s?.username) return { id: 'local-user', name: s.username, email: s.username };

  return null;
}

/**
 * Subscribe to auth changes.
 * Calls cb(user) on sign-in / refresh and cb(null) ONLY on explicit logout.
 */
export function onAuthChange(cb) {
  if (supabase) {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        cacheUser(null);
        cb(null);
      } else if (session?.user) {
        const u = mapUser(session.user);
        cacheUser(u);
        cb(u);
      }
    });
    return () => { try { data.subscription.unsubscribe(); } catch { /* ignore */ } };
  }
  return () => {};
}
