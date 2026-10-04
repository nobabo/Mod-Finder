import { GAMES } from '../../src/shared/games';
import { communityRanking } from '../../src/shared/community-snapshots';
import { modTranslations, providerQuery } from '../../src/shared/content';
import { downloadRanking } from '../../src/web/lib/rankings';
import type { SearchRequest, SearchResult } from '../../src/shared/types';
import packNamesKo from '../../src/shared/data/community-pack-names.ko.json';

// Read rankings using the same source/page/metric rules as the UI. Keep provider
// responses in memory only, including Thunderstore when persistence is disabled.
const endpoint = 'https://modfinder.pages.dev';
async function search(request: SearchRequest, signal: AbortSignal): Promise<SearchResult> {
  const params = new URLSearchParams({ gameId: request.gameId, source: request.source, query: request.query, sort: request.sort, ...request.filters });
  if (request.cursor) params.set('cursor', request.cursor);
  const response = await fetch(`${endpoint}/v1/search?${params}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(45000)]) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<SearchResult>;
}

for (const game of GAMES) {
  const community = communityRanking(game.id);
  const unresolvedCommunity = (community?.entries ?? []).filter(entry => {
    const name = entry.koreanName ?? (game.id === 'minecraft-java' ? (packNamesKo as Record<string, string>)[entry.id] : undefined);
    return name && name !== entry.name && Object.entries(game.sources).some(([source, mapping]) => providerQuery(name, [`${source}:${mapping.scope}:`], game.id) === name);
  });
  const ranking = await downloadRanking(game.id, new AbortController().signal, search);
  const listings = ranking.items.flatMap(group => group.listings);
  const missing = listings.filter(item => !modTranslations[item.key]);
  console.log(JSON.stringify({ gameId: game.id, checkedAt: new Date().toISOString(), communityFetchedAt: community?.fetchedAt,
    communityEntries: community?.entries.length ?? 0, unresolvedCommunity: unresolvedCommunity.map(entry => entry.id),
    rankedItems: ranking.items.length, failedSources: ranking.failedSources,
    missingTranslations: missing.map(item => ({ key: item.key, title: item.title })) }));
  if (ranking.status === 'error' || ranking.failedSources.length) process.exitCode = 1;
}
