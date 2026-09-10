import {
  Plus, CreditCard, Users, Megaphone, ArrowRight, TrendingUp, Vote, ArrowUp, ArrowDown, Video, ChevronsUpDown, PhoneCall, Smartphone,
  RotateCcw, HandCoins, Target,
} from 'lucide-react';
import { fmtKES, Ring, BarChart, SecHead, Avatar, useUI, VoteTag } from './screens/kit';
import { openCollect, openGroupSwitcher, openReportPayment, openDisburseRotation, openNewProject } from './screens/forms';
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
  const canMoney = store.canManageMoney();
  const pendingPays = store.pendingPayments();
  const isMerryGoRound = store.group.type === 'Merry-go-round';
  const rot = isMerryGoRound ? store.getRotation() : null;
  const projects = store.getProjects();

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
        {canMoney && <button className="cha-hero-cta" onClick={() => openCollect(ui, store)}><Plus />Collect</button>}
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
              {canMoney && (
                <button className="cha-chip2" onClick={() => { const n = remindUnpaid(store); ui.toast(n ? `Reminders sent to ${n} members` : 'Everyone has paid'); }}><Megaphone size={13} /> Remind unpaid</button>
              )}
              <button className="cha-chip2" onClick={() => open('collections')}>Collections</button>
              <button className="cha-chip2" onClick={() => open('members')}>Members</button>
            </div>
          </div>
        </div>

        {!canMoney && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #EEF2F6', display: 'flex', gap: 8 }}>
            <a
              className="cha-btn"
              href="tel:*334%23"
              style={{
                textDecoration: 'none',
                flex: 1.3,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                fontSize: 13,
                fontWeight: 700,
                background: '#047857',
                color: '#fff',
                borderRadius: 10,
                padding: '9px 12px',
                minHeight: 40,
                whiteSpace: 'nowrap',
              }}
            >
              <Smartphone size={16} /> Pay via M-Pesa (*334#)
            </a>
            <button
              className="cha-btn cha-btn-ghost"
              style={{
                flex: 0.9,
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 10,
                padding: '9px 12px',
                minHeight: 40,
                whiteSpace: 'nowrap',
              }}
              onClick={() => openReportPayment(ui, store)}
            >
              I&apos;ve paid
            </button>
          </div>
        )}
      </div>

      {/* Merry-Go-Round Turn Card */}
      {isMerryGoRound && rot && (
        <div className="cha-card" style={{ borderLeft: '4px solid #2563EB' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em', color: '#2563EB', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <RotateCcw size={13} /> MERRY-GO-ROUND POT
            </span>
            <span className={`cha-pill2 ${rot.isReady ? 'cha-pill-ok' : 'cha-pill-info'}`} style={{ fontSize: 11 }}>
              {rot.isReady ? 'Pot Ready for Hand-off' : 'Collecting'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Next in line to receive pot:</div>
              <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Avatar name={rot.recipient?.name || 'Chama'} size={28} />
                <b>{rot.recipient?.name || 'No recipient set'}</b>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Payout Pot</div>
              <b className="cha-num" style={{ fontSize: 17, color: 'var(--ink)' }}>{fmtKES(rot.collected > 0 ? rot.collected : rot.targetPot)}</b>
            </div>
          </div>

          {rot.queue.length > 1 && (
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Upcoming: <b>{rot.queue.slice(1, 3).map((m) => m.name).join(', ')}</b></span>
              <button style={{ fontSize: 11.5, padding: 0, fontWeight: 700, color: 'var(--blue)', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => open('rotation')}>
                View Roster →
              </button>
            </div>
          )}

          {canMoney && (
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <button
                className="cha-btn cha-btn-sm"
                style={{ flex: 1, background: 'var(--blue)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 12.5 }}
                onClick={() => openDisburseRotation(ui, store)}
              >
                <HandCoins size={14} /> Disburse Pot
              </button>
              <button
                className="cha-btn cha-btn-ghost cha-btn-sm"
                style={{ fontSize: 12.5 }}
                onClick={() => open('rotation')}
              >
                Manage Roster
              </button>
            </div>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="cha-mini-grid">
        <Kpi icon={CreditCard} color={GOOD} value={fmtKES(fin.outstandingLoans)} label={`${fin.loanCount} active loan${fin.loanCount === 1 ? '' : 's'}`} />
        <Kpi icon={Users} color={BLUE} value={fin.memberCount} label={`${store.group.frequency} · ${fmtKES(store.group.contributionAmount)}`} />
      </div>

      {/* Projects summary card */}
      <div className="cha-card">
        <SecHead title="Projects & Investments" action="All" onAction={() => open('projects')} />
        {projects.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <span className="cha-muted cha-small">No group investment projects started yet.</span>
            {canMoney && (
              <button className="cha-btn cha-btn-sm" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => openNewProject(ui, store)}>
                <Plus size={13} /> Start Project
              </button>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 6 }}>
            {projects.slice(0, 2).map((p) => {
              const allocated = p.allocatedAmount || 0;
              const target = p.targetBudget || 1;
              const pct = Math.min(100, Math.round((allocated / target) * 100));
              return (
                <button
                  key={p.id}
                  style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: '8px 0', borderBottom: '1px solid var(--line)', cursor: 'pointer' }}
                  onClick={() => open('projects')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <b style={{ fontSize: 13.5 }}>{p.title}</b>
                    <span className="cha-num" style={{ fontSize: 12, fontWeight: 700, color: 'var(--good)' }}>{fmtKES(allocated)} / {fmtKES(p.targetBudget)}</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 99, background: 'var(--line)', overflow: 'hidden', marginTop: 6 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? 'var(--good)' : 'var(--blue)', borderRadius: 99 }} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* payments to confirm */}
      {canMoney && pendingPays.length > 0 && (
        <button className="cha-card cha-attn" style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }} onClick={() => open('collections')}>
          <SecHead title="Payments to confirm" />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
            <span className="cha-muted cha-small">{pendingPays.length} payment{pendingPays.length === 1 ? '' : 's'} awaiting your confirmation</span>
            <b className="cha-num">{fmtKES(pendingPays.reduce((t, p) => t + p.amount, 0))}</b>
          </div>
        </button>
      )}

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
        {canMoney
          ? <QA icon={Plus} label="Collect" color={GOOD} onClick={() => openCollect(ui, store)} />
          : <QA icon={Users} label="Members" color={GOOD} onClick={() => open('members')} />}
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
