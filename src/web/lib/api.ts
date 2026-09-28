import { locale } from './i18n';
import { isNative } from './platform';
import { withRequestTimeout } from './request';
import type { SearchRequest, SearchResult } from '../../shared/types';
const configuredBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
export const API_BASE = (configuredBase || (import.meta.env.DEV ? 'http://127.0.0.1:4318' : isNative() ? '' : window.location.origin)).replace(/\/$/, '');
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
  return withRequestTimeout(async requestSignal => {
    const response = await fetch(`${API_BASE}/v1/search?${params}`, { signal: requestSignal, credentials: 'same-origin', headers: { 'Accept-Language': locale } });
    if (!response.ok) throw new Error('search_failed');
    return response.json() as Promise<SearchResult>;
  }, signal);
}
