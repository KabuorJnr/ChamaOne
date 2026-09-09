import { useState, useEffect } from 'react';
import MobileShell from './mobile/MobileShell';
import MobileAuth from './mobile/MobileAuth';
import MobileOnboard from './mobile/MobileOnboard';
import { useChama, setNotifSink, getState, hydrate, setCurrentUser, stopRealtime } from './store/chama';
import { notify as deviceNotify } from './lib/notifications';
import { currentUser, onAuthChange, signOut } from './lib/account';
import './mobile/mobile.css';

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
  const user = { name: account?.name || 'Member', role: 'chairperson', onLogout };

  // Hold the splash until the branded delay AND the session check are both done,
  // so a signed-in user never flashes the login screen.
  if (splash || !authReady) return <Splash />;

  // Gate the app behind the account login until signed in.
  if (!account) return <MobileAuth onAuthed={(u) => setAccount(u)} />;

  // Signed in — wait for the backend load, then onboard or run the app.
  if (!hydrated) return <Splash />;
  if (store.groupCount() === 0) return <MobileOnboard store={store} user={user} />;

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

export function Logo({ className }) {
  // Simple inline mark: three linked members (unity) around a coin. Monochrome
  // blue on the dark ground — matches the standard palette.
  const dot = '#60A5FA';
  return (
    <svg className={className} viewBox="0 0 512 512" width="120" height="120" aria-label="ChamaOne">
      <g fill="none" strokeLinecap="round">
        <circle cx="256" cy="140" r="44" fill={dot} />
        <circle cx="150" cy="330" r="44" fill={dot} />
        <circle cx="362" cy="330" r="44" fill={dot} />
        <path d="M256 140 L150 330 L362 330 Z" stroke="#ffffff" strokeOpacity="0.9" strokeWidth="22" />
      </g>
      <circle cx="256" cy="278" r="40" fill="#ffffff" />
      <text x="256" y="294" fontFamily="Sora, sans-serif" fontSize="42" fontWeight="800" textAnchor="middle" fill="#1E3A8A">₭</text>
    </svg>
  );
}
