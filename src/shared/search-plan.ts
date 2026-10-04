import { gamesInScope } from './games';
import { getCategory } from './categories';
import { numberQueries } from './search-number-variants';
import { localizedQueries } from './localized-search';
import { SOURCES, type Filters, type SearchRequest, type Sort, type Source } from './types';
export interface SearchSpec { gameId: string; genre?: string; query: string; filters: Filters; categories?: string[]; sort: Sort; selectedSource: Source | 'all' }
export const sourceBucketKey = (request: Pick<SearchRequest, 'gameId' | 'source'> & { filters?: Filters }) => `${request.gameId}:${request.source}${request.filters?.category ? `:${request.filters.category}` : ''}`;
export const bucketKey = (request: Pick<SearchRequest, 'gameId' | 'source' | 'query'> & { filters?: Filters }) => JSON.stringify([sourceBucketKey(request), request.query]);
export function searchPlan(spec: SearchSpec): SearchRequest[] {
  if (spec.categories?.length) {
    return [...new Set(spec.categories)].flatMap(category => searchPlan({ ...spec, categories: undefined, filters: { ...spec.filters, category } }));
  }
  const category = getCategory(spec.gameId, spec.filters.category);
  if (spec.gameId !== 'all' && spec.filters.category && !category) return [];
  return gamesInScope(spec.gameId, spec.genre).flatMap(game => SOURCES
    .filter(source => game.sources[source] && (spec.selectedSource === 'all' || source === spec.selectedSource))
    .filter(source => !category || category.source === source)
    .flatMap(source => [...new Set(localizedQueries(spec.query, [`${source}:${game.sources[source]!.scope}:`], game.id).flatMap(numberQueries))].map(query => ({ gameId: game.id, source,
      query,
      filters: spec.gameId === 'all' ? {} : spec.filters,
      sort: source === 'thunderstore' && spec.sort === 'relevance' ? 'updated' as const : spec.sort }))));
}
// A bounded queue keeps global searches from flooding provider or application limits.
export async function runSearchQueue<T>(requests: T[], run: (request: T) => Promise<void>, signal: AbortSignal, concurrency = 4) {
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, requests.length) }, async () => {
    while (!signal.aborted && index < requests.length) await run(requests[index++]);
  }));
}
