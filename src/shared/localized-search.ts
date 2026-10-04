import { modTranslations, providerQuery } from './content';
import { communityMods } from './community-ranking';
import { communityRanking } from './community-snapshots';
import packNames from './data/community-pack-names.ko.json';

const normalized = (value: string) => value.normalize('NFKC').toLowerCase().replace(/\s+/g, '').trim();
const termKey = (value: string) => value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
export const MAX_LOCALIZED_QUERIES = 8;

// These are search hints, never synthetic results or title-based identity mappings.
export function localizedQueries(query: string, prefixes: string[], gameId: string): string[] {
  const base = providerQuery(query, prefixes, gameId);
  const q = normalized(query);
  if (!/[가-힣]/.test(q) || q.length < 2) return [base];
  const entries = Object.entries(modTranslations)
    .filter(([key]) => prefixes.some(prefix => key.startsWith(prefix)))
    .map(([, entry]) => ({ term: entry.searchTerm, names: [entry.title ?? '', ...entry.aliases], summary: entry.summary ?? '' }));
  const community = new Map(communityMods(gameId).map(entry => [entry.id, entry]));
  for (const entry of communityRanking(gameId)?.entries ?? []) community.set(entry.id, { ...community.get(entry.id), ...entry, pattern: '' });
  for (const entry of community.values()) {
    entries.push({ term: entry.name, names: [entry.koreanName ?? (gameId === 'minecraft-java' ? (packNames as Record<string, string>)[entry.id] : '') ?? ''], summary: '' });
  }
  const exact = entries.filter(entry => entry.names.some(name => normalized(name) === q));
  const partial = entries.filter(entry => entry.names.some(name => normalized(name).includes(q)));
  const descriptions = entries.filter(entry => normalized(entry.summary).includes(q));
  const matches = exact.length ? exact : [...partial, ...descriptions];
  const terms = [...new Map(matches.map(entry => [termKey(entry.term), entry.term])).values()];
  // Keep the ordinary keyword search for broad/partial queries, even when it has results.
  const candidates = exact.length ? terms : [...terms.slice(0, MAX_LOCALIZED_QUERIES - 1), base];
  return [...new Map(candidates.map(term => [termKey(term), term])).values()].slice(0, MAX_LOCALIZED_QUERIES);
}
