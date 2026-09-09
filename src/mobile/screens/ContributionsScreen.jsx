import { useState } from 'react';
import { Coins, Smartphone, Banknote, Download, Clock, Check, X } from 'lucide-react';
import { fmtKES, Avatar, useUI, Empty, downloadText } from './kit';
import { fmtDate } from '../../store/chama';

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
    return { cycle: c, rows, subtotal: rows.reduce((t, x) => t + x.amount, 0) };
  }).filter((g) => g.rows.length);

  const csv = () => {
    const lines = [['Date', 'Member', 'Cycle', 'Method', 'Ref', 'Amount']];
    [...all].sort((a, b) => new Date(a.date) - new Date(b.date)).forEach((c) => {
      const m = store.memberById(c.memberId);
      lines.push([fmtDate(c.date), m ? m.name : '', store.cycleLabel(c.cycleId), c.method, c.ref || '', c.amount]);
    });
    downloadText(`${store.group.name.replace(/\s+/g, '_')}_collections.csv`, lines.map((r) => r.join(',')).join('\n'));
    toast('CSV downloaded');
  };

  return (
    <>
      <div className="cha-hero-card">
        <span className="cha-pill">TOTAL COLLECTED</span>
        <div className="cha-hero-amt cha-num" style={{ marginTop: 14 }}>{fmtKES(totalCollected)}</div>
        <div className="cha-hero-meta">
          <span>{all.length} contribution{all.length === 1 ? '' : 's'}</span>
          <span>·</span>
          <span>{cy.label}: {fmtKES(cur.collected)} / {fmtKES(cur.expected)}</span>
        </div>
      </div>

      {!canMoney && (
        <button className="cha-btn cha-btn-sm" onClick={() => openReport(ui, store)}><Smartphone size={15} /> I&apos;ve paid — notify treasurer</button>
      )}

      {canMoney && pending.length > 0 && (
        <div className="cha-card cha-attn">
          <div className="cha-sec" style={{ margin: '0 0 6px' }}><h5><Clock size={14} style={{ verticalAlign: '-2px' }} /> Pending payments</h5><a>{pending.length}</a></div>
          {pending.map((p) => {
            const m = p.memberId ? store.memberById(p.memberId) : null;
            return (
              <div className="cha-li" style={{ cursor: 'default' }} key={p.id}>
                <Avatar name={m ? m.name : (p.phone || '?')} />
                <div className="cha-lt">
                  <b>{m ? m.name : (p.phone || 'Unknown payer')}</b>
                  <span>{fmtKES(p.amount)}{p.providerRef ? ` · ${p.providerRef}` : ''} · {p.provider}</span>
                </div>
                <div className="cha-btn-row" style={{ gap: 6, flex: '0 0 auto' }}>
                  <button className="cha-btn cha-btn-sm cha-btn-ok" onClick={() => openConfirm(ui, store, p)}><Check size={15} /></button>
                  <button className="cha-btn cha-btn-sm cha-btn-ghost" onClick={() => store.rejectPayment(p.id).then((r) => toast(r.ok ? 'Payment rejected' : (r.error || 'Failed')))}><X size={15} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button className="cha-btn cha-btn-ghost cha-btn-sm" onClick={csv}><Download size={15} /> Export collections (CSV)</button>

      {groups.length === 0 && <Empty icon={Coins} title="Nothing collected yet" text="Contributions you collect will be listed here — every amount, who paid, and how." />}

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
                    {c.method === 'mpesa' ? 'M-Pesa' : 'Cash'}{c.ref ? ` · ${c.ref}` : ''} · {fmtDate(c.date)}
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
  const [amt, setAmt] = useState(String(store.group.contributionAmount || ''));
  const [code, setCode] = useState('');
  return (
    <>
      <p className="cha-muted cha-small" style={{ marginTop: 0 }}>Already paid the group? Enter the amount and your M-Pesa code — a treasurer will confirm it into your record.</p>
      <label className="cha-field"><span>Amount (KES)</span>
        <input className="cha-input cha-num" type="number" value={amt} onChange={(e) => setAmt(e.target.value)} /></label>
      <label className="cha-field"><span>M-Pesa code (optional)</span>
        <input className="cha-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. RGH12ABC" /></label>
      <button className="cha-btn" onClick={() => {
        if (!Number(amt)) return ui.toast('Enter an amount');
        store.reportPayment({ amount: amt, providerRef: code });
        close(); ui.toast('Reported — a treasurer will confirm it');
      }}>Submit</button>
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
  return (
    <>
      <p className="cha-muted cha-small" style={{ marginTop: 0 }}>
        {fmtKES(p.amount)}{p.providerRef ? ` · ${p.providerRef}` : ''}{p.phone ? ` · ${p.phone}` : ''} · via {p.provider}
      </p>
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
        close(); ui.toast('Payment confirmed');
      }}>{busy ? 'Confirming…' : 'Confirm as contribution'}</button>
    </>
  );
}
