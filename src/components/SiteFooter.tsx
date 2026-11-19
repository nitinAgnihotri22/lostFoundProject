'use client';

import React from 'react';
import Link from 'next/link';
import { Compass } from 'lucide-react';
import { useI18n } from '@/i18n/LanguageProvider';
import type { TKey } from '@/i18n/translate';
import LanguageSwitcher from './LanguageSwitcher';
import { openCookieSettings } from '@/lib/consent';

const GROUPS: { title: TKey; links: { href: string; label: TKey }[] }[] = [
  {
    title: 'footer.company',
    links: [
      { href: '/', label: 'footer.home' },
      { href: '/about', label: 'footer.about' },
      { href: '/contact', label: 'footer.contact' },
    ],
  },
  {
    title: 'footer.legal',
    links: [
      { href: '/privacy', label: 'footer.privacy' },
      { href: '/terms', label: 'footer.terms' },
    ],
  },
  {
    title: 'footer.help',
    links: [
      { href: '/accessibility', label: 'footer.accessibility' },
      { href: '/sitemap', label: 'footer.sitemap' },
    ],
  },
];

export default function SiteFooter({ companyName }: { companyName: string }) {
  const { t } = useI18n();
  return (
    <footer className="mt-auto bg-white border-t border-gray-200 print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white">
              <Compass className="w-5 h-5" aria-hidden="true" />
            </span>
            <span className="text-lg font-black text-gray-900">
              Lost<span className="text-blue-600">Found</span>
            </span>
          </Link>
          <p className="text-sm text-gray-600 max-w-xs">{t('footer.tagline')}</p>
          <LanguageSwitcher />
        </div>
        <nav aria-label={t('footer.footerNav')} className="contents">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">{t(g.title)}</h2>
              <ul className="space-y-2">
                {g.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-gray-700 hover:text-blue-700 hover:underline underline-offset-2">
                      {t(l.label)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="border-t border-gray-100">
        <p className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 text-xs text-gray-500">
          {t('footer.rights', { year: new Date().getFullYear(), company: companyName })}
          <span aria-hidden="true"> · </span>
          <button type="button" onClick={openCookieSettings} className="underline underline-offset-2 hover:text-blue-700">
            {t('cookies.settings')}
          </button>
        </p>
      </div>
    </footer>
  );
}
