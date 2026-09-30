import { locale } from './i18n';
import { isNative } from './platform';
import { withRequestTimeout } from './request';
import { SearchCache } from './search-cache';
import { IndexedDbSearchCacheStore } from './search-cache-store';
import type { Listing, SearchRequest, SearchResult } from '../../shared/types';
const configuredBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
export const API_BASE = (configuredBase || (import.meta.env.DEV ? 'http://127.0.0.1:4318' : isNative() ? '' : window.location.origin)).replace(/\/$/, '');
const thunderstoreOptIn = import.meta.env.VITE_ALLOW_THUNDERSTORE_PERSISTENCE === 'true';
const searchCache = new SearchCache(new IndexedDbSearchCacheStore(thunderstoreOptIn), thunderstoreOptIn);
export async function minecraftVersions(signal: AbortSignal): Promise<string[]> {
  if (!API_BASE) throw new Error('server_not_configured');
  return withRequestTimeout(async requestSignal => {
    const response = await fetch(`${API_BASE}/v1/minecraft/versions`, { signal: requestSignal, credentials: 'same-origin' });
    if (!response.ok) throw new Error('versions_unavailable');
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object' || !('versions' in data) || !Array.isArray(data.versions)) throw new Error('invalid_versions');
    return data.versions.filter((version): version is string => typeof version === 'string');
  }, signal);
}
export async function searchSource(request: SearchRequest, signal: AbortSignal): Promise<SearchResult> {
  if (!API_BASE) throw new Error('server_not_configured');
  const params = new URLSearchParams({ gameId: request.gameId, source: request.source, query: request.query, sort: request.sort, ...request.filters });
  if (request.cursor) params.set('cursor', request.cursor);
  return searchCache.search(request, { endpoint: API_BASE, locale }, sharedSignal => withRequestTimeout(async requestSignal => {
    const response = await fetch(`${API_BASE}/v1/search?${params}`, { signal: requestSignal, credentials: 'same-origin', headers: { 'Accept-Language': locale } });
    if (!response.ok) throw new Error('search_failed');
    return response.json() as Promise<SearchResult>;
  }, sharedSignal), signal);
}

export async function favoriteDetails(item: Listing): Promise<Listing> {
  if (!API_BASE) throw new Error('server_not_configured');
  return withRequestTimeout(async signal => {
    const response = await fetch(API_BASE + '/v1/listings/' + [item.source, item.scope, item.id].map(encodeURIComponent).join('/'), { signal, credentials: 'same-origin', headers: { 'Accept-Language': locale } });
    if (!response.ok) throw new Error('listing_unavailable');
    const result = await response.json() as { listing: Listing }; return result.listing;
  });
}
