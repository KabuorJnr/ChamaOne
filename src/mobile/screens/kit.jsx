import { createContext, useContext, useState, useCallback } from 'react';
import {
  ThumbsUp, ThumbsDown, MinusCircle, Smartphone, Loader2, CheckCircle2, XCircle, Info,
  Wallet, CreditCard, Vote, UserPlus, RefreshCw, Sparkles, Bell, X,
} from 'lucide-react';
import { fmtKES, fmtDateTime } from '../../store/chama';

export { fmtKES, fmtDateTime };

/* ---------- vote label: lucide icon + count (yes/no/abstain) ---------- */
const VOTE = { yes: [ThumbsUp, 'cha-v-yes'], no: [ThumbsDown, 'cha-v-no'], ab: [MinusCircle, 'cha-v-ab'] };
export function VoteTag({ kind, n, size = 15 }) {
  const [Icon, cls] = VOTE[kind];
  return <span className={cls} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon size={size} /> {n}</span>;
}

/* ---------- STK push status icon (spins while pending) ---------- */
const STK = { sending: Smartphone, prompted: Loader2, success: CheckCircle2, failed: XCircle, info: Info };
export function StkIcon({ stage, size = 16 }) {
  const Icon = STK[stage] || Info;
  const spin = stage === 'prompted' || stage === 'sending';
  return <Icon size={size} className={spin ? 'cha-spin' : ''} style={{ flex: '0 0 auto' }} />;
}

/* ---------- notification-type icon (lucide) ---------- */
const NOTIF = { money: Wallet, loan: CreditCard, meeting: Vote, member: UserPlus, cycle: RefreshCw, system: Sparkles };
export function NotifIcon({ type, size = 18 }) {
  const Icon = NOTIF[type] || Bell;
  return <Icon size={size} />;
}

/* ---------- small presentational components ---------- */
export function Avatar({ name, size }) {
  const parts = String(name || '?').trim().split(/\s+/);
  const initials = ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'CH';
  const style = size ? { width: size, height: size, borderRadius: size / 3, fontSize: size * 0.36 } : undefined;
  return <span className="cha-avatar" style={style}>{initials}</span>;
}

export function RoleTag({ role }) {
  const k = String(role).toLowerCase();
  const cls = k.includes('chair') ? 'chair' : k.includes('treas') ? 'treas' : k.includes('secre') ? 'sec' : 'member';
  return <span className={`cha-tag cha-tag-${cls}`}>{role}</span>;
}

export function StatusPill({ state }) {
  const map = { paid: ['Paid', 'ok'], partial: ['Partial', 'warn'], unpaid: ['Unpaid', 'bad'], na: ['—', 'muted'] };
  const [t, c] = map[state] || map.na;
  return <span className={`cha-pill2 cha-pill-${c}`}>{t}</span>;
}

export function Ring({ pct = 0, label = 'collected' }) {
  const R = 46, C = 2 * Math.PI * R;
  const off = C - (pct / 100) * C;
  return (
    <div className="cha-ring-wrap">
      <svg viewBox="0 0 108 108" className="cha-ring">
        <circle cx="54" cy="54" r={R} className="cha-ring-bg" />
        <circle cx="54" cy="54" r={R} className="cha-ring-fg" strokeDasharray={C} strokeDashoffset={off} transform="rotate(-90 54 54)" />
      </svg>
      <div className="cha-ring-center">
        <div className="cha-ring-pct">{pct}%</div>
        <div className="cha-ring-lb">{label}</div>
      </div>
    </div>
  );
}

export function BarChart({ data }) {
  if (!data || !data.length) return <div className="cha-muted cha-small">No data yet.</div>;
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <div className="cha-bars">
      {data.map((d, i) => (
        <div className="cha-bar-col" key={i}>
          <div className="cha-bar-val cha-num">{d.total ? Math.round(d.total / 1000) + 'k' : ''}</div>
          <div className="cha-bar" style={{ height: `${Math.max(4, (d.total / max) * 100)}%` }} />
          <div className="cha-bar-lb">{String(d.label).split(' ')[0].slice(0, 3)}</div>
        </div>
      ))}
    </div>
  );
}

export function SecHead({ title, action, onAction }) {
  return (
    <div className="cha-sec">
      <h5>{title}</h5>
      {action && <a onClick={onAction}>{action}</a>}
    </div>
  );
}

export function Empty({ icon: Icon, title, text, children }) {
  return (
    <div className="cha-empty">
      {Icon && <div className="cha-pic"><Icon /></div>}
      {title && <h4>{title}</h4>}
      {text && <p>{text}</p>}
      {children}
    </div>
  );
}

/* ---------- UI context: toasts + bottom sheets ---------- */
const UICtx = createContext(null);
export const useUI = () => useContext(UICtx);

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [sheet, setSheet] = useState(null); // { title, render } | null
  const [closing, setClosing] = useState(false);

  const toast = useCallback((msg) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2400);
  }, []);

  const closeSheet = useCallback(() => {
    setClosing(true);
    setTimeout(() => { setSheet(null); setClosing(false); }, 240);
  }, []);

  const openSheet = useCallback((title, render) => setSheet({ title, render }), []);

  const confirm = useCallback((title, msg, onYes) => {
    openSheet(title, (close) => (
      <>
        <p className="cha-muted" style={{ marginTop: 0 }}>{msg}</p>
        <div className="cha-btn-row">
          <button className="cha-btn cha-btn-ghost" onClick={close}>Cancel</button>
          <button className="cha-btn" onClick={() => { close(); onYes(); }}>Confirm</button>
        </div>
      </>
    ));
  }, [openSheet]);

  return (
    <UICtx.Provider value={{ toast, openSheet, closeSheet, confirm }}>
      {children}
      {sheet && (
        <div className={`cha-overlay${closing ? '' : ' show'}`} onClick={(e) => { if (e.target === e.currentTarget) closeSheet(); }}>
          <div className="cha-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="cha-grab" />
            <div className="cha-sheet-h">
              <h3>{sheet.title}</h3>
              <button className="cha-x" onClick={closeSheet} aria-label="Close"><X size={16} /></button>
            </div>
            {sheet.render(closeSheet)}
          </div>
        </div>
      )}
      <div className="cha-toast-root">
        {toasts.map((t) => <div className="cha-toast show" key={t.id}>{t.msg}</div>)}
      </div>
    </UICtx.Provider>
  );
}

/* trigger a CSV/text download */
export function downloadText(filename, text, mime = 'text/csv') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
