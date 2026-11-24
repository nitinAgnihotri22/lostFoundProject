'use client';
// Loads Google AdSense and (optionally) Google Analytics 4 for the public site,
// only after the visitor allowed them in the cookie banner, and records page views.
//
//  - Ads load only when: ads are switched on in /admin/ads, a publisher id is set,
//    the visitor allowed advertising cookies, and they are not in the no-ads
//    test group (holdout).
//  - GA4 loads only when a measurement id is set and analytics are allowed.
//  - Withdrawing consent after a script has loaded reloads the page, so the
//    script is really gone.
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { CONSENT_CHANGED_EVENT, readConsent } from '@/lib/consent';
import { AB_COOKIE, adVariant, parseBucket, type AdVariant, type AdsSettings } from '@/lib/monetization';
import { clearVisitorId, setTrackingVariant, track } from '@/lib/track';

interface AdsContextValue {
  /** Ad slots may render. */
  active: boolean;
  variant: AdVariant;
  settings: AdsSettings;
  /** Premium members see no ads (set by pages that know the signed-in user). */
  setPremium: (premium: boolean) => void;
}

const AdsCtx = createContext<AdsContextValue | null>(null);
export const useAds = () => useContext(AdsCtx);

function readBucket(): number {
  const raw = document.cookie.split('; ').find((c) => c.startsWith(`${AB_COOKIE}=`))?.slice(AB_COOKIE.length + 1);
  const existing = parseBucket(raw);
  if (existing != null) return existing;
  const bucket = Math.floor(Math.random() * 100);
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${AB_COOKIE}=${bucket}; Max-Age=${365 * 86400}; Path=/; SameSite=Lax${secure}`;
  return bucket;
}

export default function AdsProvider({ settings, children }: { settings: AdsSettings; children: React.ReactNode }) {
  const pathname = usePathname();
  // Nothing is decided on the server: consent lives in the browser's cookie.
  const [consent, setConsent] = useState<{ analytics: boolean; ads: boolean } | null>(null);
  const [bucket, setBucket] = useState<number | null>(null);
  const [premium, setPremium] = useState(false);
  const loaded = useRef({ ads: false, ga: false });

  useEffect(() => {
    const sync = () => {
      const c = readConsent();
      const next = { analytics: !!c?.analytics, ads: !!c?.ads };
      if ((loaded.current.ads && !next.ads) || (loaded.current.ga && !next.analytics)) {
        if (!next.analytics) clearVisitorId();
        window.location.reload();
        return;
      }
      if (!next.analytics) clearVisitorId();
      setConsent(next);
    };
    sync();
    setBucket(readBucket());
    window.addEventListener(CONSENT_CHANGED_EVENT, sync);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, sync);
  }, []);

  // Premium hides ads entirely, so those visitors are left out of the ads A/B test too.
  const variant: AdVariant = consent && !premium ? adVariant(settings, bucket, consent.ads) : 'none';
  const active = variant === 'ads';
  const gaId = consent?.analytics ? settings.gaMeasurementId : '';

  useEffect(() => {
    setTrackingVariant(variant);
  }, [variant]);

  useEffect(() => {
    if (active) loaded.current.ads = true;
    if (gaId) loaded.current.ga = true;
  }, [active, gaId]);

  // One page_view per route (the home page's item pop-ups are tracked separately).
  useEffect(() => {
    if (consent?.analytics) track('page_view');
  }, [pathname, consent?.analytics]);

  const value = useMemo(() => ({ active, variant, settings, setPremium }), [active, variant, settings]);

  return (
    <AdsCtx.Provider value={value}>
      {children}
      {active && (
        <Script
          id="adsbygoogle-js"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(settings.client)}`}
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      )}
      {gaId && (
        <>
          <Script id="ga4-js" src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;
gtag('consent','default',{analytics_storage:'granted',ad_storage:${consent?.ads ? "'granted'" : "'denied'"},ad_user_data:${consent?.ads ? "'granted'" : "'denied'"},ad_personalization:${consent?.ads ? "'granted'" : "'denied'"}});
gtag('js',new Date());gtag('config',${JSON.stringify(gaId)},{ad_variant:${JSON.stringify(variant)}});`}
          </Script>
        </>
      )}
    </AdsCtx.Provider>
  );
}
