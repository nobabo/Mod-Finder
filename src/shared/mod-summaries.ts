import type { Listing } from './types';

// Match the original content as well as the game/title; never infer a mod ID from its name.
export type SummaryTranslation = [title: string, original: string, korean: string, listingKey: string | null];
const catalogs = new Map<string, Map<string, SummaryTranslation[]>>();
const contentKey = (title: string, summary: string) => JSON.stringify([title.trim(), summary.trim()]);

export function registerModSummaries(gameId: string, rows: SummaryTranslation[]) {
  const index = new Map<string, SummaryTranslation[]>();
  for (const row of rows) {
    const key = contentKey(row[0], row[1]);
    const matches = index.get(key) ?? [];
    matches.push(row); index.set(key, matches);
  }
  catalogs.set(gameId, index);
}

export function translatedModSummary(item: Pick<Listing, 'gameId' | 'title' | 'summary' | 'key'>): string | undefined {
  if (!item.summary.trim()) return undefined;
  const matches = catalogs.get(item.gameId)?.get(contentKey(item.title, item.summary)) ?? [];
  const translations = new Set(matches.filter(row => !row[3] || row[3] === item.key).map(row => row[2]));
  return translations.size === 1 ? [...translations][0] : undefined;
}
