import { browserLocale, cookieLocale, isLocale, type Locale } from '../../shared/locale';
import { translate } from '../../shared/translations';
import { useSyncExternalStore } from 'react';

const automatic = document.documentElement.dataset.locale;
const defaultLocale = document.documentElement.dataset.defaultLocale;
const automaticLocale = isLocale(defaultLocale) ? defaultLocale : !cookieLocale(document.cookie) && isLocale(automatic) ? automatic : browserLocale(navigator.language);
export let languagePreference: Locale | 'auto' = cookieLocale(document.cookie) ?? 'auto';
export let locale: Locale = languagePreference === 'auto' ? automaticLocale : languagePreference;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function useLocale() { useSyncExternalStore(subscribe, () => `${languagePreference}:${locale}`); return locale; }
export const t = (key: string, values?: Record<string, string | number>) => translate(locale, key, values);
document.documentElement.lang = locale;
document.title = 'Mod Finder';
export function changeLanguage(value: Locale | 'auto') {
  document.cookie = `mf-language=${value === 'auto' ? '' : value}; Path=/; SameSite=Lax; Max-Age=${value === 'auto' ? 0 : 31536000}${location.protocol === 'https:' ? '; Secure' : ''}`;
  languagePreference = value;
  locale = value === 'auto' ? automaticLocale : value;
  document.documentElement.lang = locale;
  for (const listener of listeners) listener();
}
