import { useState } from 'react';
import { Video, MapPin, RefreshCw } from 'lucide-react';
import { useUI, fmtKES, StkIcon } from './kit';
import { requestPayment } from '../../lib/mpesa';
import { scheduleAt } from '../../lib/notifications';
import { changePassword } from '../../lib/auth';

/* ---- open helpers (call from any screen with the UI ctx) ---- */
export const openCollect = (ui, store, memberId) =>
  ui.openSheet('Collect contribution', (close) => <CollectForm store={store} close={close} preselect={memberId} />);
export const openAddMember = (ui, store) =>
  ui.openSheet('Add member', (close) => <AddMemberForm store={store} close={close} />);
export const openApplyLoan = (ui, store, open) =>
  ui.openSheet('Apply for a loan', (close) => <ApplyLoanForm store={store} close={close} open={open} />);
export const openRepay = (ui, store, loanId) =>
  ui.openSheet('Record repayment', (close) => <RepayForm store={store} close={close} loanId={loanId} />);
export const openNewMeeting = (ui, store) =>
  ui.openSheet('Schedule meeting', (close) => <NewMeetingForm store={store} close={close} />);
export const openCreateGroup = (ui, store, open) =>
  ui.openSheet('Create your Chama', (close) => <CreateGroupForm store={store} close={close} open={open} />);
export const openChangePassword = (ui) =>
  ui.openSheet('Change password', (close) => <ChangePasswordForm close={close} />);

function ChangePasswordForm({ close }) {
  const { toast } = useUI();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (next.length < 6) return toast('New password must be at least 6 characters');
    if (next !== confirm) return toast('New passwords do not match');
    setBusy(true);
    const r = await changePassword(cur, next);
    setBusy(false);
    if (!r.ok) return toast(r.error || 'Could not change password');
    close(); toast('Password changed');
  };
  return (
    <>
      <label className="cha-field"><span>Current password</span>
        <input className="cha-input" type="password" value={cur} onChange={(e) => setCur(e.target.value)} /></label>
      <label className="cha-field"><span>New password</span>
        <input className="cha-input" type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="At least 6 characters" /></label>
      <label className="cha-field"><span>Confirm new password</span>
        <input className="cha-input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
      <button className="cha-btn" onClick={go} disabled={busy}>{busy ? 'Please wait…' : 'Update password'}</button>
    </>
  );
}

