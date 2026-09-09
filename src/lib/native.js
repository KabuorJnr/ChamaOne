// Native (Capacitor) runtime wiring. No-op on the web build.
import { Capacitor } from '@capacitor/core';

export const isNative = () => { try { return Capacitor?.isNativePlatform?.() ?? false; } catch { return false; } };
export const nativePlatform = () => { try { return Capacitor?.getPlatform?.() ?? 'web'; } catch { return 'web'; } };

export async function initNative() {
  if (!isNative()) return;
  document.documentElement.classList.add('capacitor', `platform-${nativePlatform()}`);
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: Style.Light });
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
