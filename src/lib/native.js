// Thin wrappers around Capacitor plugins. Every call degrades gracefully in the browser.
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform();

export function tap(style = 'light') {
  try {
    if (isNative) {
      Haptics.impact({ style: style === 'heavy' ? ImpactStyle.Heavy : style === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light });
    } else if (navigator.vibrate) navigator.vibrate(style === 'heavy' ? 25 : 10);
  } catch {}
}
export function success() {
  try {
    if (isNative) Haptics.notification({ type: NotificationType.Success });
    else if (navigator.vibrate) navigator.vibrate([12, 60, 18]);
  } catch {}
}

/* Custom native plugin (android/app/src/main/java/com/tarun/kaizen/KaizenPlugin.java):
   shared text, launch actions (widgets/shortcuts), screen time, Shield, widgets. */
export const Kaizen = registerPlugin('Kaizen');
export const SmsReader = Kaizen; // backwards name
export const isAndroid = platform === 'android';
export async function safe(fn, fallback = null) {
  if (!isAndroid) return fallback;
  try { return await fn(); } catch (e) { console.warn(e); return fallback; }
}


export function openUrl(url) {
  window.open(url, '_blank', 'noopener');
}
