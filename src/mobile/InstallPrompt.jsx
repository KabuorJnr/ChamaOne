import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Download, X } from 'lucide-react';

// A one-tap "add to home screen" nudge for people using ChamaOne in a browser
// (not the installed PWA and not the native app). Dismissible, remembered.
const KEY = 'chamaone.install.dismissed';

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [show, setShow] = useState(false);
  const [iOS, setIOS] = useState(false);

  useEffect(() => {
    try { if (Capacitor?.isNativePlatform?.()) return; } catch { /* ignore */ }
    const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone;
    if (standalone) return;
    try { if (localStorage.getItem(KEY) === '1') return; } catch { /* ignore */ }

    const onBIP = (e) => { e.preventDefault(); setDeferred(e); setShow(true); };
    const onInstalled = () => { setShow(false); try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ } };
    window.addEventListener('beforeinstallprompt', onBIP);
    window.addEventListener('appinstalled', onInstalled);

    if (/iP(hone|ad|od)/.test(navigator.userAgent || '')) { setIOS(true); setShow(true); }
    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!show) return null;

  const dismiss = () => { setShow(false); try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ } };
  const install = async () => {
    if (deferred) {
      deferred.prompt();
      await deferred.userChoice;
      setDeferred(null); setShow(false);
    } else {
      window.location.href = '/get';
    }
  };

  return (
    <div style={wrap}>
      <div style={inner}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Install ChamaOne</div>
          <div style={{ fontSize: 12, color: '#94A3B8' }}>{iOS ? 'Tap Share → Add to Home Screen' : 'Add it to your home screen for the full app'}</div>
        </div>
        {iOS ? (
          <a href="/get" style={btn}>How</a>
        ) : (
          <button onClick={install} style={btn}><Download size={15} /> Install</button>
        )}
        <button onClick={dismiss} aria-label="Dismiss" style={xbtn}><X size={16} /></button>
      </div>
    </div>
  );
}

const wrap = {
  position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
  display: 'flex', justifyContent: 'center',
  paddingTop: 'env(safe-area-inset-top, 0px)',
  background: 'linear-gradient(#0F172A, #0F172A)',
  boxShadow: '0 2px 12px rgba(0,0,0,.35)',
};
const inner = { width: '100%', maxWidth: 480, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', color: '#E2E8F0' };
const btn = {
  display: 'inline-flex', alignItems: 'center', gap: 6, background: '#2563EB', color: '#fff',
  border: 0, borderRadius: 10, padding: '9px 14px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
  textDecoration: 'none', whiteSpace: 'nowrap',
};
const xbtn = { background: 'transparent', border: 0, color: '#64748B', cursor: 'pointer', padding: 6, display: 'inline-flex' };
