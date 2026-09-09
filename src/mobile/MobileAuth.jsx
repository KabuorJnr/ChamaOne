import { useState } from 'react';
import { User, Lock, Mail, Eye, EyeOff, ArrowRight, ShieldAlert, MailCheck } from 'lucide-react';
import { Logo } from '../App';
import { signUp, signIn, authMode } from '../lib/account';
import './mobile.css';

// The account gate. Email + password via Supabase Auth (or the device-local
// gate when no backend is configured).
export default function MobileAuth({ onAuthed }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const local = authMode === 'local';

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setNotice('');
    if (!email.trim() || !password) { setError('Enter your email and password.'); return; }

    if (mode === 'signup') {
      if (!local && !name.trim()) { setError('Enter your name.'); return; }
      if (password !== confirm) { setError('Passwords do not match.'); return; }
      setBusy(true);
      const r = await signUp({ name, email, password });
      setBusy(false);
      if (!r.ok) { setError(r.error); return; }
      if (r.needsConfirmation) {
        setNotice('Check your email to confirm your account, then sign in.');
        setMode('login'); setPassword(''); setConfirm('');
        return;
      }
      onAuthed(r.user);
    } else {
      setBusy(true);
      const r = await signIn({ email, password });
      setBusy(false);
      if (!r.ok) { setError(r.error); return; }
      onAuthed(r.user);
    }
  };

  return (
    <div className="cha-m">
      <div className="cha-auth">
        <div className="cha-auth-hero">
          <span className="cha-auth-halo" style={{ width: 230, height: 230, right: -80, top: -90 }} />
          <span className="cha-auth-halo" style={{ width: 150, height: 150, left: -40, top: 70, opacity: 0.12 }} />
          <div className="cha-auth-center">
            <Logo className="cha-logo" />
            <div className="cha-auth-brand">ChamaOne</div>
            <div className="cha-auth-tag">Your Chama, in your pocket</div>
          </div>
        </div>

        <form className="cha-auth-sheet" onSubmit={submit}>
          <div className="cha-auth-head">
            <h3>{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h3>
            <p>{mode === 'signup' ? 'Sign up to run your Chama and sync with members.' : 'Sign in to continue.'}</p>
          </div>

          {error && <div className="cha-auth-err"><ShieldAlert size={18} /> {error}</div>}
          {notice && <div className="cha-auth-err" style={{ background: 'rgba(34,197,94,.12)', color: '#166534' }}><MailCheck size={18} /> {notice}</div>}

          {mode === 'signup' && !local && (
            <label className="cha-field"><span>Full name</span>
              <div className="cha-authin">
                <User size={18} />
                <input placeholder="e.g. Grace Wanjiru" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            </label>
          )}

          <label className="cha-field"><span>Email</span>
            <div className="cha-authin">
              <Mail size={18} />
              <input type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </label>

          <label className="cha-field"><span>Password</span>
            <div className="cha-authin">
              <Lock size={18} />
              <input type={showPw ? 'text' : 'password'} placeholder="At least 6 characters"
                value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="cha-eye" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Hide' : 'Show'}>
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          {mode === 'signup' && (
            <label className="cha-field"><span>Confirm password</span>
              <div className="cha-authin">
                <Lock size={18} />
                <input type={showPw ? 'text' : 'password'} placeholder="Re-enter your password"
                  value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
            </label>
          )}

          <button className="cha-btn" type="submit" disabled={busy} style={{ marginTop: 4 }}>
            {busy ? 'Please wait…' : <>{mode === 'signup' ? 'Create account' : 'Sign in'} <ArrowRight size={18} /></>}
          </button>

          <div className="cha-auth-foot">
            {mode === 'signup'
              ? <>Already have an account? <button type="button" className="cha-link" onClick={() => { setMode('login'); setError(''); setNotice(''); }}>Sign in</button></>
              : <>New here? <button type="button" className="cha-link" onClick={() => { setMode('signup'); setError(''); setNotice(''); }}>Create an account</button></>}
          </div>
          <p className="cha-muted cha-small" style={{ textAlign: 'center', marginTop: 4 }}>
            {local ? 'Your account is stored only on this device.' : 'Secured by ChamaOne. Your data syncs across your devices.'}
          </p>
        </form>
      </div>
    </div>
  );
}
