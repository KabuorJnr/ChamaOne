import { Plus, UserPlus, Users, MessageCircle, Copy } from 'lucide-react';
import { fmtKES, fmtDateTime, Avatar, RoleTag, StatusPill, useUI, Empty } from './kit';
import { openAddMember, openCollect, openInvite } from './forms';

export function MembersScreen({ store, open }) {
  const ui = useUI();
  const cy = store.activeCycle();
  const ms = store.members();
  const joinCode = store.group?.joinCode;

  const copyCode = () => {
    try { navigator.clipboard?.writeText(joinCode); ui.toast('Join code copied'); } catch { ui.toast(joinCode); }
  };

  return (
    <>
      {joinCode && store.canManageMembers() && (
        <div className="cha-card" style={{ margin: '0 2px 12px', padding: '12px 14px', background: 'var(--blue-50)', border: '1px solid var(--blue-100)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', color: 'var(--blue-deep)' }}>CHAMA JOIN CODE</div>
              <div className="cha-num" style={{ fontSize: 22, fontWeight: 800, letterSpacing: 4, color: 'var(--blue-deep)', marginTop: 2 }}>{joinCode}</div>
            </div>
            <button className="cha-chip2" onClick={copyCode} style={{ background: '#fff' }}>
              <Copy size={13} /> Copy
            </button>
          </div>
          <div className="cha-muted cha-small" style={{ marginTop: 4, fontSize: 11 }}>
            New members enter this code to join <b>{store.group.name}</b>.
          </div>
        </div>
      )}

      <div className="cha-sec" style={{ margin: '0 2px 8px' }}>
        <h5>{ms.length} {ms.length === 1 ? 'member' : 'members'}</h5>
        {store.canManageMembers() && (
          <button className="cha-chip2" onClick={() => openAddMember(ui, store)}>
            <UserPlus size={13} /> Add member
          </button>
        )}
      </div>

      {ms.length === 0 && (
        <Empty icon={Users} title="No members yet" text="Add the people in your Chama. Each person gets a card with their contributions, loans, and role." />
      )}

      <div className="cha-list-card">
        {ms.map((m) => {
          const st = store.memberStatus(m.id, cy.id);
          return (
            <button className="cha-li" key={m.id} onClick={() => open('member_detail', { id: m.id })}>
              <Avatar name={m.name} />
              <div className="cha-lt"><b>{m.name}</b><span>{m.phone ? store.displayPhone(m.phone) : 'No phone'}</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <StatusPill state={st.state} />
                <RoleTag role={m.role} />
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

export function MemberDetail({ store, id, params }) {
  const ui = useUI();
  const { toast, confirm, back } = ui;
  const mid = id || params?.id;
  const m = store.memberById(mid);
  if (!m) return null;

  const total = store.contributions.filter((c) => c.memberId === m.id).reduce((t, c) => t + c.amount, 0);
  const loans = store.loans.filter((l) => l.memberId === m.id);
  const contribs = store.contributions.filter((c) => c.memberId === m.id).sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <>
      <div className="cha-card cha-hero-sub">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar name={m.name} size={48} />
          <div><h3 style={{ margin: 0 }}>{m.name}</h3><span className="cha-muted cha-small">{m.phone ? store.displayPhone(m.phone) : 'No phone'}</span></div>
        </div>
        <div className="cha-mini-kpis" style={{ marginTop: 14 }}>
          <div><div className="k">Role</div><div className="v"><RoleTag role={m.role} /></div></div>
          <div><div className="k">Lifetime</div><div className="v cha-num">{fmtKES(total)}</div></div>
          <div><div className="k">Loans</div><div className="v">{loans.length}</div></div>
        </div>
        {store.canManageMoney() && <button className="cha-btn" onClick={() => openCollect(ui, store, m.id)}><Plus size={17} /> Collect contribution</button>}
        {store.canManageMembers() && !m.userId && (
          <button className="cha-btn cha-btn-ghost" style={{ marginTop: 8 }} onClick={() => openInvite(ui, store, m)}>
            <MessageCircle size={17} /> Send invite code
          </button>
        )}
      </div>

      <div className="cha-card">
        <div className="cha-sec" style={{ margin: '0 0 6px' }}><h5>Recent contributions</h5></div>
        {contribs.slice(0, 10).map((c) => (
          <div className="cha-mrow" key={c.id} style={{ alignItems: 'flex-start' }}>
            <div>
              <b>{store.cycleLabel(c.cycleId)}</b>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                {fmtDateTime(c.date)}{c.ref ? ` · Ref: ${c.ref}` : ''}
              </div>
            </div>
            <span className="cap">{c.method}</span>
            <span className="cha-num" style={{ fontWeight: 700, color: 'var(--good)' }}>+ {fmtKES(c.amount)}</span>
          </div>
        ))}
        {contribs.length === 0 && <div className="cha-muted cha-small">None yet.</div>}
      </div>

      {store.myRole() === 'Chairperson' && m.id !== store.myMemberId() && (
        <div className="cha-card">
          <div className="cha-sec" style={{ margin: '0 0 8px' }}><h5>Role</h5></div>
          <select className="cha-select" value={m.role} onChange={(e) => { store.setMemberRole(m.id, e.target.value); toast(`${m.name} is now the ${e.target.value}`); }}>
            <option>Chairperson</option><option>Treasurer</option><option>Secretary</option><option>Member</option>
          </select>
          <p className="cha-muted cha-small" style={{ marginBottom: 0 }}>Treasurer records money · Secretary runs meetings · Chairperson can do both and manage the group.</p>
        </div>
      )}

      {store.canManageMembers() && m.id !== store.myMemberId() && (
        <button className="cha-btn cha-btn-danger" onClick={() =>
          confirm('Remove member?', `${m.name} will be removed from the group.`, () => { store.removeMember(m.id); toast('Member removed'); back(); })}>
          Remove from group
        </button>
      )}
    </>
  );
}
