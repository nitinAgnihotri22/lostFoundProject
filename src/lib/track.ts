// Browser analytics: `track('item_view', { category })`.
// Does nothing unless the visitor allowed analytics cookies. Events are queued
// and sent in small batches to /api/analytics, and copied to Google Analytics
// when GA4 is set up and loaded.
import { hasConsent } from '@/lib/consent';
import type { AdVariant, ClientEvent } from '@/lib/monetization';

type Props = Record<string, string | number | boolean | null>;
type Queued = { n: ClientEvent; p: string; x?: Props; a: AdVariant };

const VISITOR_KEY = 'lf_vid';
let queue: Queued[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
let currentVariant: AdVariant = 'none';

/** Set by the site's ads provider so every event carries the visitor's ads group. */
export const setTrackingVariant = (v: AdVariant) => {
  currentVariant = v;
};

/** Random id for this browser, created only once analytics are allowed. */
function visitorId(): string | null {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

/** Forget the visitor id (when analytics consent is withdrawn). */
export function clearVisitorId() {
  try {
    localStorage.removeItem(VISITOR_KEY);
  } catch {}
  queue = [];
}

function flush() {
  clearTimeout(timer);
  timer = undefined;
  if (!queue.length || !hasConsent('analytics')) {
    queue = [];
    return;
  }
  const body = JSON.stringify({ v: visitorId(), e: queue.splice(0, 20) });
  const sent = typeof navigator !== 'undefined' && navigator.sendBeacon?.('/api/analytics', new Blob([body], { type: 'application/json' }));
  if (!sent) fetch('/api/analytics', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => {});
  if (queue.length) timer = setTimeout(flush, 1000);
}

export function track(name: ClientEvent, props?: Props) {
  if (typeof window === 'undefined' || !hasConsent('analytics')) return;
  queue.push({ n: name, p: location.pathname + location.search, x: props, a: currentVariant });
  const gtag = (window as any).gtag as undefined | ((...a: unknown[]) => void);
  // GA4 records its own page views; send the rest as custom events.
  if (gtag && name !== 'page_view') gtag('event', name, { ...props, ad_variant: currentVariant });
  if (queue.length >= 10) flush();
  else if (!timer) timer = setTimeout(flush, 3000);
}

if (typeof window !== 'undefined') {
  // Send what's left when the tab is hidden or closed.
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}
