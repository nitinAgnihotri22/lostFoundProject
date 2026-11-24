// Browser push: register the service worker and subscribe this device.
// Only call subscribePush() from a click – browsers block permission prompts otherwise.
const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

export type PushState = 'unsupported' | 'not_configured' | 'denied' | 'off' | 'on' | 'needs_install';

const isIos = () => typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
const isStandalone = () => typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true);

export async function pushState(): Promise<PushState> {
  if (typeof window === 'undefined') return 'unsupported';
  if (!PUBLIC_KEY) return 'not_configured';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return isIos() && !isStandalone() ? 'needs_install' : 'unsupported';
  }
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  return sub ? 'on' : 'off';
}

function keyBytes(b64u: string): Uint8Array {
  const b64 = b64u.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64u.length % 4)) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** Ask permission, subscribe and save on the server. Returns the new state. */
export async function subscribePush(): Promise<PushState> {
  const state = await pushState();
  if (state !== 'off' && state !== 'on') return state;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';
  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUBLIC_KEY) as BufferSource }));
  const res = await fetch('/api/push/subscribe', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub.toJSON()) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not turn on notifications');
  return 'on';
}

export async function unsubscribePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await fetch('/api/push/subscribe', { method: 'DELETE', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
  return 'off';
}
