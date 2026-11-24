// /sw.js – service worker for push notifications (boost alerts, match alerts).
// Served from a route so it lives at the site root and controls every page.
const SW = `
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (_) { d = { body: event.data && event.data.text() }; }
  const opts = {
    body: d.body || '',
    tag: d.tag,
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: { url: d.url || '/', stop: d.stop ? d.stop.url : null },
    actions: d.stop ? [{ action: 'stop', title: d.stop.label }] : [],
  };
  event.waitUntil(self.registration.showNotification(d.title || 'LostFound', opts));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  if (event.action === 'stop' && data.stop) {
    event.waitUntil(fetch(data.stop, { method: 'POST', mode: 'no-cors' }).catch(() => {}));
    return;
  }
  const url = new URL(data.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin) && 'focus' in c) {
          return c.navigate(url).then((w) => (w || c).focus());
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
`;

export function GET() {
  return new Response(SW, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Service-Worker-Allowed': '/',
      'Cache-Control': 'no-cache',
    },
  });
}
