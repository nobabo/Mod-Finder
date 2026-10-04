import ko from './locales/mods.ko.json';
import tagsKo from './locales/tags.ko.json';
import searchKo from './locales/search.ko.json';
import gameSearchKo from './locales/search.games.ko.json';
import type { Locale } from './locale';
import type { Listing } from './types';
import { translatedModSummary } from './mod-summaries';
import { communityMods } from './community-ranking';
import packNamesKo from './data/community-pack-names.ko.json';
export interface ModTranslation { title?: string; summary?: string; searchTerm: string; aliases: string[]; sourceUrl: string; reviewedAt: string }
export const modTranslations: Record<string, ModTranslation> = ko;
const tagTranslations: Record<string, string> = tagsKo;
const searchTranslations: Record<string, string> = searchKo;
const gameSearchTranslations: Record<string, Record<string, string>> = gameSearchKo;
const packNames: Record<string, string> = packNamesKo;
const normalizedQuery = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
export function tagText(tag: string, locale: Locale) {
  return locale === 'ko' ? tagTranslations[tag] ?? tag : tag;
}
// Presentation overlay only: raw provider data remains unchanged in saved listings.
export function listingText(item: Listing, locale: Locale) {
  const entry = locale === 'ko' ? modTranslations[item.key] : undefined;
  const summary = entry?.summary || (locale === 'ko' ? translatedModSummary(item) : undefined);
  return { title: entry?.title || item.title, summary: summary || item.summary, translated: !!entry || !!summary };
}
export function providerQuery(query: string, prefixes: string[], gameId: string) {
  const q = normalizedQuery(query);
  const localized = Object.entries(modTranslations).filter(([key]) => prefixes.some(prefix => key.startsWith(prefix)));
  const gameTerms = Object.entries(gameSearchTranslations[gameId] ?? {});
  const community = communityMods(gameId);
  // Exact matches win. Only Korean aliases tolerate spacing changes; English
  // queries and longer phrases remain literal. Never run title-counting regexes
  // against search input: those intentionally also match partial mentions.
  for (const compact of /[가-힣]/.test(q) ? [false, true] : [false]) {
    const normalize = (value: string) => compact ? normalizedQuery(value).replace(/\s/g, '') : normalizedQuery(value);
    const matches = (alias: string | undefined) => !!alias && normalize(alias) === normalize(q);
    const tiers = [
      localized.filter(([, entry]) => [entry.title, ...entry.aliases].some(matches)).map(([, entry]) => entry.searchTerm),
      gameTerms.filter(([alias]) => matches(alias)).map(([, term]) => term),
      community.filter(entry => matches(entry.koreanName ?? (gameId === 'minecraft-java' ? packNames[entry.id] : undefined))).map(entry => entry.name),
    ];
    for (const candidates of tiers) {
      const terms = new Set(candidates);
      // An ambiguous alias must not fall through to a less specific dictionary.
      if (terms.size > 1) return query;
      if (terms.size === 1) return [...terms][0];
    }
  }
  return Object.prototype.hasOwnProperty.call(searchTranslations, q) ? searchTranslations[q] : query;
}
