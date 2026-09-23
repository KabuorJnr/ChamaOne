import { useState, useEffect } from 'react';
import { ArrowRight, ShieldAlert, CheckCircle2, Hourglass, RefreshCw, LogOut } from 'lucide-react';
import { Logo } from '../App';
import { isSupabaseConfigured } from '../lib/supabase';
import './mobile.css';

// First-run screen for a signed-in user with no Chama yet. Creating the group
// makes the current user its Chairperson (the first member, linked to this
// account) — which is what lets them see the group under RLS.
export default function MobileOnboard({ store, user }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('Savings Group');
  const [amt, setAmt] = useState('');
  const [freq, setFreq] = useState('monthly');
  const [phone, setPhone] = useState('');
  const [mem, setMem] = useState('');
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [mode, setMode] = useState('create');   // 'create' | 'join'
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  // Auto-fill from invite link if present in storage
  useEffect(() => {
    try {
      const pending = localStorage.getItem('chamaone.pending_join');
      if (pending) {
        setCode(pending);
        setMode('join');
      }
    } catch {}
  }, []);

  const requests = store.myJoinRequests();

  const join = async () => {
    if (!code.trim()) { setErr('Enter an invite code or paste a join link'); return; }
    setErr(''); setInfo(''); setBusy(true);
    try {
      const r = await store.joinGroup(code.trim());
      if (!r.ok) { setErr(r.error || 'Could not join'); return; }
      try { localStorage.removeItem('chamaone.pending_join'); } catch {}
      setCode('');
      if (r.status === 'pending') setInfo(`Request sent to ${r.name || 'the Chama'}. An officer needs to approve you before you can see the group.`);
      // Otherwise groupCount flips to 1 and App swaps to the shell automatically.
    } catch (e) {
      setErr('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const checkAgain = async () => {
    setErr(''); setInfo(''); setBusy(true);
    try {
      const { approved, declined } = await store.pollJoinRequests();
      if (declined.length) setErr(`Your request to join ${declined[0]} was declined.`);
      else if (!approved.length) setInfo('Still waiting for an officer to approve you.');
    } finally { setBusy(false); }
  };

  const cancel = async (req) => {
    setBusy(true);
    const r = await store.cancelJoinRequest(req.groupId);
    setBusy(false);
    if (!r.ok) setErr(r.error || 'Could not cancel the request');
  };

  const create = () => {
    if (!name.trim()) { setErr('Enter a group name'); return; }
    setErr('');
    const extra = mem.split('\n').map((l) => l.trim()).filter(Boolean)
      .map((l) => { const [nm, ph] = l.split(',').map((s) => s.trim()); return { name: nm, phone: ph || '' }; })
      .filter((m) => m.name);
    // Creator first → Chairperson, linked to this account.
    const members = [{ name: user?.name || 'Me', phone }, ...extra];
    store.createGroup({ name, type, amount: amt, frequency: freq, members });
    // groupCount flips to 1 and App swaps to the shell automatically.
  };

  return (
    <div className="cha-m">
      <div className="cha-auth">
        <div className="cha-auth-hero" style={{ minHeight: 180 }}>
          <span className="cha-auth-halo" style={{ width: 230, height: 230, right: -80, top: -90 }} />
          <div className="cha-auth-center">
            <Logo className="cha-logo" />
            <div className="cha-auth-brand">{mode === 'create' ? 'Create your Chama' : 'Join a Chama'}</div>
            <div className="cha-auth-tag">{mode === 'create' ? 'Set up in under a minute — you’ll be the Chairperson' : 'Paste an invite link or enter the code shared with you'}</div>
          </div>
        </div>

        <div className="cha-auth-sheet">
          {isSupabaseConfigured && (
            <div className="cha-btn-row" style={{ marginBottom: 12 }}>
              <button className={`cha-btn cha-btn-sm ${mode === 'create' ? '' : 'cha-btn-ghost'}`} onClick={() => { setMode('create'); setErr(''); setInfo(''); }}>Create Chama</button>
              <button className={`cha-btn cha-btn-sm ${mode === 'join' ? '' : 'cha-btn-ghost'}`} onClick={() => { setMode('join'); setErr(''); setInfo(''); }}>Join with Link / Code</button>
            </div>
          )}

          {err && <div className="cha-auth-err"><ShieldAlert size={18} /> {err}</div>}
          {info && <div className="cha-card" style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', marginBottom: 12, padding: 12, fontSize: 13, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8 }}><CheckCircle2 size={18} color="#059669" /> {info}</div>}

          {requests.map((req) => (
            <div key={req.groupId} className="cha-card" style={{ background: '#fffbeb', border: '1px solid #fde68a', marginBottom: 12, padding: 14, borderRadius: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: '#92400e', fontSize: 14 }}>
                <Hourglass size={17} /> Waiting for approval
              </div>
              <p style={{ margin: '6px 0 10px', fontSize: 13, color: '#78350f', lineHeight: 1.45 }}>
                You asked to join <b>{req.name}</b>. The Chairperson or Treasurer has to approve you first — this screen opens the Chama automatically once they do.
              </p>
              <div className="cha-btn-row">
                <button className="cha-btn cha-btn-sm" onClick={checkAgain} disabled={busy}><RefreshCw size={14} /> Check now</button>
                <button className="cha-btn cha-btn-ghost cha-btn-sm" onClick={() => cancel(req)} disabled={busy}>Cancel request</button>
              </div>
            </div>
          ))}

          {mode === 'join' ? (
            <>
              <label className="cha-field"><span>Invite link or code</span>
                <input className="cha-input" value={code} onChange={(e) => setCode(e.target.value)}
                  placeholder="Paste https://… or enter code" style={{ fontSize: 15 }} /></label>
              <button className="cha-btn" onClick={join} disabled={busy} style={{ marginTop: 4 }}>{busy ? 'Sending…' : <>Join Chama <ArrowRight size={18} /></>}</button>
              <p className="cha-muted cha-small" style={{ marginTop: 10 }}>
                Most Chamas approve new members first. A personal invite code from an officer lets you in straight away.
              </p>
            </>
          ) : (
            <>
              <label className="cha-field"><span>Group name</span>
                <input className="cha-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Faida Savings Group" /></label>
              <label className="cha-field"><span>Type</span>
                <select className="cha-select" value={type} onChange={(e) => setType(e.target.value)}>
                  <option>Savings Group</option><option>Investment Club</option><option>Merry-go-round</option>
                  <option>Welfare Group</option><option>Table Banking</option>
                </select></label>
              <div className="cha-grid2">
                <label className="cha-field"><span>Contribution (KES)</span>
                  <input className="cha-input cha-num" type="number" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="2000" /></label>
                <label className="cha-field"><span>Frequency</span>
                  <select className="cha-select" value={freq} onChange={(e) => setFreq(e.target.value)}>
                    <option value="monthly">Monthly</option><option value="weekly">Weekly</option><option value="daily">Daily</option>
                  </select></label>
              </div>
              <label className="cha-field"><span>Your phone (optional)</span>
                <input className="cha-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712345678" /></label>
              <label className="cha-field"><span>Add members (optional — one per line: Name, Phone)</span>
                <textarea className="cha-textarea" rows={3} value={mem} onChange={(e) => setMem(e.target.value)}
                  placeholder={'James Otieno, 0733200300\nFatuma Ali, 0711300400'} /></label>

              <button className="cha-btn" onClick={create} style={{ marginTop: 4 }}>Create group <ArrowRight size={18} /></button>
            </>
          )}

          {user?.onLogout && (
            <button className="cha-btn cha-btn-ghost cha-btn-sm" onClick={user.onLogout} style={{ marginTop: 16 }}>
              <LogOut size={14} /> Sign out
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
