import type { Locale } from './locale';
import en from './locales/en.json';
import ko from './locales/ko.json';
import ja from './locales/ja.json';
import zh from './locales/zh-CN.json';
import es from './locales/es.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
export const english: Record<string, string> = en;
export const dictionaries: Record<Locale, Record<string,string>> = { ko, en, ja, 'zh-CN':zh, es, de, fr };
export function translate(locale: Locale, key: string, values: Record<string, string | number> = {}): string {
  const text = dictionaries[locale][key] ?? english[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (token, name: string) => String(values[name] ?? token));
}
