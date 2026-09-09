import { useState } from 'react';
import {
  BarChart3, BookOpen, Settings, FilePlus2, Download, Printer, ChevronRight,
  Wallet, TrendingUp, RefreshCw, Trash2, ArrowDownLeft, ArrowUpRight, Lock, Bell, BellOff, Coins, ArrowLeftRight,
  KeyRound, LogOut,
} from 'lucide-react';
import { fmtKES, BarChart, SecHead, useUI, downloadText } from './kit';
import { fmtDate } from '../../store/chama';
import { openCreateGroup, openGroupSwitcher, openChangePassword } from './forms';
import { ensurePermission, notify as deviceNotify } from '../../lib/notifications';
import { isSupabaseConfigured } from '../../lib/supabase';

/* ---------- More hub ---------- */
export function MoreScreen({ store, open, user, onLogout }) {
  const ui = useUI();
  const { toast, confirm } = ui;
  const fin = store.financialSummary();
  return (
    <>
      {/* Slim balance strip — the full hero already lives on Home. */}
      <div className="cha-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.05em', color: 'var(--muted)' }}>POOL BALANCE</div>
          <div className="cha-num" style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.02em', marginTop: 2 }}>{fmtKES(fin.balance)}</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 12, lineHeight: 1.7, flex: '0 0 auto' }}>
          <div style={{ color: 'var(--good)', fontWeight: 700 }}><ArrowUpRight size={12} style={{ verticalAlign: '-1px' }} /> {fmtKES(fin.inflow)}</div>
          <div style={{ color: 'var(--bad)', fontWeight: 700 }}><ArrowDownLeft size={12} style={{ verticalAlign: '-1px' }} /> {fmtKES(fin.outflow)}</div>
        </div>
      </div>

      <SecHead title="Your account" />
      <div className="cha-list-card">
        <div className="cha-li" style={{ cursor: 'default' }}>
          <span className="cha-lic" style={{ background: 'var(--blue)', color: '#fff' }}>{(user?.name || 'M')[0].toUpperCase()}</span>
          <div className="cha-lt"><b>{user?.name || 'Member'}</b><span>{user?.role || 'Member'}</span></div>
        </div>
        <button className="cha-li" onClick={() => openChangePassword(ui)}>
          <span className="cha-lic" style={{ background: 'var(--blue-50)', color: 'var(--blue)' }}><KeyRound /></span>
          <div className="cha-lt"><b>Change password</b></div>
          <ChevronRight className="cha-chev" size={18} />
        </button>
        <button className="cha-li" onClick={() => confirm('Sign out?', 'You’ll need your email and password to sign back in.', () => onLogout && onLogout())}>
          <span className="cha-lic" style={{ background: 'var(--bad-100)', color: 'var(--bad)' }}><LogOut /></span>
          <div className="cha-lt"><b>Sign out</b></div>
          <ChevronRight className="cha-chev" size={18} />
        </button>
      </div>

      <SecHead title="Money" />
      <div className="cha-list-card">
        <Item icon={Coins} color="var(--good)" bg="var(--good-100)" title="Collections" sub="Every contribution collected" onClick={() => open('collections')} />
        <Item icon={BarChart3} color="var(--blue)" bg="var(--blue-50)" title="Reports" sub="Statements, trends, exports" onClick={() => open('reports')} />
        <Item icon={BookOpen} color="#7C3AED" bg="#EDE9FE" title="Ledger" sub="Full audit trail" onClick={() => open('ledger')} />
      </div>

      <SecHead title="Group" />
      <div className="cha-list-card">
        <Item icon={Settings} color="var(--muted)" bg="var(--line)" title="Settings" sub="Group, M-Pesa, cycle" onClick={() => open('settings')} />
        <Item icon={ArrowLeftRight} color="var(--info)" bg="var(--info-100)" title="Switch Chama" sub={`${store.groupCount()} ${store.groupCount() === 1 ? 'Chama' : 'Chamas'}`} onClick={() => openGroupSwitcher(ui, store, open)} />
        <Item icon={FilePlus2} color="var(--warn)" bg="var(--warn-100)" title="Create a new Chama" sub="Start another group" onClick={() => openCreateGroup(ui, store, open)} />
      </div>

      <div className="cha-about">ChamaOne · built for Kenyan Chamas · v1.0</div>
    </>
  );
}
function Item({ icon: Icon, color, bg, title, sub, onClick }) {
  return (
    <button className="cha-li" onClick={onClick}>
      <span className="cha-lic" style={{ background: bg, color }}><Icon /></span>
      <div className="cha-lt"><b>{title}</b><span>{sub}</span></div>
      <ChevronRight className="cha-chev" size={18} />
    </button>
  );
}

