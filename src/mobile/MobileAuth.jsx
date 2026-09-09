import { useState } from 'react';
import { User, Lock, Eye, EyeOff, ArrowRight, ShieldAlert } from 'lucide-react';
import { Logo } from '../App';
import { hasAccount, accountUsername, createAccount, login } from '../lib/auth';
import './mobile.css';

// The account gate. Sign up on first run (no account yet), otherwise log in.
export default function MobileAuth({ onAuthed }) {
  const existing = hasAccount();
  const [mode, setMode] = useState(existing ? 'login' : 'signup');
  const [username, setUsername] = useState(existing ? accountUsername() : '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (mode === 'signup') {
      if (password !== confirm) { setError('Passwords do not match.'); return; }
      setBusy(true);
      const r = await createAccount(username, password);
      setBusy(false);
      if (!r.ok) { setError(r.error); return; }
      onAuthed(r.username);
    } else {
      if (!username.trim() || !password) { setError('Enter your username and password.'); return; }
      setBusy(true);
      const r = await login(username, password);
      setBusy(false);
      if (!r.ok) { setError(r.error); return; }
      onAuthed(r.username);
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
            <p>{mode === 'signup' ? 'Set a username and password to secure this device.' : 'Sign in to continue.'}</p>
          </div>

          {error && <div className="cha-auth-err"><ShieldAlert size={18} /> {error}</div>}

          <label className="cha-field"><span>Username</span>
            <div className="cha-authin">
              <User size={18} />
              <input autoCapitalize="none" autoCorrect="off" placeholder="e.g. grace_w"
                value={username} onChange={(e) => setUsername(e.target.value)} disabled={mode === 'login' && !!accountUsername() && false} />
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
              ? (hasAccount() ? <>Already set up? <button type="button" className="cha-link" onClick={() => { setMode('login'); setError(''); }}>Sign in</button></> : null)
              : <>New here? <button type="button" className="cha-link" onClick={() => { setMode('signup'); setError(''); setUsername(''); }}>Create an account</button></>}
          </div>
          <p className="cha-muted cha-small" style={{ textAlign: 'center', marginTop: 4 }}>
            Your account is stored only on this device.
          </p>
        </form>
      </div>
    </div>
  );
}
