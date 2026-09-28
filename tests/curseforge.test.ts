import { describe, expect, it, vi } from 'vitest';
import { Adapter, cursorFor, mapCurseforge } from '../server/adapters';
import { createApi } from '../server/api';
import { readConfig } from '../server/config';
import { UpstreamClient } from '../server/http';
import { getGame } from '../shared/games';
import type { SearchRequest } from '../shared/types';

const game = getGame('minecraft-java')!;
const hit = { id: 123, gameId: 432, name: 'Example', classId: 6, links: { websiteUrl: 'https://www.curseforge.com/minecraft/mc-mods/example' } };
const request: SearchRequest = { gameId: game.id, source: 'curseforge', query: 'example', sort: 'downloads', filters: {} };
function setup(body: unknown = { data: [hit], pagination: { totalCount: 10000 } }, status = 200) {
  const fetcher = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify(body), { status, headers: { 'retry-after': '90' } }));
  const config = readConfig({ CURSEFORGE_API_KEY: 'test-only-placeholder' });
  const http = new UpstreamClient('Test', fetcher);
  return { fetcher, adapter: new Adapter('curseforge', config, http), api: createApi(config, http) };
}
describe('CurseForge documented search', () => {
  it.each([['mod', '6'], ['modpack', '4471'], ['resourcepack', '12'], ['shader', '6552']])('forwards %s and version/loader filters using server-only authentication', async (kind, classId) => {
    const { adapter, fetcher } = setup();
    const result = await adapter.search({ ...request, filters: { kind, loader: 'fabric', version: '1.21.1' } });
    const [url, init] = fetcher.mock.calls[0];
    expect(Object.fromEntries(new URL(String(url)).searchParams)).toMatchObject({ gameId: '432', classId, gameVersion: '1.21.1', modLoaderType: '4', pageSize: '20' });
    expect(new Headers(init?.headers).get('x-api-key')).toBe('test-only-placeholder');
    expect(JSON.stringify(result)).not.toContain('test-only-placeholder');
    expect(result.items[0]).toMatchObject({ key: 'curseforge:432:123', id: '123', versions: null, loaders: null });
  });
  it.each([['popular', '2'], ['downloads', '6'], ['updated', '3'], ['relevance', null]] as const)('uses documented %s sorting', async (sort, expected) => {
    const { adapter, fetcher } = setup();
    await adapter.search({ ...request, sort });
    expect(new URL(String(fetcher.mock.calls[0][0])).searchParams.get('sortField')).toBe(expected);
  });
  it('reports loader-only filtering as unsupported rather than claiming compatibility', async () => {
    const { adapter, fetcher } = setup();
    const result = await adapter.search({ ...request, filters: { loader: 'fabric' } });
    expect(result.appliedFilters).toEqual({});
    expect(result.unsupportedFilters).toEqual(['loader']);
    expect(new URL(String(fetcher.mock.calls[0][0])).searchParams.has('modLoaderType')).toBe(false);
  });
  it('bounds the final page and rejects out-of-range cursors before fetching', async () => {
    const { adapter, api, fetcher } = setup();
    const result = await adapter.search({ ...request, cursor: cursorFor(request, 9999) });
    expect(new URL(String(fetcher.mock.calls[0][0])).searchParams.get('pageSize')).toBe('1');
    expect(result.nextCursor).toBeNull();
    const response = await api(new Request(`https://local/v1/search?gameId=minecraft-java&source=curseforge&query=example&sort=downloads&cursor=${cursorFor(request, 10000)}`));
    expect(response.status).toBe(400);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('does not cache live searches', async () => {
    const { api, fetcher } = setup();
    for (let i = 0; i < 2; i++) {
      const response = await api(new Request('https://local/v1/search?gameId=minecraft-java&source=curseforge'));
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.json()).toMatchObject({ cached: false });
    }
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each([401, 403, 429])('handles HTTP %s without exposing upstream bodies', async status => {
    const { adapter } = setup({ message: 'sensitive-upstream-body' }, status);
    const result = await adapter.search(request);
    expect(result.status).toBe(status === 429 ? 'rate_limited' : 'error');
    expect(JSON.stringify(result)).not.toContain('sensitive-upstream-body');
    if (status === 429) expect(result.retryAfter).toBe(90);
  });
  it('preserves unknown metadata and rejects wrong-game or wrong-site results', () => {
    expect(mapCurseforge({ ...hit, latestFilesIndexes: [{ modLoader: 0 }] }, game, 1)).toMatchObject({ versions: null, loaders: null, metrics: [] });
    expect(() => mapCurseforge({ ...hit, gameId: 999 }, game, 1)).toThrow('invalid');
    expect(() => mapCurseforge({ ...hit, links: { websiteUrl: 'https://modrinth.com/mod/example' } }, game, 1)).toThrow('invalid');
  });
});
