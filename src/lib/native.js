// Native (Capacitor) runtime wiring. No-op on the web build.
import { Capacitor } from '@capacitor/core';

export const isNative = () => { try { return Capacitor?.isNativePlatform?.() ?? false; } catch { return false; } };
export const nativePlatform = () => { try { return Capacitor?.getPlatform?.() ?? 'web'; } catch { return 'web'; } };

export async function initNative() {
  if (!isNative()) return;
  document.documentElement.classList.add('capacitor', `platform-${nativePlatform()}`);
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    // Do NOT draw under the status bar — keep the battery/clock/notifications
    // visible; the OS reserves that strip and the app starts below it.
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setStyle({ style: Style.Light });
    try { await StatusBar.setBackgroundColor({ color: '#0F172A' }); } catch { /* iOS: no-op */ }
  } catch { /* ignore */ }
  try {
    const { App } = await import('@capacitor/app');
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) window.history.back();
      else App.exitApp();
    });
  } catch { /* ignore */ }
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch { /* ignore */ }
}
