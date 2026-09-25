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

/* Custom native plugin (android/app/src/main/java/.../SmsReaderPlugin.java) */
export const SmsReader = registerPlugin('SmsReader');

export async function readBankSms(sinceTs) {
  if (platform !== 'android') throw new Error('SMS import works in the Android app only');
  const perm = await SmsReader.requestPermissions();
  if (perm.sms !== 'granted') throw new Error('SMS permission was not granted');
  const res = await SmsReader.read({ since: sinceTs || 0, limit: 500 });
  return res.messages || [];
}

export function openUrl(url) {
  window.open(url, '_blank', 'noopener');
}
