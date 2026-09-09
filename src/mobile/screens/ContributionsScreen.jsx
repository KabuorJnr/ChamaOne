import { Coins, Smartphone, Banknote, Download } from 'lucide-react';
import { fmtKES, Avatar, useUI, Empty, downloadText } from './kit';
import { fmtDate } from '../../store/chama';

// Every contribution collected, newest first, grouped by cycle — with an
// all-time total and per-cycle subtotals. Nothing collected is hidden.
export function ContributionsScreen({ store }) {
  const { toast } = useUI();
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
