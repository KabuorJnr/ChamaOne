import { useState } from 'react';
import { Vote, CalendarDays, Calendar, MapPin, CheckCircle2, XCircle, Plus, Video, Copy, ExternalLink } from 'lucide-react';
import { useUI, Empty, VoteTag } from './kit';
import { openNewMeeting } from './forms';
import { fmtDate, fmtDateTime } from '../../store/chama';

// Open a URL outside the app shell (system browser on native, new tab on web).
function openExternal(url) { try { window.open(url, '_blank', 'noopener'); } catch { /* ignore */ } }

export function MeetingsScreen({ store, open }) {
  const ui = useUI();
  const canMeet = store.canManageMeetings();
  const meetings = [...store.meetings].sort((a, b) => new Date(b.date) - new Date(a.date));
  const upcoming = meetings.filter((m) => m.status !== 'completed');
  const past = meetings.filter((m) => m.status === 'completed');

  const Row = ({ mt }) => {
    const openMotions = mt.motions.filter((x) => x.status === 'open').length;
    return (
      <button className="cha-li" onClick={() => open('meeting_detail', { id: mt.id })}>
        <span className="cha-date"><span className="d">{new Date(mt.date).getDate()}</span>
          <span className="mo">{new Date(mt.date).toLocaleDateString('en-KE', { month: 'short' })}</span></span>
        <div className="cha-lt"><b>{mt.title}{mt.online && <span className="cha-pill2 cha-pill-info" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Video size={11} /> Online</span>}</b>
          <span>{mt.online ? 'Video call' : (mt.location || 'TBA')} · {mt.agenda.length} agenda items</span></div>
        <div className="cha-rt">
          {openMotions ? <span className="cha-pill2 cha-pill-warn">{openMotions} vote{openMotions > 1 ? 's' : ''}</span>
            : <span className="cha-pill2 cha-pill-muted">{mt.status}</span>}
        </div>
      </button>
    );
  };

  return (
    <>
      {canMeet && <button className="cha-btn cha-btn-ghost cha-btn-sm" onClick={() => openNewMeeting(ui, store)}><Plus size={16} /> Schedule a meeting</button>}
      {upcoming.length > 0 && (
        <div className="cha-list-card">
          <div className="cha-li" style={{ cursor: 'default' }}><div className="cha-lt"><span>Upcoming &amp; open</span></div></div>
          {upcoming.map((mt) => <Row key={mt.id} mt={mt} />)}
        </div>
      )}
      {past.length > 0 && (
        <div className="cha-list-card">
          <div className="cha-li" style={{ cursor: 'default' }}><div className="cha-lt"><span>Past</span></div></div>
          {past.map((mt) => <Row key={mt.id} mt={mt} />)}
        </div>
      )}
      {meetings.length === 0 && (
        <Empty icon={Vote} title="No meetings yet"
          text="Schedule a meeting, set an agenda, and let members — even in the diaspora — vote on motions in-app.">
          {canMeet && <button className="cha-btn" onClick={() => openNewMeeting(ui, store)}>Schedule meeting</button>}
        </Empty>
      )}
    </>
  );
}

