import { useState } from 'react';
import { Video, MapPin, RefreshCw, MessageCircle, Copy, PhoneCall, Smartphone, ClipboardPaste, CheckCircle2 } from 'lucide-react';
import { useUI, fmtKES, StkIcon, Avatar } from './kit';
import { requestPayment } from '../../lib/mpesa';
import { parseMpesaSms } from '../../lib/mpesaParser';
import { scheduleAt } from '../../lib/notifications';
import { changePassword } from '../../lib/account';
import { isSupabaseConfigured } from '../../lib/supabase';
import { whatsappInviteUrl } from '../../lib/invite';

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
export const openReportPayment = (ui, store) =>
  ui.openSheet('Pay via M-Pesa (*334#)', (close) => <ReportPaymentForm store={store} close={close} ui={ui} />);
export const openNewProject = (ui, store) =>
  ui.openSheet('Start new project', (close) => <NewProjectForm store={store} close={close} />);
export const openAllocateProject = (ui, store, projectId) =>
  ui.openSheet('Allocate chama funds', (close) => <AllocateProjectForm store={store} close={close} projectId={projectId} />);
export const openDisburseRotation = (ui, store) =>
  ui.openSheet('Merry-Go-Round payout', (close) => <DisburseRotationForm store={store} close={close} />);

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
  const [added, setAdded] = useState(null);

  // Once added, hand the chairperson the member's invite code to send.
  if (added) return <InvitePanel store={store} member={added} close={close} />;

  return (
    <>
      <label className="cha-field"><span>Full name</span>
        <input className="cha-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jane Njeri" /></label>
      <label className="cha-field"><span>WhatsApp number</span>
        <input className="cha-input" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678" /></label>
      <label className="cha-field"><span>Role</span>
        <select className="cha-select" value={role} onChange={(e) => setRole(e.target.value)}>
          <option>Member</option><option>Treasurer</option><option>Secretary</option><option>Chairperson</option>
        </select></label>
      <button className="cha-btn" onClick={() => {
        if (!name.trim()) return toast('Enter a name');
        if (!phone.trim()) return toast('Enter their WhatsApp number');
        setAdded(store.addMember({ name, phone, role }));
      }}>Add member</button>
    </>
  );
}

/* ---- member invite (code + WhatsApp hand-off) ---- */
export const openInvite = (ui, store, member) =>
  ui.openSheet(`Invite ${member.name}`, (close) => <InvitePanel store={store} member={member} close={close} />);

