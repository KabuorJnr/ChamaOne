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

/** Create an account. Returns { ok, user?, needsConfirmation?, error? }. */
export async function signUp({ name, email, password }) {
  if (supabase) {
    const { data, error } = await supabase.auth.signUp({
      email: (email || '').trim(),
      password,
      options: { data: { full_name: (name || '').trim() } },
    });
    if (error) return { ok: false, error: friendly(error) };
    // With email confirmation ON, there is no session until the link is clicked.
    return { ok: true, user: mapUser(data.user), needsConfirmation: !data.session };
  }
  const r = await local.createAccount((email || '').trim(), password); // email doubles as the local username
  return r.ok ? { ok: true, user: { name: r.username, email: r.username } } : r;
}

/** Sign in. Returns { ok, user?, error? }. */
export async function signIn({ email, password }) {
  if (supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: (email || '').trim(), password });
    if (error) return { ok: false, error: friendly(error) };
    return { ok: true, user: mapUser(data.user) };
  }
  const r = await local.login((email || '').trim(), password);
  return r.ok ? { ok: true, user: { name: r.username, email: r.username } } : r;
}

export async function signOut() {
  if (supabase) { try { await supabase.auth.signOut(); } catch { /* ignore */ } return; }
  local.logout();
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

/** The current user (async — Supabase reads the persisted session). */
export async function currentUser() {
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    return mapUser(data.session?.user || null);
  }
  const s = local.getSession();
  return s ? { name: s.username, email: s.username } : null;
}

/**
 * Subscribe to auth changes. Calls cb(user|null) on sign-in/out/refresh.
 * Returns an unsubscribe function. No-op for the local backend.
 */
export function onAuthChange(cb) {
  if (supabase) {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(mapUser(session?.user || null)));
    return () => { try { data.subscription.unsubscribe(); } catch { /* ignore */ } };
  }
  return () => {};
}