export function MeetingDetail({ store, params }) {
  const ui = useUI();
  const mt = store.meetingById(params.id);
  const [minutes, setMinutes] = useState(mt?.minutes || '');
  if (!mt) return <Empty icon={CalendarDays} title="Not found" text="This meeting no longer exists." />;
  const voterId = store.members()[0].id;
  const canMeet = store.canManageMeetings();

  return (
    <>
      <div className="cha-card">
        <div className="cha-mt-meta" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Calendar size={14} /> {fmtDateTime(mt.date)} <span style={{ opacity: .5 }}>·</span>
          {mt.online ? <><Video size={14} /> Online meeting</> : <><MapPin size={14} /> {mt.location || 'TBA'}</>}
        </div>
        {mt.online && mt.link && (
          <div className="cha-join">
            <button className="cha-btn" onClick={() => openExternal(mt.link)}><Video size={17} /> Join meeting</button>
            <div className="cha-linkrow">
              <span className="cha-linktext">{mt.link}</span>
              <button className="cha-linkbtn" aria-label="Copy link" onClick={() => { navigator.clipboard?.writeText(mt.link).then(() => ui.toast('Link copied')).catch(() => {}); }}><Copy size={15} /></button>
              <button className="cha-linkbtn" aria-label="Open link" onClick={() => openExternal(mt.link)}><ExternalLink size={15} /></button>
            </div>
          </div>
        )}
        {mt.agenda.length > 0 && (
          <>
            <div className="cha-sec" style={{ margin: '0 0 6px' }}><h5>Agenda</h5></div>
            <ol className="cha-agenda">{mt.agenda.map((a, i) => <li key={i}>{a}</li>)}</ol>
          </>
        )}
      </div>

      <div className="cha-card">
        <div className="cha-sec" style={{ margin: '0 0 10px' }}><h5>Motions &amp; voting</h5></div>
        {mt.motions.map((mo) => <Motion key={mo.id} mo={mo} mt={mt} store={store} voterId={voterId} ui={ui} canMeet={canMeet} />)}
        {mt.motions.length === 0 && <div className="cha-muted cha-small">No motions yet.</div>}
        {canMeet && <button className="cha-btn cha-btn-ghost cha-btn-sm" style={{ marginTop: 10 }} onClick={() => addMotion(ui, store, mt.id)}><Plus size={16} /> Add motion</button>}
      </div>

      <div className="cha-card">
        <div className="cha-sec" style={{ margin: '0 0 10px' }}><h5>Minutes</h5></div>
        {canMeet ? (
          <>
            <textarea className="cha-textarea" rows={3} value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="Record decisions…" />
            <button className="cha-btn cha-btn-sm" style={{ marginTop: 8 }} onClick={() => { store.saveMinutes(mt.id, minutes); ui.toast('Minutes saved'); }}>Save minutes</button>
          </>
        ) : (
          <p className="cha-muted cha-small" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{mt.minutes || 'No minutes recorded yet.'}</p>
        )}
      </div>
    </>
  );
}

function Motion({ mo, mt, store, voterId, ui, canMeet }) {
  const votes = Object.values(mo.votes);
  const yes = votes.filter((v) => v === 'yes').length;
  const no = votes.filter((v) => v === 'no').length;
  const ab = votes.filter((v) => v === 'abstain').length;
  const total = store.members().length;
  const seg = (n, c) => <div className={`cha-tseg ${c}`} style={{ flex: n || 0.001 }} />;
  return (
    <div className="cha-motion">
      <div className="cha-motion-t">{mo.text}</div>
      <div className="cha-tally">{seg(yes, 'yes')}{seg(no, 'no')}{seg(ab, 'ab')}{total - votes.length > 0 ? seg(total - votes.length, 'none') : null}</div>
      <div className="cha-tlb"><VoteTag kind="yes" n={yes} /><VoteTag kind="no" n={no} />
        <VoteTag kind="ab" n={ab} /><span className="cha-muted">{votes.length}/{total} voted</span></div>
      {mo.status === 'open' ? (
        <div className="cha-motion-btns">
          <button className="cha-btn cha-btn-sm cha-btn-ok" onClick={() => store.voteMotion(mt.id, mo.id, voterId, 'yes')}>Yes</button>
          <button className="cha-btn cha-btn-sm cha-btn-danger" onClick={() => store.voteMotion(mt.id, mo.id, voterId, 'no')}>No</button>
          <button className="cha-btn cha-btn-sm cha-btn-ghost" onClick={() => store.voteMotion(mt.id, mo.id, voterId, 'abstain')}>Abstain</button>
          {canMeet && <button className="cha-btn cha-btn-sm" onClick={() => { store.closeMotion(mt.id, mo.id); ui.toast('Motion closed'); }}>Close</button>}
        </div>
      ) : (
        <div className={`cha-motion-res ${mo.status}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          {mo.status === 'passed' ? <><CheckCircle2 size={15} /> Passed</> : <><XCircle size={15} /> Failed</>}
        </div>
      )}
    </div>
  );
}

function addMotion(ui, store, meetingId) {
  ui.openSheet('Add motion', (close) => <MotionForm store={store} meetingId={meetingId} close={close} />);
}
function MotionForm({ store, meetingId, close }) {
  const { toast } = useUI();
  const [text, setText] = useState('');
  return (
    <>
      <label className="cha-field"><span>Motion text</span>
        <textarea className="cha-textarea" rows={2} value={text} onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Increase contribution to KES 2,500" /></label>
      <button className="cha-btn" onClick={() => { if (!text.trim()) return toast('Enter motion text'); store.addMotion(meetingId, text.trim()); close(); }}>Add motion</button>
    </>
  );
}
