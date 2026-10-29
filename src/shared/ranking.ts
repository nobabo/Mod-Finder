import type { Listing, ResultGroup, Sort, SortDirection, VerifiedProjectLink } from './types';
import { numberQueries } from './search-number-variants';
import { listingText } from './content';
import { localizedQueries } from './localized-search';
const normalized = (value: string) => value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
const downloads = (item: Listing) => item.metrics.find(metric => metric.label === (item.source === 'steam' ? '누적 구독자' : '다운로드'))?.value ?? -1;
const representativeOrder = (a: Listing, b: Listing) => downloads(b) - downloads(a) || a.key.localeCompare(b.key);
export function matchPriority(item: Listing, query: string): number {
  return priorityWithTerms(item, matchingTerms(item, query));
}
function matchingTerms(item: Pick<Listing, 'source' | 'scope' | 'gameId'>, query: string): string[] {
  return [...new Set([query, ...localizedQueries(query, [`${item.source}:${item.scope}:`], item.gameId)].flatMap(numberQueries).map(normalized))].filter(Boolean);
}
function priorityWithTerms(item: Listing, terms: string[]): number {
  if (!terms.length) return 3;
  const translated = listingText(item, 'ko');
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
  // Resolve large title alias catalogs once per game/provider in this result
  // set. The cache is local so later dictionary updates cannot become stale.
  const terms = new Map<string, string[]>();
  const priority = (item: Listing) => {
    const key = JSON.stringify([item.gameId, item.source, item.scope]);
    let candidates = terms.get(key);
    if (!candidates) { candidates = matchingTerms(item, query); terms.set(key, candidates); }
    return priorityWithTerms(item, candidates);
  };
  const priorities = new Map([...groups.values()].map(group => [group.id, Math.min(...group.listings.map(priority))]));
  const score = (group: ResultGroup) => group.listings.reduce((sum, item) => sum + 1 / (60 + item.rank), 0) + (q && group.listings.some(i => i.title.toLocaleLowerCase() === q) ? 10 : 0);
  return [...groups.values()].sort((a, b) => priorities.get(a.id)! - priorities.get(b.id)! || score(b) - score(a) || a.id.localeCompare(b.id));
}
export function appendStable(current: Listing[], incoming: Listing[]): Listing[] {
  const incomingByKey = new Map(incoming.map(item => [item.key, item]));
  const seen = new Set(current.map(i => i.key));
  return [...current.map(item => {
    const next = incomingByKey.get(item.key);
    return next?.matchedCategories?.length ? { ...item, matchedCategories: [...new Set([...(item.matchedCategories ?? []), ...next.matchedCategories])] } : item;
  }), ...incoming.filter(i => !seen.has(i.key) && !!seen.add(i.key))];
}

export function prioritizeCategories(groups: ResultGroup[], categories: string[] = []): ResultGroup[] {
  if (!categories.length) return groups;
  const selected = new Set(categories);
  const score = (group: ResultGroup) => Math.max(...group.listings.map(item => new Set(item.matchedCategories?.filter(id => selected.has(id))).size));
  return [...groups].sort((a, b) => score(b) - score(a));
}

export function sortResultGroups(groups: ResultGroup[], sort: Sort, modpacksFirst = false, direction: SortDirection = 'desc'): ResultGroup[] {
  const value = (item: Listing) => sort === 'downloads' ? downloads(item) : sort === 'popular' ? -item.rank : Date.parse(item.updatedAt ?? '');
  const compare = (a: Listing, b: Listing) => {
    const av = value(a), bv = value(b);
    const missingA = !Number.isFinite(av) || (sort === 'downloads' && av < 0);
    const missingB = !Number.isFinite(bv) || (sort === 'downloads' && bv < 0);
    // Missing metrics stay last in either direction; null never becomes zero.
    return missingA || missingB ? Number(missingA) - Number(missingB) : (av - bv) * (direction === 'asc' ? 1 : -1);
  };
  const packPriority = (item: Listing) => modpacksFirst && item.kind === 'modpack' ? 0 : 1;
  // Pick a source independently of the user's ordering of distinct projects.
  const ordered = sort === 'relevance' && direction === 'asc' ? [...groups].reverse() : groups;
  return ordered.map(group => ({ ...group, listings: [...group.listings].sort(representativeOrder) }))
    .sort((a, b) => packPriority(a.listings[0]) - packPriority(b.listings[0]) ||
      (sort === 'relevance' ? 0 : compare(a.listings[0], b.listings[0]) || a.id.localeCompare(b.id)));
}
