'use client';
// First-visit cookie banner. "Accept all" and "Necessary only" are equally
// prominent (no dark patterns); "Customise" lets people pick categories.
// Re-opened from the footer's "Cookie settings" link.
import React, { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Cookie } from 'lucide-react';
import { useI18n } from '@/i18n/LanguageProvider';
import { OPEN_CONSENT_EVENT, readConsent, saveConsent } from '@/lib/consent';

export default function CookieConsent() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [ads, setAds] = useState(false);
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Decide after mount: the cookie is only readable in the browser.
    if (!readConsent()) setOpen(true);
    const reopen = () => {
      const c = readConsent();
      setAnalytics(!!c?.analytics);
      setAds(!!c?.ads);
      setCustom(true);
      setOpen(true);
      requestAnimationFrame(() => ref.current?.focus());
    };
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
  }, []);

  if (!open) return null;

  const done = (choice: { analytics: boolean; ads: boolean }) => {
    saveConsent(choice);
    setOpen(false);
    setCustom(false);
  };

  const toggle = (id: string, label: string, desc: string, checked: boolean, onChange?: (v: boolean) => void) => (
    <label htmlFor={id} className="flex items-start justify-between gap-4 py-3 border-t border-gray-100 first:border-t-0">
      <span>
        <span className="block text-sm font-bold text-gray-900">{label}</span>
        <span className="block text-xs text-gray-600">{desc}</span>
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        aria-checked={checked}
        checked={checked}
        disabled={!onChange}
        onChange={(e) => onChange?.(e.target.checked)}
        className="mt-1 w-5 h-5 accent-blue-700 shrink-0 disabled:opacity-60"
      />
    </label>
  );

  return (
    <div
      ref={ref}
      role="region"
      aria-labelledby={titleId}
      tabIndex={-1}
      className="fixed inset-x-0 bottom-0 z-[70] p-3 sm:p-4 print:hidden focus:outline-none pointer-events-none"
    >
      <div className="pointer-events-auto mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white shadow-2xl p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="hidden sm:flex w-10 h-10 rounded-xl bg-blue-50 text-blue-700 items-center justify-center shrink-0">
            <Cookie className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-black text-gray-900">{t('cookies.title')}</h2>
            <p className="mt-1 text-sm text-gray-700">
              {t('cookies.body')}{' '}
              <Link href="/privacy#cookies" className="font-semibold text-blue-700 underline underline-offset-2">{t('cookies.learnMore')}</Link>
            </p>

            {custom && (
              <div className="mt-3 rounded-xl border border-gray-200 px-3">
                {toggle('consent-necessary', t('cookies.necessary'), t('cookies.necessaryDesc'), true)}
                {toggle('consent-analytics', t('cookies.analytics'), t('cookies.analyticsDesc'), analytics, setAnalytics)}
                {toggle('consent-ads', t('cookies.ads'), t('cookies.adsDesc'), ads, setAds)}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => done({ analytics: true, ads: true })} className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold">
                {t('cookies.acceptAll')}
              </button>
              <button type="button" onClick={() => done({ analytics: false, ads: false })} className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold">
                {t('cookies.necessaryOnly')}
              </button>
              {custom ? (
                <button type="button" onClick={() => done({ analytics, ads })} className="px-4 py-2 rounded-xl border border-gray-300 bg-white text-gray-800 text-sm font-bold hover:bg-gray-50">
                  {t('cookies.save')}
                </button>
              ) : (
                <button type="button" onClick={() => setCustom(true)} aria-expanded={false} className="px-4 py-2 rounded-xl border border-gray-300 bg-white text-gray-800 text-sm font-bold hover:bg-gray-50">
                  {t('cookies.customise')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
