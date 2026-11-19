// Cookie consent (browser). The choice is stored in the `lf_consent` cookie for
// 180 days so the server can read it too (e.g. before loading Google AdSense).
//
// Today the site only sets strictly necessary cookies (sign-in, language), which
// don't need consent. "analytics" and "ads" exist so that any future tracking or
// advertising script can check `hasConsent('ads')` before it loads.

export const CONSENT_COOKIE = 'lf_consent';
/** Bump when the categories change, to ask everyone again. */
export const CONSENT_VERSION = 1;
const MAX_AGE_DAYS = 180;
export const OPEN_CONSENT_EVENT = 'lf:open-cookie-settings';
export const CONSENT_CHANGED_EVENT = 'lf:consent-changed';

export interface Consent {
  v: number;
  necessary: true;
  analytics: boolean;
  ads: boolean;
  /** ISO time the choice was made. */
  at: string;
}

export function readConsent(): Consent | null {
  if (typeof document === 'undefined') return null;
  const raw = document.cookie.split('; ').find((c) => c.startsWith(`${CONSENT_COOKIE}=`));
  if (!raw) return null;
  try {
    const c = JSON.parse(decodeURIComponent(raw.slice(CONSENT_COOKIE.length + 1))) as Consent;
    return c && c.v === CONSENT_VERSION ? c : null;
  } catch {
    return null;
  }
}

export function saveConsent(choice: { analytics: boolean; ads: boolean }): Consent {
  const c: Consent = { v: CONSENT_VERSION, necessary: true, analytics: !!choice.analytics, ads: !!choice.ads, at: new Date().toISOString() };
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(c))}; Max-Age=${MAX_AGE_DAYS * 86400}; Path=/; SameSite=Lax${secure}`;
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: c }));
  return c;
}

export const hasConsent = (category: 'analytics' | 'ads') => !!readConsent()?.[category];

/** Re-open the banner (footer "Cookie settings" link). */
export const openCookieSettings = () => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT));