/* ---- collect (cash / M-Pesa STK) ---- */
function CollectForm({ store, close, preselect }) {
  const { toast } = useUI();
  const cy = store.activeCycle();
  const ms = store.members();
  const [memberId, setMemberId] = useState(preselect || ms[0]?.id);
  const [amount, setAmount] = useState(store.group.contributionAmount);
  const [method, setMethod] = useState('mpesa');
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const go = async () => {
    if (!amount) return toast('Enter an amount');
    const m = store.memberById(memberId);
    if (method === 'cash') {
      store.recordContribution({ memberId, amount: Number(amount), method: 'cash' });
      close(); toast(`Recorded ${fmtKES(amount)} from ${m.name}`);
      return;
    }
    setBusy(true);
    await requestPayment({
      phone: m.phone, amount: Number(amount), memberId, accountRef: store.group.name.slice(0, 12),
      simulate: store.settings.simulateMpesa,
      onUpdate: (s) => setStatus(s),
    });
    setBusy(false);
    setTimeout(close, 1100);
  };

  return (
    <>
      <label className="cha-field"><span>Member</span>
        <select className="cha-select" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
          {ms.map((m) => {
            const st = store.memberStatus(m.id, cy.id);
            return <option key={m.id} value={m.id}>{m.name} — {st.state === 'paid' ? 'paid' : `${fmtKES(st.paid)} / ${fmtKES(st.target)}`}</option>;
          })}
        </select>
      </label>
      <label className="cha-field"><span>Amount (KES)</span>
        <input className="cha-input cha-num" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <div className="cha-seg">
        <button className={`cha-seg-b${method === 'mpesa' ? ' on' : ''}`} onClick={() => setMethod('mpesa')}>M-Pesa STK</button>
        <button className={`cha-seg-b${method === 'cash' ? ' on' : ''}`} onClick={() => setMethod('cash')}>Cash</button>
      </div>
      {status && <div className={`cha-stk show ${status.stage}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}><StkIcon stage={status.stage} /> <span>{status.text}</span></div>}
      <button className="cha-btn" onClick={go} disabled={busy}>
        {busy ? 'Sending…' : method === 'mpesa' ? 'Request payment' : 'Record cash'}
      </button>
    </>
  );
}
/* ---- add member ---- */
function AddMemberForm({ store, close }) {
  const { toast } = useUI();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('Member');
  return (
    <>
      <label className="cha-field"><span>Full name</span>
        <input className="cha-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jane Njeri" /></label>
      <label className="cha-field"><span>Phone</span>
        <input className="cha-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678" /></label>
      <label className="cha-field"><span>Role</span>
        <select className="cha-select" value={role} onChange={(e) => setRole(e.target.value)}>
          <option>Member</option><option>Treasurer</option><option>Secretary</option><option>Chairperson</option>
        </select></label>
      <button className="cha-btn" onClick={() => {
        if (!name.trim()) return toast('Enter a name');
        store.addMember({ name, phone, role }); close(); toast(`${name} added`);
      }}>Add member</button>
    </>
  );
}

/* ---- apply loan ---- */
function ApplyLoanForm({ store, close, open }) {
  const { toast } = useUI();
  const ms = store.members();
  const rate = store.group.loanInterest;
  const [memberId, setMemberId] = useState(ms[0]?.id);
  const [amt, setAmt] = useState('');
  const [term, setTerm] = useState(3);
  const [purpose, setPurpose] = useState('');
  const p = Number(amt) || 0;
  const interest = (p * rate) / 100;
  return (
    <>
      <label className="cha-field"><span>Member</span>
        <select className="cha-select" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
          {ms.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select></label>
      <label className="cha-field"><span>Amount (KES)</span>
        <input className="cha-input cha-num" type="number" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="e.g. 10000" /></label>
      <div className="cha-grid2">
        <label className="cha-field"><span>Term (months)</span>
          <input className="cha-input cha-num" type="number" value={term} onChange={(e) => setTerm(e.target.value)} /></label>
        <label className="cha-field"><span>Interest</span>
          <input className="cha-input" value={`${rate}% flat`} disabled /></label>
      </div>
      <label className="cha-field"><span>Purpose</span>
        <input className="cha-input" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. school fees" /></label>
      {p > 0 && (
        <div className="cha-preview">
          <div className="r"><span>Interest ({rate}%)</span><span>{fmtKES(interest)}</span></div>
          <div className="r total"><span>Total repayable</span><span>{fmtKES(p + interest)}</span></div>
        </div>
      )}
      <button className="cha-btn" onClick={() => {
        if (!p) return toast('Enter an amount');
        store.applyLoan({ memberId, principal: p, termMonths: Number(term), purpose });
        close(); toast('Loan submitted for vote'); open && open('loans');
      }}>Submit for vote</button>
    </>
  );
}

/* ---- repay ---- */
function RepayForm({ store, close, loanId }) {
  const { toast } = useUI();
  const l = store.loanById(loanId);
  const t = store.loanTotals(l);
  const [amt, setAmt] = useState(Math.min(t.outstanding, Math.round(t.total / (l.termMonths || 1))));
  return (
    <>
      <div className="cha-preview"><div className="r"><span>Outstanding</span><span>{fmtKES(t.outstanding)}</span></div></div>
      <label className="cha-field"><span>Amount (KES)</span>
        <input className="cha-input cha-num" type="number" value={amt} onChange={(e) => setAmt(e.target.value)} /></label>
      <button className="cha-btn" onClick={() => {
        if (!Number(amt)) return toast('Enter an amount');
        store.repayLoan(loanId, Number(amt)); close(); toast('Repayment recorded');
      }}>Record</button>
    </>
  );
}

/* ---- new meeting (in-person or online) ---- */
function NewMeetingForm({ store, close }) {
  const { toast } = useUI();
  const now = new Date();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(now.toISOString().slice(0, 10));
  const [time, setTime] = useState(`${String(now.getHours()).padStart(2, '0')}:00`);
  const [online, setOnline] = useState(false);
  const [loc, setLoc] = useState('');
  const [link, setLink] = useState('');
  const [agenda, setAgenda] = useState('');

  const pickOnline = (v) => {
    setOnline(v);
    if (v && !link) setLink(store.makeMeetingLink(title || 'meeting'));
  };

  return (
    <>
      <label className="cha-field"><span>Title</span>
        <input className="cha-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Monthly Review" /></label>
      <div className="cha-grid2">
        <label className="cha-field"><span>Date</span>
          <input className="cha-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="cha-field"><span>Start time</span>
          <input className="cha-input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
      </div>
      <div className="cha-seg">
        <button className={`cha-seg-b${online ? '' : ' on'}`} onClick={() => pickOnline(false)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><MapPin size={14} /> In person</button>
        <button className={`cha-seg-b${online ? ' on' : ''}`} onClick={() => pickOnline(true)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Video size={14} /> Online</button>
      </div>
      {online ? (
        <label className="cha-field"><span>Meeting link</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="cha-input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.jit.si/…" />
            <button className="cha-btn cha-btn-ghost cha-btn-sm" style={{ width: 'auto', padding: '0 12px' }} title="Generate a new link" onClick={() => setLink(store.makeMeetingLink(title || 'meeting'))}><RefreshCw size={16} /></button>
          </div>
          <span className="cha-muted cha-small" style={{ marginTop: 6, display: 'block' }}>A Jitsi link is generated automatically — no account needed. Paste a Zoom/Meet link to use your own.</span>
        </label>
      ) : (
        <label className="cha-field"><span>Location</span>
          <input className="cha-input" value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="e.g. Grace’s residence" /></label>
      )}
      <label className="cha-field"><span>Agenda (one per line)</span>
        <textarea className="cha-textarea" rows={3} value={agenda} onChange={(e) => setAgenda(e.target.value)} placeholder={'Review contributions\nVote on loans'} /></label>
      <button className="cha-btn" onClick={() => {
        if (!title.trim()) return toast('Enter a title');
        const when = new Date(`${date}T${time || '09:00'}`);
        const finalLink = online ? (link.trim() || store.makeMeetingLink(title)) : '';
        store.createMeeting({
          title, date: when.toISOString(), online, link: finalLink,
          location: loc, agenda: agenda.split('\n').map((s) => s.trim()).filter(Boolean),
        });
        // Phone reminders (fire only if the user granted permission): 1h before + at start.
        scheduleAt({ title: `Meeting soon: ${title}`, body: online ? 'Tap to join the online meeting.' : `At ${loc || 'the usual venue'}.`, at: new Date(when.getTime() - 3600000) });
        scheduleAt({ title: `Starting now: ${title}`, body: online ? 'Your online Chama meeting is starting.' : 'Your Chama meeting is starting.', at: when });
        close(); toast(online ? 'Online meeting scheduled' : 'Meeting scheduled');
      }}>Schedule</button>
    </>
  );
}

/* ---- group switcher ---- */
export const openGroupSwitcher = (ui, store, open) =>
  ui.openSheet('Your Chamas', (close) => <GroupSwitcher store={store} close={close} open={open} ui={ui} />);

function GroupSwitcher({ store, close, open, ui }) {
  const groups = store.listGroups();
  return (
    <>
      <p className="cha-muted cha-small" style={{ marginTop: 0 }}>Switch between the Chamas you run, or add another.</p>
      <div className="cha-list-card" style={{ marginBottom: 12 }}>
        {groups.map((g) => (
          <button className="cha-li" key={g.id} onClick={() => { store.switchGroup(g.id); close(); open && open('home'); ui.toast(`Switched to ${g.name}`); }}>
            <span className="cha-lic" style={{ background: g.active ? 'var(--blue)' : 'var(--blue-50)', color: g.active ? '#fff' : 'var(--blue)' }}>{initials(g.name)}</span>
            <div className="cha-lt"><b>{g.name}{g.active && <span className="cha-pill2 cha-pill-info" style={{ marginLeft: 6 }}>Current</span>}</b>
              <span>{g.type} · {g.memberCount} members · {fmtKES(g.balance)}</span></div>
          </button>
        ))}
      </div>
      <button className="cha-btn" onClick={() => { close(); openCreateGroup(ui, store, open); }}>+ Create a new Chama</button>
    </>
  );
}
function initials(name = '') {
  const p = String(name).trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || 'CH';
}

/* ---- create group wizard ---- */
function CreateGroupForm({ store, close, open }) {
  const { toast } = useUI();
  const [name, setName] = useState('');
  const [type, setType] = useState('Savings Group');
  const [amt, setAmt] = useState('');
  const [freq, setFreq] = useState('monthly');
  const [mem, setMem] = useState('');
  return (
    <>
      <p className="cha-muted cha-small" style={{ marginTop: 0 }}>Set up in under a minute. You’ll be the Chairperson.</p>
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
      <label className="cha-field"><span>Members (one per line: Name, Phone)</span>
        <textarea className="cha-textarea" rows={4} value={mem} onChange={(e) => setMem(e.target.value)}
          placeholder={'You (Chairperson), 0712345678\nJames Otieno, 0733200300'} /></label>
      <button className="cha-btn" onClick={() => {
        if (!name.trim()) return toast('Enter a group name');
        const rawMembers = mem.split('\n').map((l) => l.trim()).filter(Boolean)
          .map((l) => { const [nm, ph] = l.split(',').map((s) => s.trim()); return { name: nm, phone: ph || '' }; })
          .filter((m) => m.name);
        if (!rawMembers.length) return toast('Add at least yourself as a member');
        store.createGroup({ name, type, amount: amt, frequency: freq, members: rawMembers });
        close(); open && open('home'); toast(`${name} created`);
      }}>Create group</button>
    </>
  );
}
