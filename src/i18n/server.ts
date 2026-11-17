import { cookies } from 'next/headers';
import { DEFAULT_LANG, LANG_COOKIE, Lang, isLang } from './config';
import { createT } from './translate';

/** The visitor's language from the `lf_lang` cookie (set by the language switcher). */
export async function getLang(): Promise<Lang> {
  const value = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(value) ? value : DEFAULT_LANG;
}

export async function getServerT() {
  const lang = await getLang();
  return { lang, t: createT(lang) };
}
