/* =====================================================================
 * ChamaOne — lib/notifications.js
 * On-device notifications with a runtime permission prompt.
 *   • Native (Capacitor): @capacitor/local-notifications — fires in the system
 *     tray, can be scheduled for a future time (e.g. a meeting reminder), works
 *     fully offline (no Firebase/push server needed).
 *   • Web (dev / PWA): the Notifications API as a graceful fallback.
 * Every function is defensive and never throws.
 * ===================================================================== */
import { isNative } from './native';

let _plugin = null;
async function plugin() {
  if (!isNative()) return null;
  if (_plugin) return _plugin;
  try { _plugin = (await import('@capacitor/local-notifications')).LocalNotifications; }
  catch { _plugin = null; }
  return _plugin;
}

// Small positive integer id for native notifications.
let _id = Date.now() % 100000;
const nextId = () => (_id = (_id + 1) % 2000000000) + 1;

/* ---------- permission ---------- */
export async function getPermission() {
  if (isNative()) {
    const p = await plugin();
    if (!p) return 'unsupported';
    try { return (await p.checkPermissions()).display; } catch { return 'unsupported'; }
  }
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission; // 'granted' | 'denied' | 'default'
}

// Request permission if not already decided. Returns true when granted.
export async function ensurePermission() {
  if (isNative()) {
    const p = await plugin();
    if (!p) return false;
    try {
      let s = (await p.checkPermissions()).display;
      if (s === 'prompt' || s === 'prompt-with-rationale') s = (await p.requestPermissions()).display;
      return s === 'granted';
    } catch { return false; }
  }
  if (typeof Notification === 'undefined') return false;
  try {
    let s = Notification.permission;
    if (s === 'default') s = await Notification.requestPermission();
    return s === 'granted';
  } catch { return false; }
}

/* ---------- fire now ---------- */
export async function notify({ title, body }) {
  if (isNative()) {
    const p = await plugin();
    if (!p) return;
    try {
      await p.schedule({ notifications: [{ id: nextId(), title, body, smallIcon: 'ic_stat_icon_config_sample' }] });
    } catch { /* ignore */ }
    return;
  }
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try { new Notification(title, { body, icon: '/favicon.svg' }); } catch { /* ignore */ }
}

/* ---------- schedule for a future time (e.g. a meeting reminder) ---------- */
export async function scheduleAt({ title, body, at }) {
  const when = at instanceof Date ? at : new Date(at);
  if (isNaN(when) || when.getTime() <= Date.now()) return; // past → nothing to schedule
  if (isNative()) {
    const p = await plugin();
    if (!p) return;
    try {
      await p.schedule({ notifications: [{ id: nextId(), title, body, schedule: { at: when }, smallIcon: 'ic_stat_icon_config_sample' }] });
    } catch { /* ignore */ }
    return;
  }
  // Web fallback: only if the delay is short enough that the tab is plausibly
  // still open. Native handles the real long-range scheduling.
  const delay = when.getTime() - Date.now();
  if (delay > 0 && delay < 6 * 60 * 60 * 1000 && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    setTimeout(() => { try { new Notification(title, { body, icon: '/favicon.svg' }); } catch { /* ignore */ } }, delay);
  }
}
