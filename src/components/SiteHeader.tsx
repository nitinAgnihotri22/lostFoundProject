'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Compass } from 'lucide-react';
import { useI18n } from '@/i18n/LanguageProvider';
import LanguageSwitcher from './LanguageSwitcher';

/** Header for the static content pages (About, Contact, Privacy, …). */
export default function SiteHeader() {
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-gray-100 print:hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 text-sm font-bold text-gray-700 hover:text-blue-700">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>{t('common.backToHome')}</span>
        </Link>
        <div className="flex items-center gap-3">
          <LanguageSwitcher compact />
          <Link href="/" aria-label={t('nav.home')} className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white">
            <Compass className="w-5 h-5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  );
}
