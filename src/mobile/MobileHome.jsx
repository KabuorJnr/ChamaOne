import {
  Plus, CreditCard, Users, Megaphone, ArrowRight, TrendingUp, Vote, ArrowUp, ArrowDown, Video, ChevronsUpDown,
} from 'lucide-react';
import { fmtKES, Ring, BarChart, SecHead, Avatar, useUI, VoteTag } from './screens/kit';
import { openCollect, openGroupSwitcher } from './screens/forms';
import { remindUnpaid } from './screens/actions';

const BLUE = '#2563EB', GOOD = '#16A34A', WARN = '#D97706', VIOLET = '#7C3AED';

function Kpi({ icon: Icon, color, value, label }) {
  return (
    <div className="cha-kpi">
      <span className="cha-ic" style={{ background: `color-mix(in srgb, ${color} 13%, #fff)`, color }}><Icon /></span>
      <div className="cha-v cha-num">{value}</div>
      <div className="cha-l">{label}</div>
    </div>
  );
}

export default function MobileHome({ store, open }) {
  const ui = useUI();
  const cy = store.activeCycle();
  const stats = store.cycleStats(cy.id);
  const fin = store.financialSummary();
  const pending = store.loans.filter((l) => l.status === 'pending');
  const nextMeeting = store.meetings
    .filter((m) => new Date(m.date) >= new Date() && m.status !== 'completed')
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
  const trend = store.contributionTrend();

  const vote = (loanId, v) => { store.voteLoan(loanId, store.members()[0].id, v); ui.toast('Vote recorded'); };

  const groupCount = store.groupCount();

  return (
    <>
      {/* Chama switcher — tap to switch between the Chamas you run, or add one */}
      <button className="cha-gswitch" onClick={() => openGroupSwitcher(ui, store, open)}>
        <span className="cha-gs-ic"><Avatar name={store.group.name} size={38} /></span>
        <div className="cha-gs-t">
          <span>{groupCount > 1 ? `CHAMA · ${groupCount} total` : 'CHAMA'}</span>
          <b>{store.group.name}</b>
        </div>
        <ChevronsUpDown size={18} />
      </button>

      {/* pool hero */}
      <div className="cha-hero-card">
        <span className="cha-pill">{store.group.type.toUpperCase()}</span>
        <button className="cha-hero-cta" onClick={() => openCollect(ui, store)}><Plus />Collect</button>
        <div className="cha-hero-lb">Group pool balance</div>
        <div className="cha-hero-amt cha-num">{fmtKES(fin.balance)}</div>
        <div className="cha-hero-meta">
          <span className="up"><ArrowUp size={13} /> {fmtKES(fin.inflow)} in</span>
          <span className="down"><ArrowDown size={13} /> {fmtKES(fin.outflow)} out</span>
        </div>
      </div>

      {/* cycle ring */}
      <div className="cha-card">
        <div className="cha-cycle">
          <Ring pct={stats.pct} />
          <div className="cha-cycle-info">
            <div className="cha-cycle-title">{cy.label} contributions</div>
            <div className="cha-cycle-big cha-num">{fmtKES(stats.collected)} <span>/ {fmtKES(stats.expected)}</span></div>
            <div className="cha-cycle-sub">{stats.paidCount} of {stats.totalMembers} members paid in full</div>
            <div className="cha-chips">
              <button className="cha-chip2" onClick={() => { const n = remindUnpaid(store); ui.toast(n ? `Reminders sent to ${n} members` : 'Everyone has paid'); }}><Megaphone size={13} /> Remind unpaid</button>
              <button className="cha-chip2" onClick={() => open('collections')}>Collections</button>
              <button className="cha-chip2" onClick={() => open('members')}>Members</button>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="cha-mini-grid">
        <Kpi icon={CreditCard} color={GOOD} value={fmtKES(fin.outstandingLoans)} label={`${fin.loanCount} active loan${fin.loanCount === 1 ? '' : 's'}`} />
        <Kpi icon={Users} color={BLUE} value={fin.memberCount} label={`${store.group.frequency} · ${fmtKES(store.group.contributionAmount)}`} />
      </div>

      {/* needs a vote */}
      {pending.length > 0 && (
        <div className="cha-card cha-attn">
          <SecHead title="Needs a vote" />
          {pending.map((l) => {
            const m = store.memberById(l.memberId);
            const yes = Object.values(l.votes).filter((v) => v === 'yes').length;
            const no = Object.values(l.votes).filter((v) => v === 'no').length;
            return (
              <div key={l.id} style={{ marginTop: 10 }}>
                <div className="cha-loan-head">
                  <Avatar name={m.name} />
                  <div className="cha-main"><b>{m.name}</b><span>{l.purpose || 'Loan request'}</span></div>
                  <div className="cha-loan-amt"><b className="cha-num">{fmtKES(l.principal)}</b></div>
                </div>
                <div className="cha-votes"><VoteTag kind="yes" n={yes} /><VoteTag kind="no" n={no} />
                  <span className="cha-need">majority of {store.members().length}</span></div>
                <div className="cha-btn-row">
                  <button className="cha-btn cha-btn-sm cha-btn-ok" onClick={() => vote(l.id, 'yes')}>Approve</button>
                  <button className="cha-btn cha-btn-sm cha-btn-danger" onClick={() => vote(l.id, 'no')}>Reject</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* upcoming meeting */}
      {nextMeeting && (
        <>
          <SecHead title="Upcoming meeting" action="All" onAction={() => open('meetings')} />
          <div className="cha-list-card">
            <button className="cha-li" onClick={() => open('meeting_detail', { id: nextMeeting.id })}>
              <span className="cha-date"><span className="d">{new Date(nextMeeting.date).getDate()}</span>
                <span className="mo">{new Date(nextMeeting.date).toLocaleDateString('en-KE', { month: 'short' })}</span></span>
              <div className="cha-lt"><b>{nextMeeting.title}{nextMeeting.online && <span className="cha-pill2 cha-pill-info" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Video size={11} /> Online</span>}</b>
                <span>{nextMeeting.online ? 'Video call' : (nextMeeting.location || 'Location TBA')}</span></div>
              <ArrowRight className="cha-chev" size={18} />
            </button>
          </div>
        </>
      )}

      {/* trend */}
      <div className="cha-card">
        <SecHead title="Contribution trend" />
        <div style={{ marginTop: 12 }}><BarChart data={trend} /></div>
      </div>

      {/* quick actions */}
      <SecHead title="Quick actions" />
      <div className="cha-qa-grid">
        <QA icon={Plus} label="Collect" color={GOOD} onClick={() => openCollect(ui, store)} />
        <QA icon={CreditCard} label="Loans" color={BLUE} onClick={() => open('loans')} />
        <QA icon={Vote} label="Meetings" color={VIOLET} onClick={() => open('meetings')} />
        <QA icon={TrendingUp} label="Reports" color={WARN} onClick={() => open('reports')} />
      </div>
    </>
  );
}

function QA({ icon: Icon, label, color, onClick }) {
  return (
    <button className="cha-qa" onClick={onClick}>
      <span className="cha-ico" style={{ background: `color-mix(in srgb, ${color} 13%, #fff)`, color }}><Icon /></span>
      <span>{label}</span>
    </button>
  );
}
