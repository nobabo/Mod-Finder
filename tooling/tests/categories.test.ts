import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { categoriesForGame } from '../../src/shared/categories';
import { GAMES, getGame } from '../../src/shared/games';
import { searchPlan } from '../../src/shared/search-plan';
import { externalSearch } from '../../src/shared/links';
import { createApp } from '../../src/server/app';
import { readConfig } from '../../src/server/config';
import { UpstreamClient } from '../../src/server/http';

let app: FastifyInstance | undefined;
afterEach(async () => { await app?.close(); app = undefined; });
async function setup(body: unknown) {
  const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body)));
  app = await createApp({ config: readConfig({ STEAM_API_KEY: 'test-key' }), http: new UpstreamClient('Test', fetcher as typeof fetch) });
  return fetcher;
}
const path = (gameId: string, source: string, category: string, query = '') => '/v1/search?' + new URLSearchParams({ gameId, source, category, query });

describe('game-specific mod categories', () => {
  it('provides distinct, source-scoped categories for every game', () => {
    for (const game of GAMES) {
      const categories = categoriesForGame(game.id);
      expect(categories.length).toBeGreaterThan(0);
      expect(new Set(categories.map(c => c.id)).size).toBe(categories.length);
      expect(categories.every(c => game.sources[c.source] && c.id === `${c.source}:${c.value}`)).toBe(true);
    }
    expect(categoriesForGame('stardew-valley').some(c => c.en === 'Crops')).toBe(true);
    expect(categoriesForGame('skyrim-se').some(c => c.en === 'Crops')).toBe(false);
    expect(categoriesForGame('all')).toEqual([]);
  });
  it('keeps the game and compatibility filters, scopes the source, and supports category browsing', () => {
    const requests = searchPlan({ gameId: 'minecraft-java', query: '', sort: 'downloads', selectedSource: 'all', filters: { category: 'modrinth:optimization', version: '1.21.1', loader: 'fabric' } });
    expect(requests).toEqual([{ gameId: 'minecraft-java', query: '', source: 'modrinth', sort: 'downloads', filters: { category: 'modrinth:optimization', version: '1.21.1', loader: 'fabric' } }]);
    expect(searchPlan({ gameId: 'valheim', query: 'test', sort: 'downloads', selectedSource: 'all', filters: { category: 'thunderstore:690' } })).toEqual([]);
  });
  it('combines a Modrinth category with version, loader and project type facets', async () => {
    const fetcher = await setup({ hits: [], total_hits: 0 });
    const response = await app!.inject(path('minecraft-java', 'modrinth', 'modrinth:optimization', 'sodium') + '&loader=fabric&version=1.21.1&kind=mod');
    expect(response.statusCode).toBe(200);
    const facets = JSON.parse(new URL(String(fetcher.mock.calls[0][0])).searchParams.get('facets')!);
    expect(facets).toEqual(expect.arrayContaining([['categories:optimization'], ['categories:fabric'], ['versions:1.21.1'], ['project_type:mod']]));
    expect(response.json().appliedFilters.category).toBe('modrinth:optimization');
  });
  it('filters Nexus categories within the selected game without an empty text condition', async () => {
    const fetcher = await setup({ data: { mods: { nodes: [], totalCount: 0 } } });
    await app!.inject(path('stardew-valley', 'nexus', 'nexus:Crops'));
    const request = JSON.parse((fetcher.mock.calls[0][1] as RequestInit).body as string);
    expect(request.variables.filter.filter).toEqual([{ gameDomainName: [{ value: 'stardewvalley', op: 'EQUALS' }] }, { categoryName: [{ value: 'Crops', op: 'EQUALS' }] }]);
  });
  it('uses Thunderstore community category IDs and preserves category-bound pagination', async () => {
    const hit = { namespace: 'Example', name: 'Moon', community_identifier: 'lethal-company', description: '', categories: [{ name: 'Moons', slug: 'moons' }] };
    const fetcher = await setup({ results: Array.from({ length: 20 }, (_, i) => ({ ...hit, name: `Moon${i}` })), count: 40, next: 'https://thunderstore.io/next' });
    const response = await app!.inject(path('lethal-company', 'thunderstore', 'thunderstore:690'));
    expect(new URL(String(fetcher.mock.calls[0][0])).searchParams.get('included_categories')).toBe('690');
    const cursor = response.json().nextCursor;
    expect(cursor).toBeTruthy();
    expect((await app!.inject(path('lethal-company', 'thunderstore', 'thunderstore:689') + '&cursor=' + cursor)).statusCode).toBe(400);
    expect((await app!.inject(path('lethal-company', 'thunderstore', 'thunderstore:690') + '&cursor=' + cursor)).statusCode).toBe(200);
    expect(new URL(String(fetcher.mock.calls[1][0])).searchParams.get('included_categories')).toBe('690');
  });
  it('passes exact Steam tags and retains them in external links', async () => {
    const fetcher = await setup({ response: { total: 0, publishedfiledetails: [] } });
    await app!.inject(path('project-zomboid', 'steam', 'steam:Clothing/Armor'));
    const input = JSON.parse(new URL(String(fetcher.mock.calls[0][0])).searchParams.get('input_json')!);
    expect(input.requiredtags).toEqual(['Clothing/Armor']);
    const link = externalSearch(getGame('project-zomboid')!, 'steam', 'jacket', { category: 'steam:Clothing/Armor' });
    expect(new URL(link.url!).searchParams.get('requiredtags[]')).toBe('Clothing/Armor');
  });
  it('rejects a category belonging to another game or provider before calling upstream', async () => {
    const fetcher = await setup({});
    for (const url of [path('valheim', 'thunderstore', 'thunderstore:690'), path('minecraft-java', 'curseforge', 'modrinth:optimization'), path('skyrim-se', 'nexus', 'nexus:Crops')]) {
      expect((await app!.inject(url)).statusCode).toBe(400);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
});
