import type { Listing } from './types';
import { catalogModTitle } from './mod-titles';

// Match the original content as well as the game/title; never infer a mod ID from its name.
export type SummaryTranslation = [title: string, original: string, korean: string, listingKey: string | null, koreanTitle?: string];
const catalogs = new Map<string, Map<string, SummaryTranslation[]>>();
const titleCatalogs = new Map<string, Map<string, SummaryTranslation[]>>();
// Apply the same bounded markup stripping as the adapters, then ignore layout whitespace.
const summaryKey = (summary: string) => summary.slice(0, 1800).replace(/<[^>]*>/g, '').replace(/\[\/?[a-z][^\]]*\]/gi, '').replace(/\s+/g, ' ').trim();
const contentKey = (title: string, summary: string) => JSON.stringify([title.trim(), summaryKey(summary)]);
const titleKey = (key: string, title: string) => JSON.stringify([key, title.trim()]);

export function withReviewedSummaries(rows: SummaryTranslation[], reviewed: SummaryTranslation[]): SummaryTranslation[] {
  const reviewedKeys = new Set(reviewed.map(row => JSON.stringify([contentKey(row[0], row[1]), row[3]])));
  const originalTitles = new Map<string, Set<string>>();
  for (const row of rows) if (row[4]) {
    const key = JSON.stringify([contentKey(row[0], row[1]), row[3]]);
    const titles = originalTitles.get(key) ?? new Set<string>();
    titles.add(row[4]); originalTitles.set(key, titles);
  }
  return [...rows.filter(row => !reviewedKeys.has(JSON.stringify([contentKey(row[0], row[1]), row[3]]))), ...reviewed.map(row => {
    const titles = originalTitles.get(JSON.stringify([contentKey(row[0], row[1]), row[3]]));
    const title = row[4] ?? (titles?.size === 1 ? [...titles][0] : undefined);
    return title ? [row[0], row[1], row[2], row[3], title] as SummaryTranslation : row;
  })];
}

export function registerModSummaries(gameId: string, rows: SummaryTranslation[]) {
  const index = new Map<string, SummaryTranslation[]>();
  const titles = new Map<string, SummaryTranslation[]>();
  for (const row of rows) {
    const key = contentKey(row[0], row[1]);
    const matches = index.get(key) ?? [];
    matches.push(row); index.set(key, matches);
    if (row[3] && row[4]?.trim()) {
      const key = titleKey(row[3], row[0]);
      const matches = titles.get(key) ?? [];
      matches.push(row); titles.set(key, matches);
    }
  }
  catalogs.set(gameId, index);
  titleCatalogs.set(gameId, titles);
}

export function translatedModTitle(item: Pick<Listing, 'gameId' | 'title' | 'summary' | 'key'>): string | undefined {
  const exact = titleCatalogs.get(item.gameId)?.get(titleKey(item.key, item.title)) ?? [];
  if (!exact.length) {
    const scoped = catalogModTitle(item.gameId, item.key, item.title);
    if (scoped) return scoped;
  }
  // Legacy rows have no source identity, so retain the stricter description
  // match instead of applying a translation based on a shared title alone.
  const matches = exact.length ? exact : (catalogs.get(item.gameId)?.get(contentKey(item.title, item.summary)) ?? []).filter(row => !row[3]);
  const translations = new Set(matches.map(row => row[4]?.trim()).filter((title): title is string => !!title));
  return translations.size === 1 ? [...translations][0] : undefined;
}

export function translatedModSummary(item: Pick<Listing, 'gameId' | 'title' | 'summary' | 'key'>): string | undefined {
  if (!item.summary.trim()) return undefined;
  const matches = catalogs.get(item.gameId)?.get(contentKey(item.title, item.summary)) ?? [];
  const exact = matches.filter(row => row[3] === item.key);
  const translations = new Set((exact.length ? exact : matches.filter(row => !row[3])).map(row => row[2]));
  return translations.size === 1 ? [...translations][0] : undefined;
}