function InvitePanel({ store, member, close }) {
  const { toast } = useUI();
  const code = member?.inviteCode || '';
  const wa = whatsappInviteUrl({ phone: member?.phone, groupName: store.group.name, memberName: member?.name, code });
  const copy = () => {
    try { navigator.clipboard?.writeText(code); toast('Invite code copied'); } catch { toast(code); }
  };
  return (
    <>
      <p className="cha-muted cha-small" style={{ marginTop: 0 }}>
        <b style={{ color: 'var(--ink)' }}>{member.name}</b> is on the roster. Send them this code — they create their own
        account (name + password), enter the code, and they&apos;re in.
      </p>
      <div style={{ background: 'var(--blue-50)', border: '1px solid var(--line)', borderRadius: 14, padding: 16, textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: 'var(--muted)' }}>INVITE CODE</div>
        <div className="cha-num" style={{ fontSize: 30, fontWeight: 800, letterSpacing: 6, color: 'var(--blue-deep)', marginTop: 4 }}>{code}</div>
      </div>
      <a className="cha-btn" href={wa} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
        <MessageCircle size={18} /> Send on WhatsApp
      </a>
      <button className="cha-btn cha-btn-ghost" onClick={copy}><Copy size={16} /> Copy code</button>
      <button className="cha-btn cha-btn-ghost" onClick={close}>Done</button>
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
  const code = store.group?.joinCode;
  const copy = () => { try { navigator.clipboard?.writeText(code); ui.toast('Invite code copied'); } catch { ui.toast(code); } };
  return (
    <>
      <p className="cha-muted cha-small" style={{ marginTop: 0 }}>Switch between your Chamas, invite members, or join one.</p>
      <div className="cha-list-card" style={{ marginBottom: 12 }}>
        {groups.map((g) => (
          <button className="cha-li" key={g.id} onClick={() => { store.switchGroup(g.id); close(); open && open('home'); ui.toast(`Switched to ${g.name}`); }}>
            <span className="cha-lic" style={{ background: g.active ? 'var(--blue)' : 'var(--blue-50)', color: g.active ? '#fff' : 'var(--blue)' }}>{initials(g.name)}</span>
            <div className="cha-lt"><b>{g.name}{g.active && <span className="cha-pill2 cha-pill-info" style={{ marginLeft: 6 }}>Current</span>}</b>
              <span>{g.type} · {g.memberCount} members · {fmtKES(g.balance)}</span></div>
          </button>
        ))}
      </div>

      {isSupabaseConfigured && code && store.canManageMembers() && (
        <div className="cha-card" style={{ marginBottom: 12 }}>
          <p className="cha-muted cha-small" style={{ marginTop: 0 }}>Invite members to <b>{store.group.name}</b> — share this code:</p>
          <button className="cha-btn cha-btn-ghost" onClick={copy} style={{ fontFamily: 'monospace', letterSpacing: 3, fontSize: 20 }}>{code}</button>
        </div>
      )}

      <button className="cha-btn" onClick={() => { close(); openCreateGroup(ui, store, open); }}>+ Create a new Chama</button>
      {isSupabaseConfigured && <JoinBox store={store} close={close} open={open} ui={ui} />}
    </>
  );
}
function JoinBox({ store, close, open, ui }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const join = async () => {
    if (!code.trim()) return ui.toast('Enter an invite code');
    setBusy(true);
    const r = await store.joinGroup(code.trim());
    setBusy(false);
    if (!r.ok) return ui.toast(r.error || 'Could not join');
    close(); open && open('home'); ui.toast(`Joined ${r.name}`);
  };
  return (
    <div style={{ marginTop: 14 }}>
      <p className="cha-muted cha-small">Have an invite code? Join a Chama:</p>
      <div className="cha-grid2" style={{ gridTemplateColumns: '1fr auto', gap: 8 }}>
        <input className="cha-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. 7QK2M9" style={{ fontFamily: 'monospace', letterSpacing: 2 }} maxLength={8} />
        <button className="cha-btn cha-btn-sm" onClick={join} disabled={busy} style={{ whiteSpace: 'nowrap' }}>{busy ? '…' : 'Join'}</button>
      </div>
    </div>
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

/* ---- member: pay via *334# and notify treasurer ---- */
function ReportPaymentForm({ store, close, ui }) {
  const ms = store.members();
  const [memberId, setMemberId] = useState(store.myMemberId() || ms[0]?.id || '');
  const [amt, setAmt] = useState(String(store.group.contributionAmount || ''));
  const [code, setCode] = useState('');
  const [smsText, setSmsText] = useState('');
  const [parsedInfo, setParsedInfo] = useState(null);
  const shortcode = store.settings?.shortcode;

  const handleSmsChange = (val) => {
    setSmsText(val);
    const res = parseMpesaSms(val);
    if (res && res.valid) {
      if (res.code) setCode(res.code);
      if (res.amount) setAmt(String(res.amount));
      setParsedInfo(res);
    }
  };

  const handleClipboard = async () => {
    try {
      if (navigator?.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          handleSmsChange(text);
          ui.toast('M-Pesa SMS pasted & parsed!');
          return;
        }
      }
    } catch { /* clipboard read blocked */ }
    ui.toast('Please tap the box and paste your SMS');
  };

  return (
    <>
      <div className="cha-card" style={{ background: 'var(--blue-50)', borderColor: 'var(--blue-100)', marginTop: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>Step 1: Pay to Chama via M-Pesa</div>
        <p className="cha-muted cha-small" style={{ margin: '4px 0 10px' }}>
          Dial <b>*334#</b> on your phone to send money or Lipa na M-Pesa {shortcode ? `to ${shortcode}` : 'to the Chama'}.
        </p>
        <a
          className="cha-btn cha-btn-sm"
          href="tel:*334%23"
          style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <PhoneCall size={14} /> Dial *334# on Phone
        </a>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 4 }}>Step 2: Notify Treasurer to Record</div>
        <p className="cha-muted cha-small" style={{ marginTop: 0 }}>
          Confirm your name, or paste the M-Pesa confirmation SMS to auto-fill the transaction code and amount.
        </p>

        <label className="cha-field"><span>Contributor (Your Name)</span>
          <select className="cha-select" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            {ms.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select></label>

        {/* Smart SMS Paste Box */}
        <div style={{ margin: '10px 0 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
              Paste M-Pesa SMS (Auto-Fill)
            </span>
            <button
              type="button"
              style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--blue)', background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              onClick={handleClipboard}
            >
              <ClipboardPaste size={13} /> Paste
            </button>
          </div>
          <textarea
            className="cha-input"
            rows={2}
            value={smsText}
            onChange={(e) => handleSmsChange(e.target.value)}
            placeholder="Paste your M-Pesa message here (e.g. QWX72918AB Confirmed. Ksh1,000.00 sent to...)"
            style={{ fontSize: 12, lineHeight: 1.4 }}
          />
          {parsedInfo && (
            <div style={{ marginTop: 6, padding: '6px 10px', background: 'var(--good-100)', borderRadius: 8, fontSize: 11.5, color: 'var(--good)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={14} />
              <span>Extracted: {parsedInfo.code ? `Ref: ${parsedInfo.code}` : ''}{parsedInfo.amount ? ` · KES ${parsedInfo.amount}` : ''}{parsedInfo.dateStr ? ` · ${parsedInfo.dateStr}` : ''}</span>
            </div>
          )}
        </div>

        <label className="cha-field"><span>Amount (KES)</span>
          <input className="cha-input cha-num" type="number" value={amt} onChange={(e) => setAmt(e.target.value)} /></label>
        <label className="cha-field"><span>M-Pesa confirmation code</span>
          <input className="cha-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. RGH12ABC" /></label>
        <button className="cha-btn" onClick={() => {
          if (!Number(amt)) return ui.toast('Enter an amount');
          store.reportPayment({ memberId, amount: amt, providerRef: code });
          close(); ui.toast('Payment reported — the treasurer will confirm and record it');
        }}>Notify Treasurer</button>
      </div>
    </>
  );
}

/* ---- new project form ---- */
function NewProjectForm({ store, close }) {
  const { toast } = useUI();
  const [title, setTitle] = useState('');
  const [cat, setCat] = useState('Investment');
  const [target, setTarget] = useState('');
  const [date, setDate] = useState('');
  const [desc, setDesc] = useState('');

  const submit = () => {
    if (!title.trim()) return toast('Enter a project title');
    const amt = Number(target);
    if (!amt || amt <= 0) return toast('Enter a valid target budget');
    store.createProject({
      title,
      category: cat,
      targetBudget: amt,
      targetDate: date,
      description: desc,
    });
    toast(`Project "${title}" created`);
    close();
  };

  return (
    <>
      <label className="cha-field"><span>Project Title</span>
        <input className="cha-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Land Purchase, Welfare Kitty, Agribusiness" /></label>
      <label className="cha-field"><span>Category</span>
        <select className="cha-select" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="Investment">Investment & Wealth</option>
          <option value="Real Estate">Land & Property</option>
          <option value="Agribusiness">Agriculture / Livestock</option>
          <option value="Welfare">Welfare & Emergency Kitty</option>
          <option value="Asset">Asset Acquisition</option>
          <option value="Business">Business Venture</option>
        </select></label>
      <label className="cha-field"><span>Target Budget (KES)</span>
        <input className="cha-input cha-num" type="number" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g. 500000" /></label>
      <label className="cha-field"><span>Target Completion Date (optional)</span>
        <input className="cha-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      <label className="cha-field"><span>Description & Objectives</span>
        <textarea className="cha-input" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What is the group aiming to achieve?" /></label>
      <button className="cha-btn" onClick={submit}>Create Project</button>
    </>
  );
}

/* ---- allocate to project form ---- */
function AllocateProjectForm({ store, close, projectId }) {
  const { toast } = useUI();
  const projects = store.getProjects().filter((p) => p.status !== 'completed');
  const [pid, setPid] = useState(projectId || projects[0]?.id || '');
  const [amt, setAmt] = useState('');
  const [note, setNote] = useState('');
  const pool = store.poolBalance();
  const selectedProject = projects.find((p) => p.id === pid);

  const submit = () => {
    if (!pid) return toast('Select a project');
    const numAmt = Number(amt);
    if (!numAmt || numAmt <= 0) return toast('Enter a valid allocation amount');
    if (numAmt > pool) return toast(`Amount exceeds available pool balance (${fmtKES(pool)})`);
    const res = store.allocateToProject(pid, numAmt, note);
    if (res?.error) return toast(res.error);
    toast(`Allocated ${fmtKES(numAmt)} to ${selectedProject?.title}`);
    close();
  };

  if (!projects.length) {
    return (
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <p className="cha-muted">No active projects to allocate funds to.</p>
        <button className="cha-btn cha-btn-sm" onClick={() => { close(); openNewProject({ openSheet: () => {} }, store); }}>Create a project first</button>
      </div>
    );
  }

  return (
    <>
      <div className="cha-card" style={{ background: 'var(--blue-50)', borderColor: 'var(--blue-100)', marginTop: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="cha-muted cha-small">Available Chama Pool</span>
          <b className="cha-num" style={{ color: 'var(--good)' }}>{fmtKES(pool)}</b>
        </div>
      </div>

      <label className="cha-field"><span>Project</span>
        <select className="cha-select" value={pid} onChange={(e) => setPid(e.target.value)}>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.title} (Target: {fmtKES(p.targetBudget)} | Funded: {fmtKES(p.allocatedAmount || 0)})</option>
          ))}
        </select></label>

      {selectedProject && (
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: -4, marginBottom: 8 }}>
          Current funding: {fmtKES(selectedProject.allocatedAmount || 0)} of {fmtKES(selectedProject.targetBudget)}
        </div>
      )}

      <label className="cha-field"><span>Amount to Allocate (KES)</span>
        <input className="cha-input cha-num" type="number" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="e.g. 50000" /></label>
      <label className="cha-field"><span>Note / Resolution</span>
        <input className="cha-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Resolution from AGM 2026" /></label>
      <button className="cha-btn" onClick={submit}>Confirm Allocation</button>
    </>
  );
}

/* ---- disburse merry-go-round pot form ---- */
function DisburseRotationForm({ store, close }) {
  const { toast } = useUI();
  const rot = store.getRotation();
  const recipient = rot.recipient;
  const potAmt = rot.collected > 0 ? rot.collected : rot.targetPot;
  const pool = store.poolBalance();
  const [note, setNote] = useState('');

  if (!recipient) {
    return (
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <p className="cha-muted">No recipient in line. Add members to the Chama first.</p>
        <button className="cha-btn cha-btn-sm" onClick={close}>Close</button>
      </div>
    );
  }

  const submit = () => {
    if (potAmt <= 0) return toast('No pot funds to disburse');
    if (potAmt > pool) return toast(`Pot amount (${fmtKES(potAmt)}) exceeds available pool balance (${fmtKES(pool)})`);
    const res = store.disburseRotationPot(note);
    if (res?.error) return toast(res.error);
    toast(`Pot of ${fmtKES(potAmt)} successfully disbursed to ${recipient.name}!`);
    close();
  };

  return (
    <>
      <div className="cha-card" style={{ marginTop: 0, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          <Avatar name={recipient.name} size={48} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 800 }}>{recipient.name}</div>
        <div className="cha-muted cha-small">{recipient.phone || 'Member'} · Designated Recipient</div>
        <div style={{ marginTop: 14, padding: '12px', background: 'var(--good-100)', borderRadius: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--good)' }}>CYCLE PAYOUT POT</div>
          <div className="cha-num" style={{ fontSize: 24, fontWeight: 800, color: 'var(--good)', marginTop: 2 }}>{fmtKES(potAmt)}</div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>Collected: {fmtKES(rot.collected)} · Target: {fmtKES(rot.targetPot)}</div>
        </div>
      </div>

      <label className="cha-field"><span>Disbursement Note / Payment Ref</span>
        <input className="cha-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Sent via M-Pesa ref QWX4928" /></label>

      <button className="cha-btn" style={{ background: 'var(--good)' }} onClick={submit}>
        Confirm Payout to {recipient.name}
      </button>
    </>
  );
}


