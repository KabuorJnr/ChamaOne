import { useState } from 'react';
import { Coins, Smartphone, Banknote, Download, Clock, Check, X, PhoneCall } from 'lucide-react';
import { fmtKES, Avatar, useUI, Empty, downloadText } from './kit';
import { fmtDate, fmtDateTime } from '../../store/chama';

// Every contribution collected, newest first, grouped by cycle — with an
// all-time total and per-cycle subtotals. Nothing collected is hidden.
export function ContributionsScreen({ store }) {
  const ui = useUI();
  const { toast } = ui;
  const canMoney = store.canManageMoney();
  const pending = store.pendingPayments();
  const all = store.contributions;
  const totalCollected = all.reduce((t, c) => t + c.amount, 0);
  const cy = store.activeCycle();
  const cur = store.cycleStats(cy.id);

  // Cycles newest-first, each with its contributions (newest-first) + subtotal.
  const groups = [...store.cycles].reverse().map((c) => {
    const rows = all.filter((x) => x.cycleId === c.id).sort((a, b) => new Date(b.date) - new Date(a.date));
    return { cycle: c, rows, subtotal: rows.reduce((t, r) => t + r.amount, 0) };
  });

  const csv = () => {
    const rows = [['Date & Time', 'Cycle', 'Member', 'Phone', 'Amount (KES)', 'Method', 'M-Pesa Ref', 'Status']];
    all.forEach((c) => {
      const m = store.memberById(c.memberId);
      rows.push([
        fmtDateTime(c.date),
        store.cycleLabel(c.cycleId),
        m ? m.name : '',
        m ? m.phone : '',
        c.amount,
        c.method,
        c.ref,
        c.status,
      ]);
    });
    const txt = rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadText(`${store.group.name.replace(/\s+/g, '_')}_contributions.csv`, txt);
    toast('CSV downloaded');
  };

  return (
    <>
      <div className="cha-card">
        <div className="cha-sec" style={{ margin: '0 0 4px' }}><h5>Current cycle</h5><a>{cur.paidCount} of {cur.totalMembers} paid</a></div>
        <div className="cha-cycle-big cha-num">{fmtKES(cur.collected)} <span>/ {fmtKES(cur.expected)}</span></div>
        <p className="cha-muted cha-small" style={{ margin: '2px 0 10px' }}>{cy.label} · All-time collected: <b className="cha-num">{fmtKES(totalCollected)}</b></p>
        <div style={{ display: 'flex', gap: 6 }}>
          {!canMoney && (
            <>
              <a
                className="cha-btn cha-btn-sm"
                href="tel:*334%23"
                style={{ textDecoration: 'none', flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <PhoneCall size={14} /> Dial *334# to Pay
              </a>
              <button className="cha-btn cha-btn-ghost cha-btn-sm" onClick={() => openReport(ui, store)}>
                I&apos;ve paid
              </button>
            </>
          )}
        </div>
      </div>

      {canMoney && pending.length > 0 && (
        <div className="cha-card cha-attn">
          <div className="cha-sec" style={{ margin: '0 0 6px' }}><h5><Clock size={14} style={{ verticalAlign: '-2px' }} /> Payments awaiting confirmation</h5><a>{pending.length}</a></div>
          {pending.map((p) => {
            const m = p.memberId ? store.memberById(p.memberId) : null;
            return (
              <div className="cha-li" style={{ cursor: 'default' }} key={p.id}>
                <Avatar name={m ? m.name : (p.phone || '?')} />
                <div className="cha-lt">
                  <b>{m ? m.name : (p.phone || 'Member')}</b>
                  <span>
                    <b className="cha-num">{fmtKES(p.amount)}</b>
                    {p.providerRef ? ` · Ref: ${p.providerRef}` : ''} · {fmtDateTime(p.createdAt || p.date || new Date().toISOString())}
                  </span>
                </div>
                <div className="cha-btn-row" style={{ gap: 6, flex: '0 0 auto' }}>
                  <button className="cha-btn cha-btn-sm cha-btn-ok" onClick={() => openConfirm(ui, store, p)} title="Confirm contribution"><Check size={15} /></button>
                  <button className="cha-btn cha-btn-sm cha-btn-ghost" onClick={() => store.rejectPayment(p.id).then((r) => toast(r.ok ? 'Payment rejected' : (r.error || 'Failed')))} title="Reject"><X size={15} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button className="cha-btn cha-btn-ghost cha-btn-sm" onClick={csv}><Download size={15} /> Export collections (CSV)</button>

      {groups.length === 0 && <Empty icon={Coins} title="Nothing collected yet" text="Contributions you collect will be listed here — every amount, who paid, and exact date & time." />}

      {groups.map((g) => (
        <div className="cha-list-card" key={g.cycle.id}>
          <div className="cha-li" style={{ cursor: 'default' }}>
            <div className="cha-lt"><b>{g.cycle.label}</b><span>{g.rows.length} paid</span></div>
            <div className="cha-rt"><b className="cha-num">{fmtKES(g.subtotal)}</b></div>
          </div>
          {g.rows.map((c) => {
            const m = store.memberById(c.memberId);
            return (
              <div className="cha-li" style={{ cursor: 'default' }} key={c.id}>
                <Avatar name={m ? m.name : '?'} />
                <div className="cha-lt">
                  <b>{m ? m.name : 'Member'}</b>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    {c.method === 'mpesa' ? <Smartphone size={12} /> : <Banknote size={12} />}
                    {c.method === 'mpesa' ? 'M-Pesa' : 'Cash'}{c.ref ? ` · Ref: ${c.ref}` : ''} · {fmtDateTime(c.date)}
                  </span>
                </div>
                <div className="cha-rt"><b className="cha-num" style={{ color: 'var(--good)' }}>+ {fmtKES(c.amount)}</b></div>
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}

/* ---- member: report a payment ---- */
function openReport(ui, store) {
  ui.openSheet('Report a payment', (close) => <ReportForm store={store} close={close} ui={ui} />);
}
function ReportForm({ store, close, ui }) {
  const ms = store.members();
  const [memberId, setMemberId] = useState(store.myMemberId() || ms[0]?.id || '');
  const [amt, setAmt] = useState(String(store.group.contributionAmount || ''));
  const [code, setCode] = useState('');
  const shortcode = store.settings?.shortcode;
  return (
    <>
      <div className="cha-card" style={{ background: 'var(--blue-50)', borderColor: 'var(--blue-100)', marginTop: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)' }}>Step 1: Pay to Chama via M-Pesa</div>
        <p className="cha-muted cha-small" style={{ margin: '4px 0 10px' }}>
          Dial <b>*334#</b> on your phone to send payment {shortcode ? `to ${shortcode}` : 'to the Chama'}.
        </p>
        <a
          className="cha-btn cha-btn-sm"
          href="tel:*334%23"
          style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <PhoneCall size={14} /> Dial *334# now
        </a>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)', marginBottom: 4 }}>Step 2: Notify Treasurer to Record</div>
        <p className="cha-muted cha-small" style={{ marginTop: 0 }}>
          Confirm your name and M-Pesa transaction code so the treasurer records your payment with the exact date & time.
        </p>

        <label className="cha-field"><span>Contributor (Your Name)</span>
          <select className="cha-select" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            {ms.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select></label>

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

/* ---- officer: confirm a reported payment ---- */
function openConfirm(ui, store, p) {
  ui.openSheet('Confirm payment', (close) => <ConfirmForm store={store} p={p} close={close} ui={ui} />);
}
function ConfirmForm({ store, p, close, ui }) {
  const ms = store.members();
  const [memberId, setMemberId] = useState(p.memberId || ms[0]?.id || '');
  const [cycleId, setCycleId] = useState(store.activeCycle().id);
  const [busy, setBusy] = useState(false);
  const selectedMember = ms.find((m) => m.id === memberId);

  return (
    <>
      <div className="cha-card" style={{ background: 'var(--blue-50)', borderColor: 'var(--blue-100)', marginTop: 0, padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Reported Amount</span>
          <b className="cha-num" style={{ fontSize: 17, color: 'var(--good)' }}>{fmtKES(p.amount)}</b>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, fontSize: 12 }}>
          <span style={{ color: 'var(--muted)' }}>Reported Time</span>
          <b>{fmtDateTime(p.createdAt || p.date || new Date().toISOString())}</b>
        </div>
        {p.providerRef && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, fontSize: 12 }}>
            <span style={{ color: 'var(--muted)' }}>M-Pesa Ref</span>
            <b className="cha-num">{p.providerRef}</b>
          </div>
        )}
      </div>

      <label className="cha-field"><span>Contributor</span>
        <select className="cha-select" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
          {ms.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select></label>
      <label className="cha-field"><span>Cycle</span>
        <select className="cha-select" value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
          {[...store.cycles].reverse().map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select></label>
      <button className="cha-btn" disabled={busy} onClick={async () => {
        if (!memberId) return ui.toast('Pick the contributor');
        setBusy(true);
        const r = await store.confirmPayment(p.id, memberId, cycleId);
        setBusy(false);
        if (!r.ok) return ui.toast(r.error || 'Could not confirm');
        close();
        ui.toast(`Confirmed ${fmtKES(p.amount)} for ${selectedMember ? selectedMember.name : 'member'} recorded at ${fmtDateTime(new Date().toISOString())}`);
      }}>{busy ? 'Confirming…' : 'Confirm as contribution'}</button>
    </>
  );
}
