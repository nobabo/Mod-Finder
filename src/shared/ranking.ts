import type { Listing, ResultGroup, Sort, VerifiedProjectLink } from './types';
import { modTranslations, providerQuery } from './content';
const normalized = (value: string) => value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
const downloads = (item: Listing) => item.metrics.find(metric => metric.label === (item.source === 'steam' ? '누적 구독자' : '다운로드'))?.value ?? -1;
const representativeOrder = (a: Listing, b: Listing) => downloads(b) - downloads(a) || a.key.localeCompare(b.key);
export function matchPriority(item: Listing, query: string): number {
  const translated = modTranslations[item.key];
  const terms = [...new Set([query, providerQuery(query, [`${item.source}:${item.scope}:`], item.gameId)].map(normalized))].filter(Boolean);
  if (!terms.length) return 3;
  const title = [item.title, translated?.title ?? ''].map(normalized);
  const summary = [item.summary, translated?.summary ?? ''].map(normalized);
  const inTitle = terms.some(term => title.some(text => text.includes(term)));
  const fullDescriptionMatch = item.searchMatch?.description === true && typeof item.searchMatch.query === 'string' && terms.includes(normalized(item.searchMatch.query));
  const inSummary = fullDescriptionMatch || terms.some(term => summary.some(text => text.includes(term)));
  return inTitle && inSummary ? 0 : inTitle ? 1 : inSummary ? 2 : 3;
}
export function orderSearchPage(items: Listing[], query: string, sort: Sort): Listing[] {
  return sort === 'relevance' ? groupResults(items, query).flatMap(group => group.listings) : items;
}
export function groupResults(items: Listing[], query: string, links: VerifiedProjectLink[] = []): ResultGroup[] {
  const parents = new Map<string, string>();
  const root = (key: string): string => {
    const parent = parents.get(key);
    if (!parent || parent === key) return key;
    const result = root(parent); parents.set(key, result); return result;
  };
  for (const link of links) {
    if (!link.evidenceUrl.startsWith('https://') || !link.listingKeys.length) continue;
    for (const key of link.listingKeys.slice(1)) {
      const a = root(link.listingKeys[0]); const b = root(key);
      if (a !== b) parents.set(b, a);
    }
  }
  const groups = new Map<string, ResultGroup>();
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.key)) continue;
    seen.add(item.key);
    // Even a mistaken cross-game mapping must not hide another game's mod.
    const id = `${item.gameId}:${root(item.key)}`;
    const group = groups.get(id) ?? { id, listings: [] };
    group.listings.push(item); groups.set(id, group);
  }
  const q = normalized(query);
  for (const group of groups.values()) group.listings.sort(representativeOrder);
  const priority = (group: ResultGroup) => Math.min(...group.listings.map(item => matchPriority(item, query)));
  const score = (group: ResultGroup) => group.listings.reduce((sum, item) => sum + 1 / (60 + item.rank), 0) + (q && group.listings.some(i => i.title.toLocaleLowerCase() === q) ? 10 : 0);
  return [...groups.values()].sort((a, b) => priority(a) - priority(b) || score(b) - score(a) || a.id.localeCompare(b.id));
}
export function appendStable(current: Listing[], incoming: Listing[]): Listing[] {
  const seen = new Set(current.map(i => i.key));
  return [...current, ...incoming.filter(i => !seen.has(i.key) && !!seen.add(i.key))];
}

export function sortResultGroups(groups: ResultGroup[], sort: Sort, modpacksFirst = false): ResultGroup[] {
  const compare = (a: Listing, b: Listing) => sort === 'downloads'
    ? downloads(b) - downloads(a)
    : sort === 'popular' ? a.rank - b.rank
    : (Date.parse(b.updatedAt ?? '') || 0) - (Date.parse(a.updatedAt ?? '') || 0);
  const packPriority = (item: Listing) => modpacksFirst && item.kind === 'modpack' ? 0 : 1;
  // Pick a source independently of the user's ordering of distinct projects.
  return groups.map(group => ({ ...group, listings: [...group.listings].sort(representativeOrder) }))
    .sort((a, b) => packPriority(a.listings[0]) - packPriority(b.listings[0]) ||
      (sort === 'relevance' ? 0 : compare(a.listings[0], b.listings[0]) || a.id.localeCompare(b.id)));
}
