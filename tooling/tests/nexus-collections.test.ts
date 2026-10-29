import { expect, it, vi } from 'vitest';
import { createApi } from '../../src/server/api';
import { readConfig } from '../../src/server/config';
import { UpstreamClient } from '../../src/server/http';
import { searchPlan } from '../../src/shared/search-plan';
import { groupCategories } from '../../src/shared/category-groups';
import { categoriesForGame } from '../../src/shared/categories';
import { registerModSummaries, translatedModSummary } from '../../src/shared/mod-summaries';
import type { SearchResult } from '../../src/shared/types';

const node = { slug: 'tckf0m', name: 'Stardew Valley VERY Expanded', summary: 'A collection of mods.', totalDownloads: 123, updatedAt: null, game: { domainName: 'stardewvalley' }, user: { name: 'Curator' }, tileImage: null };
const payload = (nodes = [node], totalCount = 21) => ({ data: { collectionsV2: { nodes, totalCount } } });
function setup(body: unknown = payload()) {
  const fetcher = vi.fn(async () => Response.json(body));
  const api = createApi(readConfig({ NEXUS_API_KEY: 'unused' }), new UpstreamClient('Test', fetcher));
  return { api, fetcher };
}
const search = (extra: Record<string, string> = {}) => new Request('https://local/v1/search?' + new URLSearchParams(Object.fromEntries(Object.entries({ gameId: 'stardew-valley', source: 'nexus', category: 'nexus:collections', query: 'expanded', sort: 'downloads', ...extra }).filter(([, value]) => value))));

it('routes the visible modpack category to real Nexus collections and preserves source identity', async () => {
  const plan = searchPlan({ gameId: 'stardew-valley', query: 'expanded', sort: 'downloads', selectedSource: 'all', filters: { category: 'nexus:collections' } });
  expect(groupCategories(categoriesForGame('stardew-valley')).find(group => group.id === 'content')?.categories.some(category => category.id === 'nexus:collections')).toBe(true);
  expect(plan).toHaveLength(1); expect(plan[0].source).toBe('nexus');
  const { api, fetcher } = setup();
  const result = await (await api(search())).json() as SearchResult;
  expect(result).toMatchObject({ status: 'success', total: 21, appliedFilters: { category: 'nexus:collections' }, items: [{ key: 'nexus:stardewvalley:collection-tckf0m', id: 'collection-tckf0m', kind: 'modpack', author: 'Curator', url: 'https://www.nexusmods.com/games/stardewvalley/collections/tckf0m', versions: null, loaders: null, updatedAt: null }] });
  const options = fetcher.mock.calls[0] as unknown as [string, RequestInit];
  const request = JSON.parse(String(options[1].body));
  expect(request.query).toContain('collectionsV2');
  expect(request.variables).toMatchObject({ filter: { gameDomain: [{ value: 'stardewvalley', op: 'EQUALS' }], generalSearch: [{ value: 'expanded', op: 'WILDCARD' }] }, offset: 0, count: 20 });
  expect(JSON.stringify(options[1])).not.toContain('unused');
  registerModSummaries('stardew-valley', [[node.name, node.summary, '모드 모음입니다.', 'nexus:stardewvalley:collection-tckf0m']]);
  expect(translatedModSummary(result.items[0])).toBe('모드 모음입니다.');
  expect(translatedModSummary({ ...result.items[0], key: 'nexus:stardewvalley:tckf0m' })).toBeUndefined();
  expect((await api(search({ category: 'nexus:Crops', cursor: result.nextCursor! }))).status).toBe(400);
  await api(search({ cursor: result.nextCursor! }));
  const next = fetcher.mock.calls[1] as unknown as [string, RequestInit];
  expect(JSON.parse(String(next[1].body)).variables.offset).toBe(1);
});

it('supports explicit modpack requests, single-character searches and unknown metrics', async () => {
  const { api, fetcher } = setup(payload([{ ...node, totalDownloads: null as unknown as number }], 1));
  const result = await (await api(search({ category: '', kind: 'modpack', query: 'a' }))).json() as SearchResult;
  expect(result.items[0].metrics).toEqual([]); expect(result.appliedFilters.kind).toBe('modpack');
  const options = fetcher.mock.calls[0] as unknown as [string, RequestInit];
  expect(JSON.parse(String(options[1].body)).variables.filter.generalSearch[0]).toEqual({ value: 'a', op: 'EQUALS' });
});

it('rejects cross-game collections and partial GraphQL errors', async () => {
  for (const body of [payload([{ ...node, game: { domainName: 'skyrimspecialedition' } }]), { ...payload(), errors: [{ message: 'private' }] }, payload(Array.from({ length: 21 }, () => node))]) {
    const { api } = setup(body);
    expect(await (await api(search())).json()).toMatchObject({ status: 'error', items: [], nextCursor: null });
  }
});

it('rejects contradictory mod and collection filters before requesting the provider', async () => {
  const { api, fetcher } = setup();
  expect((await api(search({ kind: 'mod' }))).status).toBe(400);
  expect((await api(search({ kind: 'modpack', category: 'nexus:Crops' }))).status).toBe(400);
  expect(fetcher).not.toHaveBeenCalled();
});

it('resolves collection details separately from mods and validates the returned slug', async () => {
  const { api } = setup({ data: { collection: node } });
  const response = await api(new Request('https://local/v1/listings/nexus/stardewvalley/collection-tckf0m'));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ listing: { id: 'collection-tckf0m', kind: 'modpack' } });
  expect((await api(new Request('https://local/v1/listings/nexus/stardewvalley/collection-other'))).status).toBe(404);
});
