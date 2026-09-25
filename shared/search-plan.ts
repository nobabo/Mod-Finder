import { gamesInScope } from './games';
import { providerQuery } from './content';
import { SOURCES, type Filters, type SearchRequest, type Sort, type Source } from './types';
export interface SearchSpec { gameId: string; genre?: string; query: string; filters: Filters; sort: Sort; selectedSource: Source | 'all' }
export const bucketKey = (request: Pick<SearchRequest, 'gameId' | 'source'>) => `${request.gameId}:${request.source}`;
export function searchPlan(spec: SearchSpec): SearchRequest[] {
  if (!spec.query.trim()) return [];
  return gamesInScope(spec.gameId, spec.genre).flatMap(game => SOURCES
    .filter(source => game.sources[source] && (spec.selectedSource === 'all' || source === spec.selectedSource))
    .map(source => ({ gameId: game.id, source,
      query: providerQuery(spec.query, [`${source}:${game.sources[source]!.scope}:`], game.id),
      filters: spec.gameId === 'all' ? {} : spec.filters,
      sort: source === 'thunderstore' && spec.sort === 'relevance' ? 'updated' as const : spec.sort })));
}
// A bounded queue keeps global searches from flooding provider or application limits.
export async function runSearchQueue<T>(requests: T[], run: (request: T) => Promise<void>, signal: AbortSignal, concurrency = 4) {
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, requests.length) }, async () => {
    while (!signal.aborted && index < requests.length) await run(requests[index++]);
  }));
}
