import { afterEach, describe, expect, it, vi } from 'vitest';
import { Adapter, cursorFor } from '../../src/server/adapters';
import { readConfig } from '../../src/server/config';
import { createApi } from '../../src/server/api';
import { createApp } from '../../src/server/app';
import { retrySeconds, UpstreamClient } from '../../src/server/http';
import { GAMES } from '../../src/shared/games';
import { searchPlan } from '../../src/shared/search-plan';
import { requestLocale } from '../../src/shared/locale';
import { loadLocalData, emptyLocalData, mergeFavoriteReferences } from '../../src/web/lib/storage';
import { mapModrinth } from '../../src/server/adapters';
import { recommendationQueries, recordInterest } from '../../src/web/lib/preferences';
import { detailReference } from '../../src/web/lib/detail-reference';
import type { SearchRequest } from '../../src/shared/types';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('reviewed search and restoration regressions', () => {
  it('keeps Steam provider ranks increasing over three cursor pages', async () => {
    const game = GAMES.find(game => game.sources.steam)!;
    let page = 0;
    const http = new UpstreamClient('test', vi.fn(async () => Response.json({ response: {
      total: 60, next_cursor: `next-${++page}`, publishedfiledetails: Array.from({ length: 20 }, (_, index) => ({ publishedfileid: String(1000 * page + index), title: 'Example' })),
    } })) as typeof fetch);
    const adapter = new Adapter('steam', readConfig({ STEAM_API_KEY: 'fixture' }), http);
    const request: SearchRequest = { gameId: game.id, source: 'steam', query: '', filters: {}, sort: 'popular' };
    const first = await adapter.search(request);
    const second = await adapter.search({ ...request, cursor: first.nextCursor! });
    const third = await adapter.search({ ...request, cursor: second.nextCursor! });
    expect([first, second, third].map(page => page.items[0].rank)).toEqual([1, 21, 41]);
    expect((await adapter.search({ ...request, cursor: cursorFor(request, 'legacy') })).items[0].rank).toBe(21);
  });
  it('restores Thunderstore bookmarks by scoped namespace/name, including hyphenated namespaces', async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request) => Response.json({ namespace: 'LVH-IT', name: 'Example', community_identifier: 'valheim', description: 'Restored', categories: [], version_created: '2026-10-15T00:00:00Z' }));
    const api = createApi(readConfig({}), new UpstreamClient('test', fetcher as typeof fetch));
    const response = await api(new Request('https://example.com/v1/listings/thunderstore/valheim/LVH-IT-Example'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ listing: { key: 'thunderstore:valheim:LVH-IT-Example', title: 'Example', summary: 'Restored', updatedAt: '2026-10-15T00:00:00.000Z', versions: null } });
    expect(String(fetcher.mock.calls[0][0])).toBe('https://thunderstore.io/api/cyberstorm/listing/valheim/LVH-IT/Example/');
  });
  it('decodes path segments once and rejects malformed or unsafe references', async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request) => Response.json({ id: 'abc', title: 'Example' }));
    const api = createApi(readConfig({}), new UpstreamClient('test', fetcher as typeof fetch));
    expect((await api(new Request('https://example.com/v1/listings/modrinth/minecraft/%61bc'))).status).toBe(200);
    expect(String(fetcher.mock.calls[0][0])).toBe('https://api.modrinth.com/v2/project/abc');
    for (const id of ['%ZZ', '%2fescape', '%00']) expect((await api(new Request('https://example.com/v1/listings/modrinth/minecraft/' + id))).status).toBe(400);
  });
  it('distinguishes reset epochs, Retry-After durations, dates, zero and malformed values', () => {
    const now = Date.parse('2026-10-16T00:00:00Z');
    expect(retrySeconds(String(now / 1000 + 30), true, now)).toBe(30);
    expect(retrySeconds('120', false, now)).toBe(120);
    expect(retrySeconds('0', true, now)).toBe(1);
    expect(retrySeconds('Fri, 16 Oct 2026 00:00:30 GMT', false, now)).toBe(30);
    expect(retrySeconds('invalid', true, now)).toBe(60);
  });
  it('shares only cooldown timestamps across fresh clients and resumes at the reset time', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-16T00:00:00Z'));
    const cooldowns = new Map<string, number>();
    const fetcher = vi.fn(async () => Response.json({}, { headers: { 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': String(Date.now() / 1000 + 30) } }));
    await new UpstreamClient('first', fetcher as typeof fetch, cooldowns).json('https://api.modrinth.com/v2/search');
    const next = new UpstreamClient('second', fetcher as typeof fetch, cooldowns);
    await expect(next.json('https://api.modrinth.com/v2/search')).rejects.toMatchObject({ code: 'rate_limited', retryAfter: 30 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(31000); await next.json('https://api.modrinth.com/v2/search');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('rejects categories on all-game scopes before building duplicate plans', () => {
    expect(searchPlan({ gameId: 'all', query: '', categories: ['one', 'two'], filters: {}, sort: 'relevance', selectedSource: 'all' })).toEqual([]);
  });
  it('negotiates region tags and q weights without choosing excluded languages', () => {
    expect(requestLocale('ko-KR,ko;q=0.9,en;q=0.8')).toBe('ko');
    expect(requestLocale('de;q=0.2,fr-FR;q=0.9')).toBe('fr');
    expect(requestLocale('ko;q=0,en;q=0.8')).toBe('en');
    expect(requestLocale('unknown,*')).toBeUndefined();
  });
  it('serves local API method errors and streams installer downloads through the same routes', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('binary', { headers: { 'Content-Type': 'application/octet-stream' } })));
    const app = await createApp({ config: readConfig({}) });
    try {
      const post = await app.inject({ url: '/v1/search', method: 'POST', payload: { query: 'test' } });
      expect(post.statusCode).toBe(405); expect(post.headers.allow).toBe('GET, HEAD');
      const download = await app.inject('/downloads/windows');
      expect(download.statusCode).toBe(200); expect(download.body).toBe('binary');
      expect(download.headers['content-disposition']).toContain('attachment');
    } finally { await app.close(); }
  });
  it('hydrates local bookmarks without fetching and merges refreshes without resurrecting removed favorites', async () => {
    const item = mapModrinth({ project_id: 'saved', title: 'Saved' }, GAMES[0], 1);
    const original = { ...emptyLocalData(), favorites: [item] };
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher); vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(original) });
    expect((await loadLocalData()).favorites[0].key).toBe(item.key); expect(fetcher).not.toHaveBeenCalled();
    const refreshed = { ...original, favorites: [{ ...item, title: 'Fresh' }] };
    const removed = { ...original, favorites: [], history: [{ gameId: item.gameId, query: 'later' }] };
    expect(mergeFavoriteReferences(removed, original, refreshed)).toEqual(removed);
    expect(mergeFavoriteReferences(original, original, refreshed).favorites[0].title).toBe('Fresh');
    const replaced = { ...original, favorites: [{ ...item, title: 'User changed' }] };
    expect(mergeFavoriteReferences(replaced, original, refreshed)).toEqual(replaced);
  });
  it('uses clicked titles and summaries to expand recommendation candidates without persisting payloads', () => {
    const item = mapModrinth({ project_id: 'example', title: 'Magic spells', description: 'Adventure dungeons', categories: [] }, GAMES[0], 1);
    const events = recordInterest([], item.gameId, '', item);
    expect(events[0].topics).toEqual(['magic', 'exploration']);
    expect(recommendationQueries(events, item.gameId)).toEqual(['magic', 'adventure']);
    expect(recommendationQueries(events, 'stardew-valley')).toEqual([]);
    expect(JSON.stringify(events)).not.toContain(item.title);
  });
  it('reconstructs scoped detail references without storing provider payloads in history', () => {
    expect(detailReference('thunderstore:valheim:LVH-IT-Example')).toMatchObject({ gameId: 'valheim', id: 'LVH-IT-Example' });
    expect(detailReference('modrinth:minecraft:abc')).toMatchObject({ source: 'modrinth', scope: 'minecraft', id: 'abc' });
    expect(detailReference('modrinth:other:abc')).toBeNull(); expect(detailReference('unknown:scope:abc')).toBeNull();
  });
});
