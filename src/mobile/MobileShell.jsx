import { useState, useCallback } from 'react';
import { Bell, ChevronLeft, Home, Users, CreditCard, Vote, BarChart3, Plus } from 'lucide-react';
import MobileHome from './MobileHome';
import { SCREENS, TABS } from './screens/registry';
import { UIProvider, Avatar, NotifIcon } from './screens/kit';
import { fmtDateTime } from '../store/chama';

function timeAgo(iso) {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return fmtDateTime(iso);
}
const TAB_ICONS = { home: Home, members: Users, loans: CreditCard, meetings: Vote, more: BarChart3 };

export default function MobileShell({ store, user, onLogout }) {
  const [stack, setStack] = useState([{ name: 'home' }]);
  const [notifOpen, setNotifOpen] = useState(false);
  const current = stack[stack.length - 1];
  const rootName = stack[0].name;

  const open = useCallback((name, params = {}) => { setNotifOpen(false); setStack((s) => [...s, { name, params }]); }, []);
  const back = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);
  const setRoot = useCallback((name) => { setNotifOpen(false); setStack([{ name }]); }, []);

  const unread = store.unreadCount();
  const isHome = current.name === 'home';
  const canBack = stack.length > 1;

  const hr = new Date().getHours();
  const greeting = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';

  const screenDef = SCREENS[current.name];
  const ScreenComp = screenDef?.Component;

  const Bellbtn = (
    <button className="cha-bell" onClick={() => setNotifOpen((o) => !o)} aria-label="Notifications">
      <Bell />
      {unread > 0 && <span className="cha-bdot">{unread > 9 ? '9+' : unread}</span>}
    </button>
  );

  return (
    <div className="cha-m">
      <UIProvider>
        <div className="cha-app">
          <div className="cha-scroll">
            {isHome ? (
              <div className="cha-top">
                <Avatar name={user?.name} />
                <div className="cha-who">
                  <div className="cha-hi">{greeting}</div>
                  <div className="cha-nm">{user?.name || 'Chairperson'}</div>
                </div>
                {Bellbtn}
              </div>
            ) : (
              <div className="cha-schead" style={{ padding: 0, marginBottom: 4 }}>
                {canBack && <button className="cha-back" onClick={back} aria-label="Back"><ChevronLeft /></button>}
                <h2>{screenDef?.title || ''}</h2>
                {screenDef?.addLabel && (
                  <button className="cha-addbtn" onClick={() => screenDef.onAdd?.(open)}><Plus />{screenDef.addLabel}</button>
                )}
                {!canBack && !screenDef?.addLabel && Bellbtn}
              </div>
            )}

            {isHome ? (
              <MobileHome store={store} user={user} open={open} />
            ) : ScreenComp ? (
              <ScreenComp store={store} user={user} open={open} back={back} params={current.params} onLogout={onLogout} />
            ) : (
              <div className="cha-empty"><p>Screen not found.</p></div>
            )}
          </div>

          <nav className="cha-tabbar">
            {TABS.map((t) => {
              const Icon = TAB_ICONS[t.key] || Home;
              const active = rootName === t.key;
              return (
                <button key={t.key} className={`cha-tab${active ? ' on' : ''}`} onClick={() => setRoot(t.key)}>
                  {active && <span className="cha-ind" />}
                  <Icon /><span>{t.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {notifOpen && (
          <div className="cha-np">
            <h6>
              <span>Notifications{unread > 0 ? ` · ${unread} new` : ''}</span>
              {unread > 0 && <button className="cha-chip2" onClick={() => store.markAllRead()}>Mark all read</button>}
            </h6>
            <div className="list">
              {store.notifications.length === 0 && <div className="cha-note"><span>You&apos;re all caught up.</span></div>}
              {store.notifications.slice(0, 30).map((n) => (
                <div className={`cha-note${n.read ? '' : ' unread'}`} key={n.id} onClick={() => !n.read && store.markRead(n.id)}>
                  <span className="ic"><NotifIcon type={n.type} /></span>
                  <div><b>{n.text}</b><br /><span>{timeAgo(n.date)}</span></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </UIProvider>
    </div>
  );
}
