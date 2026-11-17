import type { Lang } from './config';
import { en } from './dictionaries/en';
import { hi } from './dictionaries/hi';

/** The English dictionary's shape with every leaf widened to `string`; Hindi must match it exactly. */
export type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
export type Dictionary = Widen<typeof en>;

/** Dot paths to every string in the dictionary, e.g. "nav.reportFound". */
type Paths<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Paths<T[K], `${P}${K}.`>;
}[keyof T & string];
export type TKey = Paths<Dictionary>;
export type TVars = Record<string, string | number>;
export type TFunction = (key: TKey, vars?: TVars) => string;

const dictionaries: Record<Lang, Dictionary> = { en, hi };

export const getDictionary = (lang: Lang): Dictionary => dictionaries[lang];

export function createT(lang: Lang): TFunction {
  const dict = dictionaries[lang];
  return (key, vars) => {
    let node: unknown = dict;
    for (const part of key.split('.')) node = (node as Record<string, unknown> | undefined)?.[part];
    // Fall back to English, then to the key itself, so a missing string never blanks the UI.
    if (typeof node !== 'string') {
      node = key.split('.').reduce<unknown>((n, p) => (n as Record<string, unknown> | undefined)?.[p], en);
    }
    let text = typeof node === 'string' ? node : key;
    if (vars) for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(String(v));
    return text;
  };
}
