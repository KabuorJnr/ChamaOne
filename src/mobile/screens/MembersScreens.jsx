import { Plus, UserPlus, Users } from 'lucide-react';
import { fmtKES, Avatar, RoleTag, StatusPill, useUI, Empty } from './kit';
import { openAddMember, openCollect } from './forms';

export function MembersScreen({ store, open }) {
  const ui = useUI();
  const cy = store.activeCycle();
  const ms = store.members();
  return (
    <>
      <div className="cha-list-card">
        <div className="cha-li" style={{ cursor: 'default' }}>
          <div className="cha-lt"><span>{ms.length} members · {cy.label}</span></div>
          {store.canManageMembers() && <button className="cha-chip2" onClick={() => openAddMember(ui, store)}><Plus size={13} style={{ verticalAlign: '-2px' }} /> Add</button>}
        </div>
        {ms.map((m) => {
          const st = store.memberStatus(m.id, cy.id);
          return (
            <button className="cha-li" key={m.id} onClick={() => open('member_detail', { id: m.id })}>
              <Avatar name={m.name} />
              <div className="cha-lt">
                <b>{m.name} <RoleTag role={m.role} /></b>
                <span>{store.displayPhone(m.phone)}</span>
              </div>
              <div className="cha-rt">
                <StatusPill state={st.state} />
                <span className="cha-num" style={{ display: 'block', marginTop: 3 }}>{fmtKES(st.paid)}</span>
              </div>
            </button>
          );
        })}
      </div>
      {ms.length === 0 && <Empty icon={Users} title="No members" text="Add members to start tracking contributions." />}
    </>
  );
}

export function MemberDetail({ store, params, back }) {
  const ui = useUI();
  const { confirm, toast } = ui;
  const m = store.memberById(params.id);
  if (!m) return <Empty icon={Users} title="Not found" text="This member no longer exists." />;
  const cy = store.activeCycle().id;
  const st = store.memberStatus(m.id, cy);
  const contribs = store.contributions.filter((c) => c.memberId === m.id).sort((a, b) => new Date(b.date) - new Date(a.date));
  const total = contribs.reduce((t, c) => t + c.amount, 0);
  const loans = store.loans.filter((l) => l.memberId === m.id);
  return (
    <>
      <div className="cha-card">
        <div className="cha-mp-head">
          <Avatar name={m.name} size={56} />
          <div><div className="cha-mp-name">{m.name} <RoleTag role={m.role} /></div>
            <div className="cha-mp-phone">{store.displayPhone(m.phone)}</div></div>
        </div>
        <div className="cha-mp-stats">
          <div><div className="k">This cycle</div><div className="v"><StatusPill state={st.state} /></div></div>
          <div><div className="k">Lifetime</div><div className="v cha-num">{fmtKES(total)}</div></div>
          <div><div className="k">Loans</div><div className="v">{loans.length}</div></div>
        </div>
        {store.canManageMoney() && <button className="cha-btn" onClick={() => openCollect(ui, store, m.id)}><Plus size={17} /> Collect contribution</button>}
      </div>

      <div className="cha-card">
        <div className="cha-sec" style={{ margin: '0 0 6px' }}><h5>Recent contributions</h5></div>
        {contribs.slice(0, 8).map((c) => (
          <div className="cha-mrow" key={c.id}>
            <span>{store.cycleLabel(c.cycleId)}</span>
            <span className="cap">{c.method}</span>
            <span className="cha-num" style={{ fontWeight: 700 }}>{fmtKES(c.amount)}</span>
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
