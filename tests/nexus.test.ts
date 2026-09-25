import { expect, it, vi } from 'vitest';
import { createApi } from '../server/api';
import { cursorFor } from '../server/adapters';
import { readConfig } from '../server/config';
import { UpstreamClient } from '../server/http';
import type { SearchRequest, SearchResult } from '../shared/types';
const req: SearchRequest = { source: 'nexus', gameId: 'stardew-valley', query: 'SMAPI', sort: 'relevance', filters: {} };
const node = { modId: 2400, name: 'SMAPI', author: 'Author', summary: 'A mod', description: 'A mod description', thumbnailUrl: null, updatedAt: '2026-09-25T00:00:00Z', downloads: 123, category: 'Utilities', game: { domainName: 'stardewvalley' } };
const payload = (nodes = [node], totalCount = 32) => ({ data: { mods: { nodes, totalCount } } });
const path = (r = req) => new Request(`http://localhost/v1/search?${new URLSearchParams({ gameId: r.gameId, source: r.source, query: r.query, sort: r.sort, ...r.filters, ...(r.cursor ? { cursor: r.cursor } : {}) })}`);
function setup(body: unknown = payload(), status = 200, disabled = '') {
  const fetcher = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => Response.json(body, { status, headers: { 'Retry-After': '90' } }));
  const api = createApi(readConfig({ DISABLED_SOURCES: disabled, NEXUS_API_KEY: 'unused-personal-key' }), new UpstreamClient('Test', fetcher));
  return { api, fetcher };
}
it('serves Nexus through the common API without credentials and preserves unknown fields', async () => {
  const { api, fetcher } = setup();
  const response = await api(path()); const result = await response.json() as SearchResult;
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(result).toMatchObject({ status: 'success', total: 32, cached: false, items: [{ id: '2400', key: 'nexus:stardewvalley:2400', versions: null, loaders: null }] });
  const [url, options] = fetcher.mock.calls[0];
  expect(url).toBe('https://api.nexusmods.com/v2/graphql');
  expect(options?.credentials).toBe('omit');
  expect(JSON.stringify(options)).not.toContain('unused-personal-key');
  expect(new Headers(options?.headers).has('apikey')).toBe(false);
  expect(JSON.parse(String(options?.body)).variables).toMatchObject({ filter: { op:'AND',filter:[{gameDomainName:[{value:'stardewvalley',op:'EQUALS'}]},{op:'OR',filter:[{nameStemmed:[{value:'SMAPI',op:'MATCHES'}]},{description:[{value:'SMAPI',op:'MATCHES'}]}]}] }, count: 20 });
  await api(path({ ...req, cursor: result.nextCursor! }));
  expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body)).variables.offset).toBe(1);
  expect((await api(path({ ...req, query: 'other', cursor: result.nextCursor! }))).status).toBe(400);
  expect((await api(path({ ...req, cursor: cursorFor(req, 10001) }))).status).toBe(400);
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it('retrieves body-only matches while keeping the full body off the client', async () => {
  const { api } = setup(payload([{...node,name:'Portraits',summary:'New portraits',description:'<p>Requires SMAPI to load.</p>'}]));
  const result = await (await api(path())).json() as SearchResult;
  expect(result.items[0]).toMatchObject({title:'Portraits',summary:'New portraits',searchMatch:{query:'SMAPI',description:true}});
  expect(result.items[0]).not.toHaveProperty('description');
});
it('rejects cross-game data, partial GraphQL errors, oversized pages and lossy IDs', async () => {
  for (const body of [payload([{ ...node, game: { domainName: 'rimworld' } }]), { ...payload(), errors: [{ message: 'private upstream error' }] }, payload(Array.from({ length: 21 }, () => node)), payload([{ ...node, modId: Number.MAX_SAFE_INTEGER + 1 }])]) {
    const { api } = setup(body); const result = await (await api(path())).json();
    expect(result).toMatchObject({ status: 'error', items: [], nextCursor: null });
    expect(JSON.stringify(result)).not.toContain('private upstream error');
  }
});
it('reports empty results, unsupported filters and retry backoff', async () => {
  const { api } = setup(payload([], 0));
  expect(await (await api(path({ ...req, filters: { loader: 'fabric' } }))).json()).toMatchObject({ status: 'empty', total: 0, nextCursor: null, appliedFilters: {}, unsupportedFilters: ['loader'] });
  const limited = setup({}, 429);
  for (let i = 0; i < 2; i++) expect(await (await limited.api(path())).json()).toMatchObject({ status: 'rate_limited', retryAfter: 90 });
  expect(limited.fetcher).toHaveBeenCalledOnce();
});
it('respects unsupported games and the operator disable switch', async () => {
  const { api, fetcher } = setup();
  expect(await (await api(path({ ...req, gameId: 'minecraft-java' }))).json()).toMatchObject({ status: 'unsupported' });
  expect(fetcher).not.toHaveBeenCalled();
  const disabled = setup({}, 200, 'nexus');
  expect(await (await disabled.api(path())).json()).toMatchObject({ status: 'disabled' });
  expect(disabled.fetcher).not.toHaveBeenCalled();
});
it.each([['relevance', 'relevance'], ['popular', 'downloads'], ['updated', 'updatedAt']] as const)('forwards %s sorting', async (sort, field) => {
  const { api, fetcher } = setup(); await api(path({ ...req, sort }));
  expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body)).variables.sort).toEqual([{ [field]: { direction: 'DESC' } }, { name: { direction: 'ASC' } }, { createdAt: { direction: 'ASC' } }]);
});

