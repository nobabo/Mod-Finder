import ko from './locales/mods.ko.json';
import tagsKo from './locales/tags.ko.json';
import searchKo from './locales/search.ko.json';
import gameSearchKo from './locales/search.games.ko.json';
import type { Locale } from './locale';
import type { Listing } from './types';
export interface ModTranslation { title?: string; summary?: string; searchTerm: string; aliases: string[]; sourceUrl: string; reviewedAt: string }
export const modTranslations: Record<string, ModTranslation> = ko;
const tagTranslations: Record<string, string> = tagsKo;
const searchTranslations: Record<string, string> = searchKo;
const gameSearchTranslations: Record<string, Record<string, string>> = gameSearchKo;
const normalizedQuery = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
export function tagText(tag: string, locale: Locale) {
  return locale === 'ko' ? tagTranslations[tag] ?? tag : tag;
}
// Presentation overlay only: raw provider data remains unchanged in saved listings.
export function listingText(item: Listing, locale: Locale) {
  const entry = locale === 'ko' ? modTranslations[item.key] : undefined;
  return { title: entry?.title || item.title, summary: entry?.summary || item.summary, translated: !!entry };
}
export function providerQuery(query: string, prefixes: string[], gameId: string) {
  const q = normalizedQuery(query);
  const terms = new Set(Object.entries(modTranslations).filter(([key, value]) => prefixes.some(prefix => key.startsWith(prefix)) && [value.title, ...value.aliases].some(alias => alias && normalizedQuery(alias) === q)).map(([, value]) => value.searchTerm));
  // Ambiguous aliases stay unchanged rather than silently selecting a different mod.
  if (terms.size > 1) return query;
  if (terms.size === 1) return [...terms][0];
  const gameTerms = gameSearchTranslations[gameId];
  if (gameTerms && Object.prototype.hasOwnProperty.call(gameTerms, q)) return gameTerms[q];
  return Object.prototype.hasOwnProperty.call(searchTranslations, q) ? searchTranslations[q] : query;
}
