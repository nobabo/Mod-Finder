import { readFileSync } from 'node:fs';
import { GAMES } from '../../src/shared/games';
import { listingText, modTranslations, tagText } from '../../src/shared/content';
import { registerModSummaries, withReviewedSummaries, type SummaryTranslation } from '../../src/shared/mod-summaries';
import { downloadRanking } from '../../src/web/lib/rankings';
import type { SearchRequest, SearchResult } from '../../src/shared/types';
import reviewed from '../../src/shared/locales/reviewed-mod-summaries.ko.json';

// Use the UI's live ranking rules. Do not persist provider responses or enable caches.
const endpoint = 'https://modfinder.pages.dev';
const reviewedSummaries = reviewed as unknown as Record<string, SummaryTranslation[]>;
const requestedGame = process.argv.find(arg => arg.startsWith('--game='))?.slice(7);
const details = process.argv.includes('--details');
async function search(request: SearchRequest, signal: AbortSignal): Promise<SearchResult> {
  const params = new URLSearchParams({ gameId: request.gameId, source: request.source, query: request.query, sort: request.sort, ...request.filters });
  if (request.cursor) params.set('cursor', request.cursor);
  const response = await fetch(`${endpoint}/v1/search?${params}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(45000)]) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<SearchResult>;
}

for (const game of GAMES.filter(game => !requestedGame || game.id === requestedGame)) {
  const rows = JSON.parse(readFileSync(`src/shared/locales/mod-summaries/${game.id}.json`, 'utf8')) as SummaryTranslation[];
  registerModSummaries(game.id, withReviewedSummaries(rows, reviewedSummaries[game.id] ?? []));
  const ranking = await downloadRanking(game.id, new AbortController().signal, search);
  const missingTitles = [];
  const missingSummaries = [];
  const missingTags = new Set<string>();
  let emptySummaries = 0;
  for (const [index, group] of ranking.items.entries()) {
    for (const item of group.listings) {
      const text = listingText(item, 'ko');
      if (!/[가-힣]/.test(text.title)) missingTitles.push({ rank: index + 1, key: item.key, title: item.title, localized: modTranslations[item.key]?.title, url: item.url });
      if (!item.summary.trim()) emptySummaries++;
      else if (!/[가-힣]/.test(text.summary)) missingSummaries.push({ rank: index + 1, key: item.key, title: item.title, ...(details ? { summary: item.summary } : {}) });
      for (const tag of (item.loaders?.length ? item.loaders : item.tags).slice(0, 3)) {
        if (/[a-z]/i.test(tag) && tagText(tag, 'ko') === tag) missingTags.add(tag);
      }
    }
  }
  console.log(JSON.stringify({ gameId: game.id, checkedAt: new Date().toISOString(), rankedItems: ranking.items.length,
    failedSources: ranking.failedSources, missingTitles, missingSummaries, emptySummaries, missingTags: [...missingTags] }));
  if (ranking.status === 'error' || ranking.failedSources.length || ranking.items.length !== 30 || missingTitles.length || missingSummaries.length || missingTags.size) process.exitCode = 1;
}
