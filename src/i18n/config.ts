export const LANGS = ['en', 'hi'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'en';
export const LANG_COOKIE = 'lf_lang';

export const isLang = (v: unknown): v is Lang => typeof v === 'string' && (LANGS as readonly string[]).includes(v);

/** BCP 47 tags for dates, numbers and speech. */
export const LOCALE_TAG: Record<Lang, string> = { en: 'en-IN', hi: 'hi-IN' };

/** Each language's name written in itself, for the switcher. */
export const LANG_LABEL: Record<Lang, string> = { en: 'English', hi: 'हिन्दी' };
