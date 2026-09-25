import { describe, expect, it, vi } from 'vitest';
import { createApi } from '../server/api';
import { cursorFor, mapThunderstore } from '../server/adapters';
import { readConfig } from '../server/config';
import { UpstreamClient } from '../server/http';
import { getGame } from '../shared/games';
import { orderSearchPage } from '../shared/ranking';
import { searchPlan } from '../shared/search-plan';
import type { Capability, SearchRequest, SearchResult } from '../shared/types';

const game = getGame('lethal-company')!;
const request: SearchRequest = { gameId: game.id, source: 'thunderstore', query: 'MoreCompany', sort: 'popular', filters: {} };
const hit = (name = 'MoreCompany') => ({ namespace: 'notnotnotswipez', name, community_identifier: 'lethal-company', description: 'A lobby expansion', categories: [{ name: 'Mods', slug: 'mods' }], download_count: 42 });
const path = (req: SearchRequest = request) => new Request(`http://localhost/v1/search?${new URLSearchParams({ gameId: req.gameId, source: req.source, query: req.query, sort: req.sort, ...req.filters, ...(req.cursor ? { cursor: req.cursor } : {}) })}`);
function setup(body: unknown, status = 200, disabled = '') {
  const fetcher = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => Response.json(body, { status, headers: { 'Retry-After': '90' } }));
  const api = createApi(readConfig({ DISABLED_SOURCES: disabled }), new UpstreamClient('Test', fetcher));
  return { fetcher, api };
}
describe('Thunderstore live-search contract', () => {
  it('normalizes anonymous results, preserves identity and reports unsupported filters', async () => {
    const { api, fetcher } = setup({ count: 1, next: null, results: [hit()] });
    const response = await api(path({ ...request, filters: { version: '1.2', loader: 'forge' } }));
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ status: 'success', total: 1, cached: false, appliedFilters: {}, unsupportedFilters: ['version', 'loader'], items: [{ key: 'thunderstore:lethal-company:notnotnotswipez-MoreCompany', id: 'notnotnotswipez-MoreCompany', author: 'notnotnotswipez', versions: null, loaders: null, kind: 'mod', metrics: [{ value: 42 }], url: 'https://thunderstore.io/c/lethal-company/p/notnotnotswipez/MoreCompany/' }] });
    const [rawUrl, init] = fetcher.mock.calls[0]; const url = new URL(String(rawUrl));
    expect(url.origin + url.pathname).toBe('https://thunderstore.io/api/cyberstorm/listing/lethal-company/');
    expect(Object.fromEntries(url.searchParams)).toEqual({ q: 'MoreCompany', page: '1', ordering: 'most-downloaded', deprecated: 'false', nsfw: 'false' });
    expect(new Headers(init?.headers).has('Authorization')).toBe(false);
    await api(path()); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('reconstructs bound page cursors without following upstream next URLs', async () => {
    const { api, fetcher } = setup({ count: 50, next: 'https://untrusted.example/', results: Array.from({ length: 20 }, (_, i) => hit(`Item${i}`)) });
    const first = await (await api(path())).json() as SearchResult;
    expect(first.nextCursor).toBeTruthy();
    const second = await (await api(path({ ...request, cursor: first.nextCursor! }))).json() as SearchResult;
    expect(new URL(String(fetcher.mock.calls[1][0])).searchParams.get('page')).toBe('2');
    expect(second.items[0].rank).toBe(21);
    expect((await api(path({ ...request, query: 'other', cursor: first.nextCursor! }))).status).toBe(400);
    for (const page of [0, 5001]) expect((await api(path({ ...request, cursor: cursorFor(request, page) }))).status).toBe(400);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('distinguishes no results from malformed, oversized and wrong-game responses', async () => {
    const empty = setup({ count: 0, next: null, results: [] });
    expect(await (await empty.api(path())).json()).toMatchObject({ status: 'empty', total: 0, nextCursor: null });
    for (const results of [[{ ...hit(), community_identifier: 'valheim' }], [{ ...hit(), namespace: '../escape' }], [null], Array.from({ length: 21 }, () => hit())]) {
      const { api } = setup({ count: results.length, next: null, results });
      expect(await (await api(path())).json()).toMatchObject({ status: 'error', items: [], nextCursor: null });
    }
    expect(mapThunderstore({ ...hit(), download_count: null }, game, 1).metrics).toEqual([]);
  });
  it('supports disabling, unsupported games, and rate-limit backoff', async () => {
    const disabled = setup({}, 200, 'thunderstore');
    expect(await (await disabled.api(path())).json()).toMatchObject({ status: 'disabled', items: [] });
    expect(disabled.fetcher).not.toHaveBeenCalled();
    const { api, fetcher } = setup({}, 429);
    expect(await (await api(path({ ...request, gameId: 'minecraft-java' }))).json()).toMatchObject({ status: 'unsupported' });
    for (let i = 0; i < 2; i++) expect(await (await api(path())).json()).toMatchObject({ status: 'rate_limited', retryAfter: 90 });
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('includes Thunderstore in combined search and preserves explicit upstream ordering', async () => {
    const plan = searchPlan({ gameId: game.id, query: 'MoreCompany', filters: {}, selectedSource: 'all', sort: 'relevance' });
    expect(plan).toContainEqual({ ...request, sort: 'updated' });
    const first = mapThunderstore(hit('AnotherMod'), game, 1); const exact = mapThunderstore(hit(), game, 2);
    expect(orderSearchPage([first, exact], 'MoreCompany', 'popular')).toEqual([first, exact]);
    expect(orderSearchPage([first, exact], 'MoreCompany', 'updated')).toEqual([first, exact]);
    expect(orderSearchPage([first, exact], 'MoreCompany', 'relevance')).toEqual([exact, first]);
    const { api } = setup({ count: 1, next: null, results: [hit()] });
    const caps = await (await api(new Request('http://localhost/v1/games/lethal-company/sources'))).json() as { sources: Capability[] };
    expect(caps.sources.find((s: { source: string }) => s.source === 'thunderstore')).toMatchObject({ status: 'ready', sorts: ['downloads', 'popular', 'updated'] });
  });
});
