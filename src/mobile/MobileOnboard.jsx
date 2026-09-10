import { useState } from 'react';
import { ArrowRight, ShieldAlert } from 'lucide-react';
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
  const [mode, setMode] = useState('create');   // 'create' | 'join'
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const join = async () => {
    if (!code.trim()) { setErr('Enter an invite code'); return; }
    setErr(''); setBusy(true);
    try {
      const r = await store.joinGroup(code.trim());
      if (!r.ok) { setErr(r.error || 'Could not join'); return; }
      // groupCount flips to 1 and App swaps to the shell automatically.
    } catch (e) {
      setErr('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
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
            <div className="cha-auth-tag">{mode === 'create' ? 'Set up in under a minute — you’ll be the Chairperson' : 'Enter the invite code your Chairperson shared'}</div>
          </div>
        </div>

        <div className="cha-auth-sheet">
          {isSupabaseConfigured && (
            <div className="cha-btn-row" style={{ marginBottom: 12 }}>
              <button className={`cha-btn cha-btn-sm ${mode === 'create' ? '' : 'cha-btn-ghost'}`} onClick={() => { setMode('create'); setErr(''); }}>Create</button>
              <button className={`cha-btn cha-btn-sm ${mode === 'join' ? '' : 'cha-btn-ghost'}`} onClick={() => { setMode('join'); setErr(''); }}>Join with code</button>
            </div>
          )}

          {err && <div className="cha-auth-err"><ShieldAlert size={18} /> {err}</div>}

          {mode === 'join' ? (
            <>
              <label className="cha-field"><span>Invite code</span>
                <input className="cha-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder="e.g. 7QK2M9" maxLength={8} style={{ fontFamily: 'monospace', letterSpacing: 3, fontSize: 20, textAlign: 'center' }} /></label>
              <button className="cha-btn" onClick={join} disabled={busy} style={{ marginTop: 4 }}>{busy ? 'Joining…' : <>Join group <ArrowRight size={18} /></>}</button>
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
        </div>
      </div>
    </div>
  );
}
