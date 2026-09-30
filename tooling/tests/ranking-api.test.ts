import { afterEach, expect, it, vi } from 'vitest';
import { searchSource } from '../../src/web/lib/api';
import type { SearchRequest, SearchResult } from '../../src/shared/types';

vi.mock('../../src/web/lib/i18n', () => ({ locale: 'ko' }));
afterEach(() => vi.unstubAllGlobals());

it('refreshes API rankings even while an ordinary search page remains cached', async () => {
  const request: SearchRequest = { gameId: 'stardew-valley', source: 'nexus', query: '', filters: {}, sort: 'downloads' };
  const result: SearchResult = { source: 'nexus', status: 'empty', items: [], nextCursor: null, total: 0,
    fetchedAt: new Date().toISOString(), cached: false, appliedFilters: {}, unsupportedFilters: [], externalUrl: null, queryForwarded: false, message: '' };
  const fetcher = vi.fn(async () => Response.json(result));
  vi.stubGlobal('fetch', fetcher);
  const signal = new AbortController().signal;
  await searchSource(request, signal);
  await searchSource(request, signal);
  expect(fetcher).toHaveBeenCalledTimes(1);
  await searchSource(request, signal, true);
  expect(fetcher).toHaveBeenCalledTimes(2);
});
