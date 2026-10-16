export const LANGUAGES = [
  { id:'ko', name:'한국어' }, { id:'en', name:'English' },
  { id:'ja', name:'日本語' }, { id:'zh-CN', name:'简体中文' },
  { id:'es', name:'Español' }, { id:'de', name:'Deutsch' }, { id:'fr', name:'Français' },
] as const;
export type Locale = typeof LANGUAGES[number]['id'];
export const isLocale = (value: unknown): value is Locale => LANGUAGES.some(language => language.id === value);
export function browserLocale(language: string): Locale {
  const base = language.toLowerCase().split('-')[0];
  return base === 'zh' ? 'zh-CN' : isLocale(base) ? base : 'en';
}
export function requestLocale(header: string | null): Locale | undefined {
  return header?.split(',').map((part, index) => {
    const [tag, ...parameters] = part.trim().split(';');
    const weight = parameters.find(value => value.trim().startsWith('q='))?.trim().slice(2);
    const quality = weight === undefined ? 1 : Number(weight);
    const base = tag.toLowerCase().split('-')[0];
    const locale = LANGUAGES.find(value => value.id.toLowerCase() === tag.toLowerCase())?.id
      ?? (base === 'zh' ? 'zh-CN' : isLocale(base) ? base : undefined);
    return { locale, quality, index };
  }).filter(value => value.locale && Number.isFinite(value.quality) && value.quality > 0 && value.quality <= 1)
    .sort((a, b) => b.quality - a.quality || a.index - b.index)[0]?.locale;
}
export function cookieLocale(cookie: string | null): Locale | undefined {
  const value = cookie?.split(';').map(part => part.trim()).find(part => part.startsWith('mf-language='))?.slice('mf-language='.length);
  return isLocale(value) ? value : undefined;
}
export function resolveLocale(country: string | undefined, cookie: string | null): Locale {
  const countries: Record<string,Locale> = { KR:'ko', JP:'ja', CN:'zh-CN', SG:'zh-CN', ES:'es', MX:'es', AR:'es', CL:'es', CO:'es', PE:'es', DE:'de', AT:'de', FR:'fr' };
  return cookieLocale(cookie) ?? countries[country ?? ''] ?? 'en';
}
