import { useEffect, useState } from 'react';
import { Coins, CreditCard, Vote, ShieldCheck, Download, ArrowRight } from 'lucide-react';
import { Logo } from '../App';
import './mobile.css';

// Public front door (the site root in a browser). Explains ChamaOne and offers
// Install / Download, plus a way into the web app. Installed/native users skip
// this and go straight to the app (see App.jsx).
const FEATURES = [
  { icon: Coins, title: 'Transparent contributions', text: 'Every shilling in, who paid, and when — books the whole group can trust.' },
  { icon: CreditCard, title: 'Loans with group voting', text: 'Members apply, the group votes in-app, interest and repayments track themselves.' },
  { icon: Vote, title: 'Meetings & motions', text: 'Agendas, minutes, and live Yes/No/Abstain voting — even for members abroad.' },
  { icon: ShieldCheck, title: 'A tamper-evident ledger', text: 'One shared record, synced across every member’s phone in real time.' },
];

export default function MobileLanding({ onEnter }) {
  const [deferred, setDeferred] = useState(null);

  useEffect(() => {
    const onBIP = (e) => { e.preventDefault(); setDeferred(e); };
    window.addEventListener('beforeinstallprompt', onBIP);
    return () => window.removeEventListener('beforeinstallprompt', onBIP);
  }, []);

  const install = async () => {
    if (!deferred) { window.location.href = '/get'; return; }
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  return (
    <div className="cha-m">
      <div className="cha-auth" style={{ display: 'block' }}>
        <div className="cha-auth-hero" style={{ minHeight: 300, paddingBottom: 40 }}>
          <span className="cha-auth-halo" style={{ width: 260, height: 260, right: -90, top: -100 }} />
          <span className="cha-auth-halo" style={{ width: 170, height: 170, left: -50, top: 90, opacity: 0.12 }} />
          <div className="cha-auth-center" style={{ paddingTop: 12 }}>
            <Logo className="cha-logo" />
            <div className="cha-auth-brand" style={{ marginTop: 8 }}>ChamaOne</div>
            <div className="cha-auth-tag" style={{ maxWidth: 280 }}>Run your Chama with confidence — contributions, loans, meetings and books everyone can trust.</div>
          </div>
        </div>

        <div className="cha-auth-sheet" style={{ marginTop: -28 }}>
          <button className="cha-btn" onClick={install}><Download size={18} /> Install the app</button>
          <button className="cha-btn cha-btn-ghost" onClick={onEnter}>Open in browser <ArrowRight size={17} /></button>
          <a className="cha-btn cha-btn-ghost" href="/ChamaOne.apk" download style={{ textDecoration: 'none' }}>🤖 Download Android APK (v11.1)</a>

          <div style={{ marginTop: 10, display: 'grid', gap: 12 }}>
            {FEATURES.map((f) => (
              <div key={f.title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span className="cha-ic" style={{ width: 40, height: 40, flex: '0 0 auto', borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--blue-50)', color: 'var(--blue)' }}>
                  <f.icon size={20} />
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{f.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>{f.text}</div>
                </div>
              </div>
            ))}
          </div>

          <p className="cha-about" style={{ marginTop: 14 }}>Built for Kenyan Chamas · KES throughout 🇰🇪</p>
        </div>
      </div>
    </div>
  );
}
