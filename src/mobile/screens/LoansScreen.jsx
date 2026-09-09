import { CreditCard, Plus, Banknote, CheckCircle2, XCircle } from 'lucide-react';
import { fmtKES, Avatar, useUI, Empty, VoteTag } from './kit';
import { openApplyLoan, openRepay } from './forms';

export function LoansScreen({ store, open }) {
  const ui = useUI();
  const loans = store.loans;
  const groups = {
    pending: loans.filter((l) => l.status === 'pending'),
    approved: loans.filter((l) => l.status === 'approved'),
    active: loans.filter((l) => l.status === 'active'),
    done: loans.filter((l) => ['repaid', 'rejected'].includes(l.status)),
  };
  const Section = ({ title, arr }) => arr.length ? (
    <div className="cha-card">
      <div className="cha-sec" style={{ margin: '0 0 4px' }}><h5>{title}</h5><a>{arr.length}</a></div>
      {arr.map((l) => <LoanCard key={l.id} l={l} store={store} ui={ui} />)}
    </div>
  ) : null;

  return (
    <>
      <button className="cha-btn cha-btn-ghost cha-btn-sm" onClick={() => openApplyLoan(ui, store, open)}><Plus size={16} /> Apply for a loan</button>
      <Section title="Awaiting vote" arr={groups.pending} />
      <Section title="Approved · ready to disburse" arr={groups.approved} />
      <Section title="Active" arr={groups.active} />
      <Section title="History" arr={groups.done} />
      {loans.length === 0 && (
        <Empty icon={CreditCard} title="No loans yet"
          text="Members apply, the group votes, interest is auto-calculated, and repayments are tracked.">
          <button className="cha-btn" onClick={() => openApplyLoan(ui, store, open)}>Apply for a loan</button>
        </Empty>
      )}
    </>
  );
}

function LoanCard({ l, store, ui }) {
  const m = store.memberById(l.memberId);
  const t = store.loanTotals(l);
  const yes = Object.values(l.votes).filter((v) => v === 'yes').length;
  const no = Object.values(l.votes).filter((v) => v === 'no').length;
  const need = store.members().length;
  const canMoney = store.canManageMoney();
  const vote = (v) => { store.voteLoan(l.id, store.members()[0].id, v); ui.toast('Vote recorded'); };

  let body = null;
  if (l.status === 'pending') {
    body = (
      <>
        <div className="cha-votes"><VoteTag kind="yes" n={yes} /><VoteTag kind="no" n={no} />
          <span className="cha-need">need majority of {need}</span></div>
        <div className="cha-btn-row">
          <button className="cha-btn cha-btn-sm cha-btn-ok" onClick={() => vote('yes')}>Approve</button>
          <button className="cha-btn cha-btn-sm cha-btn-danger" onClick={() => vote('no')}>Reject</button>
        </div>
      </>
    );
  } else if (l.status === 'approved') {
    body = canMoney
      ? <button className="cha-btn cha-btn-sm" style={{ marginTop: 8 }} onClick={() => {
          const r = store.disburseLoan(l.id); ui.toast(r && r.error === 'insufficient' ? 'Not enough funds in the pool' : 'Loan disbursed');
        }}><Banknote size={16} /> Disburse {fmtKES(l.principal)}</button>
      : <div className="cha-muted cha-small" style={{ marginTop: 8 }}>Approved — awaiting disbursement by the treasurer.</div>;
  } else if (l.status === 'active') {
    const pct = t.total ? Math.round((t.repaid / t.total) * 100) : 0;
    body = (
      <>
        <div className="cha-prog" style={{ marginTop: 10 }}><i style={{ width: `${pct}%`, background: 'var(--good)' }} /></div>
        <div className="cha-repay-meta"><span>Repaid {fmtKES(t.repaid)}</span><span>Outstanding {fmtKES(t.outstanding)}</span></div>
        {canMoney && <button className="cha-btn cha-btn-sm cha-btn-ok" onClick={() => openRepay(ui, store, l.id)}><Plus size={16} /> Record repayment</button>}
      </>
    );
  } else if (l.status === 'repaid') {
    body = <div className="cha-donetag"><CheckCircle2 size={15} /> Fully repaid</div>;
  } else if (l.status === 'rejected') {
    body = <div className="cha-rejtag"><XCircle size={15} /> Rejected by vote</div>;
  }

  return (
    <div className="cha-loan">
      <div className="cha-loan-head">
        <Avatar name={m.name} />
        <div className="cha-main"><b>{m.name}</b><span>{l.purpose || 'Loan'} · {l.termMonths}mo · {l.interestRate}%</span></div>
        <div className="cha-loan-amt"><b className="cha-num">{fmtKES(l.principal)}</b><span>repay {fmtKES(t.total)}</span></div>
      </div>
      {body}
    </div>
  );
}