/* ---------- Reports ---------- */
export function ReportsScreen({ store, open }) {
  const { toast } = useUI();
  const fin = store.financialSummary();
  const trend = store.contributionTrend();
  const byType = Object.entries(fin.byType);
  const csv = () => { downloadText(`${store.group.name.replace(/\s+/g, '_')}_ledger.csv`, store.toCSV()); toast('CSV downloaded'); };
  return (
    <>
      <div className="cha-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div><div className="cha-muted cha-small" style={{ textTransform: 'uppercase', letterSpacing: '.3px' }}>Statement of accounts</div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{store.group.name}</div></div>
          <div style={{ textAlign: 'right' }}><div className="cha-muted cha-small">Net balance</div>
            <div className="cha-num" style={{ fontWeight: 800, fontSize: 19, color: 'var(--blue)' }}>{fmtKES(fin.balance)}</div></div>
        </div>
        <table className="cha-stmt">
          <thead><tr><th>Line item</th><th>In</th><th>Out</th></tr></thead>
          <tbody>
            {byType.map(([type, v]) => (
              <tr key={type}><td>{type}</td>
                <td className="cha-num">{v.in ? fmtKES(v.in) : '—'}</td>
                <td className="cha-num">{v.out ? fmtKES(v.out) : '—'}</td></tr>
            ))}
            <tr className="cha-stmt-total"><td>Totals</td>
              <td className="cha-num">{fmtKES(fin.inflow)}</td>
              <td className="cha-num">{fmtKES(fin.outflow)}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="cha-card"><SecHead title="Contributions by cycle" /><div style={{ marginTop: 12 }}><BarChart data={trend} /></div></div>

      <div className="cha-mini-grid">
        <div className="cha-kpi"><span className="cha-ic" style={{ background: 'var(--good-100)', color: 'var(--good)' }}><Wallet /></span>
          <div className="cha-v cha-num">{fmtKES(fin.outstandingLoans)}</div><div className="cha-l">Loans outstanding</div></div>
        <div className="cha-kpi"><span className="cha-ic" style={{ background: 'var(--blue-50)', color: 'var(--blue)' }}><TrendingUp /></span>
          <div className="cha-v cha-num">{fmtKES(fin.memberCount ? fin.inflow / fin.memberCount : 0)}</div><div className="cha-l">Avg / member</div></div>
      </div>

      <div className="cha-card">
        <SecHead title="Share your books" />
        <p className="cha-muted cha-small">Every member sees the same numbers — that transparency is what keeps a Chama together.</p>
        <div className="cha-btn-row">
          <button className="cha-btn cha-btn-ghost cha-btn-sm" onClick={() => window.print()}><Printer size={15} /> Print</button>
          <button className="cha-btn cha-btn-ghost cha-btn-sm" onClick={csv}><Download size={15} /> CSV</button>
          <button className="cha-btn cha-btn-ghost cha-btn-sm" onClick={() => open('ledger')}><BookOpen size={15} /> Ledger</button>
        </div>
      </div>
    </>
  );
}

