import { useState, useEffect } from 'react';
import MobileShell from './mobile/MobileShell';
import MobileAuth from './mobile/MobileAuth';
import MobileOnboard from './mobile/MobileOnboard';
import MobileLanding from './mobile/MobileLanding';
import { useChama, setNotifSink, getState, hydrate, setCurrentUser, stopRealtime } from './store/chama';
import { notify as deviceNotify } from './lib/notifications';
import { currentUser, onAuthChange, signOut } from './lib/account';
import { isNative } from './lib/native';
import './mobile/mobile.css';

// Installed PWA / native app → straight into the app; a plain browser tab →
// show the public landing (download + install) first.
const isInstalledApp = () => {
  try { if (isNative()) return true; } catch { /* ignore */ }
  try { return window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone || false; } catch { return false; }
};

// Mirror important in-app notifications to the phone's notification tray —
// but only money/loan/meeting/cycle events, and only when the user has turned
// on phone notifications in Settings (which is what grants OS permission).
const DEVICE_TYPES = new Set(['money', 'loan', 'meeting', 'cycle']);
setNotifSink(({ type, text }) => {
  try {
    if (!DEVICE_TYPES.has(type)) return;
    if (!getState()?.settings?.pushEnabled) return;
    deviceNotify({ title: 'ChamaOne', body: text });
  } catch { /* ignore */ }
});

// ChamaOne is local-first: no login server. The "current user" is the group
// officer running the app — we use the Chairperson for the greeting/avatar.
// A short branded splash (EduOne-style) plays on cold start.
export default function App() {
  const store = useChama();
  const [splash, setSplash] = useState(true);
  // Auth session — the signed-in user object (null = show the login gate).
  const [account, setAccount] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [entered, setEntered] = useState(isInstalledApp()); // installed app skips the landing

  // Resolve the current session on cold start, then keep it in sync with
  // Supabase auth changes (sign-in/out/token refresh across devices).
  useEffect(() => {
    let alive = true;
    currentUser().then((u) => { if (alive) { setAccount(u); setAuthReady(true); } });
    const unsub = onAuthChange((u) => { if (alive) setAccount(u); });
    return () => { alive = false; unsub(); };
  }, []);

  // Once signed in, load this user's groups from the backend into the store.
  useEffect(() => {
    let alive = true;
    if (account) {
      setHydrated(false);
      setCurrentUser(account);
      hydrate(account).finally(() => { if (alive) setHydrated(true); });
    } else {
      setHydrated(false);
    }
    return () => { alive = false; };
  }, [account?.id]);

  useEffect(() => {
    const t = setTimeout(() => setSplash(false), 1400);
    return () => clearTimeout(t);
  }, []);

  const onLogout = () => { stopRealtime(); signOut(); setAccount(null); };
  const user = { name: account?.name || 'Member', role: store.myRole(), onLogout };

  // Hold the splash until the branded delay AND the session check are both done,
  // so a signed-in user never flashes the login screen.
  if (splash || !authReady) return <Splash />;

  // Logged out: a browser visitor sees the public landing first; "Open in
  // browser" (or an installed app) proceeds to the login gate.
  if (!account) {
    if (!entered) return <MobileLanding onEnter={() => setEntered(true)} />;
    return <MobileAuth onAuthed={(u) => setAccount(u)} />;
  }

  // Signed in — wait for the backend load, then onboard or run the app.
  // IMPORTANT: groupCount > 0 means a joinGroup() or createGroup() already
  // succeeded — show the shell immediately regardless of the hydrated flag,
  // which can lag behind due to Supabase auth-change events that reset it.
  const gc = store.groupCount();
  if (!hydrated && gc === 0) return <Splash />;
  if (gc === 0) return <MobileOnboard store={store} user={user} />;

  return <MobileShell store={store} user={user} onLogout={onLogout} />;
}

function Splash() {
  return (
    <div className="cha-m">
      <div className="cha-splash">
        <div className="cha-splash-logo">
          <span className="cha-ribbon" />
          <Logo className="cha-logo cha-logo--on-dark" />
        </div>
        <div className="cha-brand">ChamaOne</div>
        <div className="cha-tag">Your Chama, in your pocket</div>
      </div>
    </div>
  );
}

// A single member glyph: head + rounded shoulders.
function Person({ cx, cy, r, sr, fill }) {
  return (
    <g fill={fill}>
      <circle cx={cx} cy={cy} r={r} />
      <rect x={cx - sr} y={cy + r * 0.35} width={sr * 2} height={sr * 1.15} rx={sr * 0.62} />
    </g>
  );
}

// ChamaOne mark: three members united around a gold coin (the group pool),
// on a deep-navy squircle. Scales crisply at every size.
export function Logo({ className }) {
  return (
    <svg className={className} viewBox="0 0 512 512" width="112" height="112" aria-label="ChamaOne">
      <defs>
        <linearGradient id="chaBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#18294A" />
          <stop offset="1" stopColor="#0B1120" />
        </linearGradient>
        <radialGradient id="chaCoin" cx="0.5" cy="0.38" r="0.75">
          <stop offset="0" stopColor="#FCD34D" />
          <stop offset="0.55" stopColor="#F59E0B" />
          <stop offset="1" stopColor="#C2740A" />
        </radialGradient>
      </defs>
      <rect x="24" y="24" width="464" height="464" rx="112" fill="url(#chaBg)" />
      <path d="M256 120 L138 322 L374 322 Z" fill="none" stroke="#2563EB" strokeOpacity="0.45" strokeWidth="14" strokeLinejoin="round" />
      <Person cx={256} cy={118} r={34} sr={40} fill="#60A5FA" />
      <Person cx={138} cy={322} r={30} sr={36} fill="#3B82F6" />
      <Person cx={374} cy={322} r={30} sr={36} fill="#2563EB" />
      <circle cx="256" cy="300" r="74" fill="#0B1120" />
      <circle cx="256" cy="300" r="60" fill="url(#chaCoin)" />
      <circle cx="256" cy="300" r="60" fill="none" stroke="#FDE68A" strokeOpacity="0.55" strokeWidth="3" />
      <circle cx="256" cy="300" r="38" fill="none" stroke="#9A5B08" strokeOpacity="0.5" strokeWidth="6" />
    </svg>
  );
}
