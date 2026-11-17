'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LANG_COOKIE, LOCALE_TAG, Lang } from './config';
import { TFunction, createT } from './translate';

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: TFunction;
  /** Locale-aware date, e.g. "18 Nov 2026" / "18 नव॰ 2026". */
  formatDate: (iso: string | Date, opts?: Intl.DateTimeFormatOptions) => string;
  formatDateTime: (iso: string | Date) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function LanguageProvider({ initialLang, children }: { initialLang: Lang; children: React.ReactNode }) {
  const router = useRouter();
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback(
    (next: Lang) => {
      if (next === lang) return;
      // One year; read by the server so the next page render is already in this language.
      document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = next;
      setLangState(next);
      router.refresh(); // re-render server components (content pages) in the new language
    },
    [lang, router]
  );

  const value = useMemo<I18nValue>(() => {
    const tag = LOCALE_TAG[lang];
    return {
      lang,
      setLang,
      t: createT(lang),
      formatDate: (iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
        new Date(iso).toLocaleDateString(tag, opts),
      formatDateTime: (iso) =>
        new Date(iso).toLocaleString(tag, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }),
    };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <LanguageProvider>');
  return ctx;
}
