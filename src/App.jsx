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
  let screen;
  if (!account) {
    screen = !entered ? <MobileLanding onEnter={() => setEntered(true)} /> : <MobileAuth onAuthed={(u) => setAccount(u)} />;
  } else {
    const gc = store.groupCount();
    if (!hydrated && gc === 0) screen = <Splash />;
    else if (gc === 0) screen = <MobileOnboard store={store} user={user} />;
    else screen = <MobileShell store={store} user={user} onLogout={onLogout} />;
  }

  return (
    <>
      <UpdateBanner />
      {screen}
    </>
  );
}

function UpdateBanner() {
  const [newVersion, setNewVersion] = useState(null);
  const currentVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '11.1.0';

  useEffect(() => {
    // 1) Check remote version.json
    const checkVersion = async () => {
      try {
        const url = isNative()
          ? `https://chama-one-ten.vercel.app/version.json?_t=${Date.now()}`
          : `/version.json?_t=${Date.now()}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data?.version && data.version !== currentVersion) {
            setNewVersion(data.version);
          }
        }
      } catch { /* offline / network error */ }
    };

    checkVersion();
    const timer = setInterval(checkVersion, 60000);

    // 2) Listen for service worker updates (PWA)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        setNewVersion((v) => v || 'new');
      });
    }

    return () => clearInterval(timer);
  }, [currentVersion]);

  if (!newVersion) return null;

  const handleUpdate = () => {
    if (isNative()) {
      window.location.href = 'https://chama-one-ten.vercel.app/ChamaOne.apk';
    } else {
      window.location.reload();
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 'calc(var(--safe-top, max(env(safe-area-inset-top, 0px), 36px)) + 8px)',
      left: 12,
      right: 12,
      zIndex: 99999,
      background: 'linear-gradient(135deg, #1E3A8A 0%, #0F172A 100%)',
      color: '#fff',
      padding: '10px 14px',
      borderRadius: 16,
      border: '1px solid rgba(147, 180, 251, 0.35)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      boxShadow: '0 8px 28px rgba(0,0,0,0.4)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>🚀</span>
        <div style={{ lineHeight: 1.25, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#F8FAFC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Update Available
          </div>
          <div style={{ fontSize: 11, color: '#93B4FB' }}>
            Version {newVersion !== 'new' ? `v${newVersion}` : 'latest'}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        <button
          onClick={handleUpdate}
          style={{
            background: 'linear-gradient(135deg, #F59E0B, #D97706)',
            color: '#000',
            border: 'none',
            borderRadius: 8,
            padding: '7px 13px',
            fontSize: 12,
            fontWeight: 800,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 6px rgba(245,158,11,0.3)',
          }}
        >
          {isNative() ? 'Download APK' : 'Update Now'}
        </button>
        <button
          onClick={() => setNewVersion(null)}
          style={{
            background: 'rgba(255,255,255,0.14)',
            color: '#E2E8F0',
            border: 'none',
            borderRadius: '50%',
            width: 26,
            height: 26,
            display: 'grid',
            placeItems: 'center',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            padding: 0,
          }}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
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
