'use client';

import React from 'react';
import { Languages } from 'lucide-react';
import { useI18n } from '@/i18n/LanguageProvider';
import { LANGS, LANG_LABEL } from '@/i18n/config';

/** Two-button EN / हिं switch. `compact` hides the globe icon for tight navbars. */
export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, setLang, t } = useI18n();
  return (
    <div role="group" aria-label={t('lang.label')} className="flex items-center gap-1">
      {!compact && <Languages className="w-4 h-4 text-gray-500" aria-hidden="true" />}
      <div className="flex p-0.5 bg-gray-100 rounded-lg">
        {LANGS.map((l) => (
          <button
            key={l}
            type="button"
            lang={l}
            onClick={() => setLang(l)}
            aria-pressed={lang === l}
            aria-label={t('lang.switchTo', { lang: LANG_LABEL[l] })}
            className={`px-2 py-1 rounded-md text-xs font-bold transition ${
              lang === l ? 'bg-white text-blue-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {l === 'en' ? 'EN' : 'हिं'}
          </button>
        ))}
      </div>
    </div>
  );
}
