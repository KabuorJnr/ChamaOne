/* =====================================================================
 * ChamaOne — lib/supabase.js
 * The Supabase client, created from env vars (see .env.example).
 *
 * ChamaOne is offline-first: the app runs entirely on localStorage today
 * (see store/chama.js). This client is the foundation for the shared
 * backend — real accounts (Supabase Auth) and cross-member sync guarded by
 * Row Level Security. It is intentionally optional: if the env vars are not
 * set, `supabase` is null and the app keeps working locally, so nothing
 * breaks before the data layer is wired over.
 * ===================================================================== */
import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://kskswlecmwcbnhuskyhi.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtza3N3bGVjbXdjYm5odXNreWhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5Mzc3ODksImV4cCI6MjEwNDUxMzc4OX0.vGD8AWZs8ShLNCnHdXkixDQJtD4k9jierMOfNo17YBA';

const url = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

/** True when a Supabase project is configured for this build. */
export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * The shared Supabase client, or `null` when unconfigured.
 * Auth persists the session in localStorage and auto-refreshes tokens.
 */
export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false, // native/webview app, no OAuth redirect URLs
        storageKey: 'chamaone.auth',
      },
    })
  : null;

if (!isSupabaseConfigured && import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.warn(
    '[ChamaOne] Supabase not configured — running local-only. ' +
      'Copy .env.example to .env and set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.',
  );
}
