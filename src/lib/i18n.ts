import { browserLocale, cookieLocale, isLocale, type Locale } from '../../shared/locale';
import { translate } from '../../shared/translations';

const automatic = document.documentElement.dataset.locale;
export const languagePreference = cookieLocale(document.cookie) ?? 'auto';
export const locale: Locale = cookieLocale(document.cookie) ?? (isLocale(automatic) ? automatic : browserLocale(navigator.language));
export const t = (key: string, values?: Record<string, string | number>) => translate(locale, key, values);
document.documentElement.lang = locale;
document.title = locale === 'ko' ? 'Mod Finder — 모드를 만나는 새로운 방법' : 'Mod Finder — Discover your next mod';
export function changeLanguage(value: Locale | 'auto') {
  document.cookie = `mf-language=${value === 'auto' ? '' : value}; Path=/; SameSite=Lax; Max-Age=${value === 'auto' ? 0 : 31536000}${location.protocol === 'https:' ? '; Secure' : ''}`;
  location.reload();
}