/* ---------- Ledger ---------- */
export function LedgerScreen({ store }) {
  const { toast } = useUI();
  const led = store.ledger;
  return (
    <>
      <p className="cha-muted cha-small" style={{ margin: '0 2px', display: 'flex', alignItems: 'center', gap: 6 }}><Lock size={13} /> Tamper-evident audit trail — every shilling in and out, in order.</p>
      <button className="cha-btn cha-btn-ghost cha-btn-sm" onClick={() => { downloadText(`${store.group.name.replace(/\s+/g, '_')}_ledger.csv`, store.toCSV()); toast('CSV downloaded'); }}>
        <Download size={15} /> Export CSV
      </button>
      <div className="cha-list-card">
        {led.length === 0 && <div className="cha-led"><span className="cha-muted">No transactions yet.</span></div>}
        {led.map((e) => {
          const m = e.memberId ? store.memberById(e.memberId) : null;
          return (
            <div className="cha-led" key={e.id}>
              <div className={`cha-led-ic ${e.direction}`}>{e.direction === 'in' ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}</div>
              <div className="cha-led-main"><b>{e.type}</b><span>{e.note || (m ? m.name : '')} · {fmtDate(e.date)}</span></div>
              <div className="cha-led-right">
                <div className={`cha-led-amt ${e.direction}`}>{e.direction === 'in' ? '+' : '−'} {fmtKES(e.amount)}</div>
                <div className="cha-led-bal cha-num">bal {fmtKES(e.balanceAfter)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ---------- Settings ---------- */
export function SettingsScreen({ store, open }) {
  const { toast, confirm } = useUI();
  const g = store.group;
  const s = store.settings;
  const canMoney = store.canManageMoney();
  const isChair = store.myRole() === 'Chairperson';
  const [name, setName] = useState(g.name);
  const [amt, setAmt] = useState(g.contributionAmount);
  const [interest, setInterest] = useState(g.loanInterest);
  const [sim, setSim] = useState(s.simulateMpesa);
  const [shortcode, setShortcode] = useState(s.shortcode);
  const [cb, setCb] = useState(s.callbackUrl);
  const [pushOn, setPushOn] = useState(s.pushEnabled);

  const togglePush = async (checked) => {
    if (checked) {
      const granted = await ensurePermission();
      if (!granted) { setPushOn(false); store.updateSettings({ pushEnabled: false }); toast('Allow notifications in system settings'); return; }
      setPushOn(true); store.updateSettings({ pushEnabled: true });
      deviceNotify({ title: 'ChamaOne', body: 'Notifications are on — we’ll remind you about contributions, votes and meetings.' });
      toast('Phone notifications on');
    } else {
      setPushOn(false); store.updateSettings({ pushEnabled: false }); toast('Phone notifications off');
    }
  };

  return (
    <>
      {canMoney && (
      <div className="cha-card">
        <SecHead title="Group" />
        <label className="cha-field" style={{ marginTop: 10 }}><span>Group name</span><input className="cha-input" value={name} onChange={(e) => setName(e.target.value)} disabled={!isChair} /></label>
        <div className="cha-grid2">
          <label className="cha-field"><span>Contribution ({g.frequency})</span><input className="cha-input cha-num" type="number" value={amt} onChange={(e) => setAmt(e.target.value)} disabled={!isChair} /></label>
          <label className="cha-field"><span>Loan interest (%)</span><input className="cha-input cha-num" type="number" value={interest} onChange={(e) => setInterest(e.target.value)} disabled={!isChair} /></label>
        </div>
        <div className="cha-btn-row">
          {isChair && <button className="cha-btn cha-btn-sm" onClick={() => { store.updateGroup({ name: name.trim() || g.name, contributionAmount: Number(amt) || 0, loanInterest: Number(interest) || 0 }); toast('Group saved'); }}>Save group</button>}
          <button className="cha-btn cha-btn-ghost cha-btn-sm" onClick={() => confirm('Start next cycle?', 'Members’ contribution status resets for the new period.', () => { store.startNextCycle(); toast('New cycle started'); open('home'); })}>Next cycle →</button>
        </div>
      </div>
      )}

      <div className="cha-card">
        <SecHead title="Notifications" />
        <label className="cha-field" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
          <span style={{ marginBottom: 0, display: 'inline-flex', alignItems: 'center', gap: 8 }}>{pushOn ? <Bell size={16} /> : <BellOff size={16} />} Phone notifications</span>
          <input type="checkbox" checked={pushOn} onChange={(e) => togglePush(e.target.checked)} style={{ width: 20, height: 20 }} />
        </label>
        <p className="cha-muted cha-small">Reminders on your phone for contributions due, loan votes and upcoming meetings. You’ll be asked for permission.</p>
        {pushOn && (
          <button className="cha-btn cha-btn-ghost cha-btn-sm" onClick={async () => { const ok = await ensurePermission(); if (!ok) return toast('Permission needed'); deviceNotify({ title: 'ChamaOne', body: 'This is how your reminders will appear.' }); toast('Test notification sent'); }}>Send a test notification</button>
        )}
      </div>

      {canMoney && (
      <div className="cha-card">
        <SecHead title="M-Pesa (Daraja)" />
        <label className="cha-field" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
          <span style={{ marginBottom: 0 }}>Simulate M-Pesa (demo mode)</span>
          <input type="checkbox" checked={sim} onChange={(e) => setSim(e.target.checked)} style={{ width: 20, height: 20 }} />
        </label>
        <p className="cha-muted cha-small">Off = use your live Daraja backend. Credentials stay server-side; see README.</p>
        <label className="cha-field"><span>Business shortcode</span><input className="cha-input" value={shortcode} onChange={(e) => setShortcode(e.target.value)} placeholder="e.g. 174379" /></label>
        <label className="cha-field"><span>Callback URL</span><input className="cha-input" value={cb} onChange={(e) => setCb(e.target.value)} placeholder="https://…/callback" /></label>
        <button className="cha-btn cha-btn-sm" onClick={() => { store.updateSettings({ simulateMpesa: sim, shortcode: shortcode.trim(), callbackUrl: cb.trim() }); toast('M-Pesa settings saved'); }}>Save M-Pesa</button>
      </div>
      )}

      <div className="cha-card">
        <SecHead title="Data" />
        <p className="cha-muted cha-small">
          {isSupabaseConfigured
            ? 'Synced to your ChamaOne account — shared with members and available on all your devices.'
            : 'Stored on this device (offline-first). Wire Supabase to sync across members & devices — see README.'}
        </p>
        {isChair && store.groupCount() > 1 && (
          <button className="cha-btn cha-btn-danger cha-btn-sm" style={{ marginBottom: 10 }} onClick={() => confirm('Delete this Chama?', isSupabaseConfigured ? `“${g.name}” and all its records will be permanently deleted for everyone.` : `“${g.name}” and all its records will be removed from this device.`, () => { store.deleteGroup(g.id); toast('Chama deleted'); open('home'); })}><Trash2 size={15} /> Delete “{g.name}”</button>
        )}
        {!isSupabaseConfigured && (
          <div className="cha-btn-row">
            <button className="cha-btn cha-btn-ghost cha-btn-sm" onClick={() => confirm('Reload demo data?', 'Replaces ALL data with the single sample Chama.', () => { store.reset(); toast('Demo data loaded'); open('home'); })}><RefreshCw size={15} /> Reload demo</button>
            <button className="cha-btn cha-btn-danger cha-btn-sm" onClick={() => confirm('Reset everything?', 'This clears ALL Chamas on this device.', () => { store.wipe(); toast('Reset complete'); open('home'); })}><Trash2 size={15} /> Reset all</button>
          </div>
        )}
      </div>
    </>
  );
}
