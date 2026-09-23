import { useState } from 'react';
import { Plus, UserPlus, Users, MessageCircle, Copy, Check, X, UserCheck, ShieldCheck } from 'lucide-react';
import { fmtKES, fmtDateTime, Avatar, RoleTag, StatusPill, useUI, Empty } from './kit';
import { openAddMember, openCollect, openInvite } from './forms';
import { makeInviteLink, whatsappInviteUrl } from '../../lib/invite';

export function MembersScreen({ store, open }) {
  const ui = useUI();
  const cy = store.activeCycle();
  const ms = store.members();
  const joinCode = store.group?.joinCode;
  const pending = store.pendingRequests ? store.pendingRequests() : [];
  const needsApproval = store.group?.requireApproval !== false;
  const isChair = store.myRole() === 'Chairperson';
  const [busyId, setBusyId] = useState(null);

  const decide = async (p, approve) => {
    setBusyId(p.id);
    const res = approve ? await store.approveMember(p.id) : await store.rejectMember(p.id);
    setBusyId(null);
    if (!res.ok) return ui.toast(res.error || 'Something went wrong — try again');
    ui.toast(approve ? `${p.name} is now a member` : `Declined ${p.name}'s request`);
  };

  return (
    <>
      {joinCode && store.canManageMembers() && (
        <div className="cha-card" style={{ margin: '0 2px 14px', padding: '16px', background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)', border: '1px solid #bfdbfe', borderRadius: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em', color: 'var(--blue-deep)' }}>CHAMA INVITE LINK</div>
            <span style={{ fontSize: 11, background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>
              {needsApproval ? 'You approve' : 'Instant join'}
            </span>
          </div>

          <div className="cha-muted cha-small" style={{ fontSize: 12, lineHeight: 1.4, color: '#334155' }}>
            {needsApproval
              ? <>Share this link with people you want in <b>{store.group.name}</b>. When they tap it, they appear below as a join request — they only become members (and see the group) after you approve them.</>
              : <>Share this link with members. Anyone who taps it joins <b>{store.group.name}</b> straight away, without approval.</>}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12, padding: '10px 12px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 12, cursor: isChair ? 'pointer' : 'default' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
              <ShieldCheck size={16} color="#059669" /> Approve people before they join
            </span>
            <input
              type="checkbox"
              checked={needsApproval}
              disabled={!isChair}
              onChange={(e) => { store.setRequireApproval(e.target.checked); ui.toast(e.target.checked ? 'New members now need your approval' : 'Anyone with the link can join instantly'); }}
              style={{ width: 20, height: 20 }}
            />
          </label>
          {!isChair && <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Only the Chairperson can change this.</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
            <a
              className="cha-btn"
              href={whatsappInviteUrl({ groupName: store.group.name, code: joinCode })}
              target="_blank"
              rel="noreferrer"
              style={{ background: 'linear-gradient(135deg, #059669, #10b981)', color: '#fff', padding: '10px', fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12 }}
            >
              <MessageCircle size={15} /> WhatsApp Link
            </a>
            <button
              className="cha-btn cha-btn-ghost"
              onClick={() => {
                const link = makeInviteLink(joinCode);
                try { navigator.clipboard?.writeText(link); ui.toast('Invite link copied! Send it to members'); } catch { ui.toast(link); }
              }}
              style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '10px', fontSize: 13, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Copy size={15} /> Copy Link
            </button>
          </div>

          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#64748b' }}>
            <span>Manual code: <b style={{ fontFamily: 'monospace', letterSpacing: 1.5, color: '#1e293b' }}>{joinCode}</b></span>
            <button
              onClick={() => {
                try { navigator.clipboard?.writeText(joinCode); ui.toast('Code copied: ' + joinCode); } catch { ui.toast(joinCode); }
              }}
              style={{ background: 'transparent', border: 'none', color: 'var(--blue-deep)', fontWeight: 600, cursor: 'pointer', padding: '2px 4px' }}
            >
              Copy code
            </button>
          </div>
        </div>
      )}

      {/* Pending Join Requests */}
      {store.canManageMembers() && pending.length > 0 && (
        <div className="cha-card" style={{ margin: '0 2px 14px', padding: '14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#92400e', display: 'flex', alignItems: 'center', gap: 6 }}>
              <UserCheck size={16} /> Pending Join Requests ({pending.length})
            </div>
            <span style={{ fontSize: 11, background: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>Awaiting Approval</span>
          </div>
          {pending.map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 0', borderTop: '1px solid #fef3c7' }}>
              <div style={{ minWidth: 0 }}>
                <b style={{ fontSize: 13, color: '#1e293b' }}>{p.name}</b>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  {p.phone ? store.displayPhone(p.phone) + ' · ' : ''}{p.joinedAt ? `asked ${fmtDateTime(p.joinedAt)}` : 'Requested to join'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  className="cha-btn cha-btn-ghost cha-btn-sm"
                  disabled={busyId === p.id}
                  onClick={() => ui.confirm(`Decline ${p.name}?`, 'They will not be added to the Chama. They can ask again with the link.', () => decide(p, false))}
                  style={{ borderRadius: 10, padding: '6px 10px', fontSize: 12, fontWeight: 700, color: 'var(--bad)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <X size={14} /> Decline
                </button>
                <button
                  className="cha-btn cha-btn-sm"
                  disabled={busyId === p.id}
                  onClick={() => decide(p, true)}
                  style={{ background: 'linear-gradient(135deg, #059669, #10b981)', color: '#fff', borderRadius: 10, padding: '6px 12px', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <Check size={14} /> Approve
                </button>
              </div>
            </div>
          ))}
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
