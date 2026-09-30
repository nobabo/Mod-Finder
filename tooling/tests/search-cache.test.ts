import { describe, expect, it, vi } from 'vitest';
import { mapModrinth } from '../../src/server/adapters';
import { getGame } from '../../src/shared/games';
import type { SearchRequest, SearchResult } from '../../src/shared/types';
import { EMPTY_SEARCH_CACHE_TTL, SEARCH_CACHE_MAX_BYTES, SEARCH_CACHE_MAX_PAGES, SEARCH_CACHE_TTL, SearchCache, retainedCacheEntries, searchCacheKey, type SearchCacheEntry, type SearchCacheStore } from '../../src/web/lib/search-cache';

const request: SearchRequest = { gameId: 'minecraft-java', source: 'modrinth', query: 'Sodium', filters: {}, sort: 'downloads' };
const context = { endpoint: 'https://modfinder.pages.dev', locale: 'ko' };
const initialTime = Date.parse('2026-09-30T01:00:00Z');
const item = { ...mapModrinth({ project_id: 'sodium', title: 'Sodium', description: 'Optimization', categories: [] }, getGame(request.gameId)!, 1), loaders: null };
const result = (changes: Partial<SearchResult> = {}): SearchResult => ({ source: request.source, status: 'success', items: [item], nextCursor: 'page-2', total: null, fetchedAt: new Date(initialTime).toISOString(), cached: false, appliedFilters: {}, unsupportedFilters: [], externalUrl: null, queryForwarded: true, message: '검색 완료', ...changes });
const signal = () => new AbortController().signal;
class SnapshotStore implements SearchCacheStore {
  entries = new Map<string, unknown>();
  read = vi.fn(async (key: string) => this.entries.get(key));
  write = vi.fn(async (entry: SearchCacheEntry) => { this.entries.set(entry.key, JSON.parse(JSON.stringify(entry))); });
  remove = vi.fn(async (key: string) => { this.entries.delete(key); });
}
function harness(optIn = false) {
  const store = new SnapshotStore();
  let time = initialTime;
  const cache = new SearchCache(store, optIn, () => time);
  const fetch = vi.fn(async () => result());
  return { cache, store, fetch, advance: (milliseconds: number) => { time += milliseconds; }, reload: () => new SearchCache(store, optIn, () => time) };
}

describe('local search snapshots', () => {
  it('reuses a complete page in memory and after reload without changing identity, cursors or unknown metadata', async () => {
    const h = harness();
    const first = await h.cache.search(request, context, h.fetch, signal());
    first.items[0].title = 'UI mutation';
    const second = await h.cache.search(request, context, h.fetch, signal());
    const persisted = await h.reload().search(request, context, h.fetch, signal());
    expect(h.fetch).toHaveBeenCalledTimes(1);
    expect(second).toEqual({ ...result(), cached: true });
    expect(persisted).toEqual(second);
    expect(persisted.items[0]).toMatchObject({ id: 'sodium', versions: null, loaders: null, author: null });
    expect(persisted.total).toBeNull(); expect(persisted.fetchedAt).toBe(result().fetchedAt);
  });

  it('expires successful pages at 30 minutes and empty pages at 5 minutes without extending their lifetime on hits', async () => {
    const h = harness();
    await h.cache.search(request, context, h.fetch, signal());
    h.advance(SEARCH_CACHE_TTL - 1);
    expect((await h.cache.search(request, context, h.fetch, signal())).cached).toBe(true);
    h.advance(1);
    expect((await h.cache.search(request, context, h.fetch, signal())).cached).toBe(false);
    expect(h.fetch).toHaveBeenCalledTimes(2);
    const empty = harness(); empty.fetch.mockImplementation(async () => result({ status: 'empty', items: [], nextCursor: null, total: 0 }));
    await empty.cache.search(request, context, empty.fetch, signal());
    empty.advance(EMPTY_SEARCH_CACHE_TTL);
    await empty.reload().search(request, context, empty.fetch, signal());
    expect(empty.fetch).toHaveBeenCalledTimes(2);
  });

  it('uses every request dimension, API origin and language; filter property order is irrelevant', async () => {
    const h = harness();
    await h.cache.search(request, context, h.fetch, signal());
    const variants: SearchRequest[] = [
      { ...request, gameId: 'valheim' }, { ...request, source: 'nexus' }, { ...request, query: 'sodium' },
      { ...request, sort: 'updated' }, { ...request, cursor: 'page-2' },
      ...['version', 'loader', 'kind', 'category'].map(key => ({ ...request, filters: { [key]: 'different' } })),
    ];
    for (const variant of variants) await h.cache.search(variant, context, h.fetch, signal());
    await h.cache.search(request, { ...context, locale: 'en' }, h.fetch, signal());
    await h.cache.search(request, { ...context, endpoint: 'https://api.example.com' }, h.fetch, signal());
    expect(h.fetch).toHaveBeenCalledTimes(variants.length + 3);
    expect(searchCacheKey({ ...request, filters: { loader: 'fabric', version: '1.21' } }, context))
      .toBe(searchCacheKey({ ...request, filters: { version: '1.21', loader: 'fabric' } }, context));
  });

  it.each(['error', 'external', 'disabled', 'auth_required', 'rate_limited', 'unsupported'] as const)('never saves %s responses', async status => {
    const h = harness(); h.fetch.mockImplementation(async () => result({ status, items: [], nextCursor: null }));
    await h.cache.search(request, context, h.fetch, signal());
    await h.cache.search(request, context, h.fetch, signal());
    expect(h.fetch).toHaveBeenCalledTimes(2); expect(h.store.write).not.toHaveBeenCalled();
  });

  it.each(['curseforge', 'thunderstore'] as const)('does not retain restricted %s payloads in memory or on disk', async source => {
    const h = harness(true);
    const limited = new SearchCache(h.store, false, () => initialTime);
    const req = { ...request, source };
    const response = result({ source, items: [] });
    h.fetch.mockImplementation(async () => response);
    await limited.search(req, context, h.fetch, signal());
    await limited.search(req, context, h.fetch, signal());
    expect(h.fetch).toHaveBeenCalledTimes(2); expect(h.store.read).not.toHaveBeenCalled(); expect(h.store.write).not.toHaveBeenCalled();
  });

  it('allows Thunderstore snapshots only with its explicit policy flag', async () => {
    const h = harness(true);
    const req: SearchRequest = { ...request, gameId: 'valheim', source: 'thunderstore' };
    h.fetch.mockImplementation(async () => result({ source: req.source, status: 'empty', items: [], nextCursor: null }));
    await h.cache.search(req, context, h.fetch, signal());
    expect((await h.reload().search(req, context, h.fetch, signal())).cached).toBe(true);
    expect(h.fetch).toHaveBeenCalledTimes(1);
    expect(retainedCacheEntries([...h.store.entries.values()], initialTime, false)).toEqual([]);
  });

  it.each([
    { ...item, id: 9007199254740992 }, { ...item, key: 'wrong:key' }, { ...item, gameId: 'valheim' },
    { ...item, source: 'curseforge' }, { ...item, scope: 'wrong' }, { ...item, url: 'javascript:alert(1)' },
    { ...item, metrics: null }, { ...item, searchMatch: { query: 'Sodium', description: 'wrong' } },
  ])('refuses unsafe or cross-scope pages rather than caching a partial result', async invalid => {
    const h = harness(); h.fetch.mockImplementation(async () => result({ items: [item, invalid as typeof item] }));
    await h.cache.search(request, context, h.fetch, signal());
    expect(h.store.write).not.toHaveBeenCalled();
  });

  it('discards corrupt, mismatched and future-dated disk entries and fetches live', async () => {
    for (const corrupt of [{ payload: '{' }, { key: 'another-search' }, { savedAt: initialTime + 1 }]) {
      const h = harness();
      await h.cache.search(request, context, h.fetch, signal());
      const key = searchCacheKey(request, context);
      h.store.entries.set(key, { ...h.store.entries.get(key) as SearchCacheEntry, ...corrupt });
      expect((await h.reload().search(request, context, h.fetch, signal())).cached).toBe(false);
      expect(h.fetch).toHaveBeenCalledTimes(2); expect(h.store.remove).toHaveBeenCalledWith(key);
    }
  });

  it('bounds snapshots by count and bytes, evicting oldest pages and expired entries', async () => {
    const h = harness(); await h.cache.search(request, context, h.fetch, signal());
    const entry = [...h.store.entries.values()][0] as SearchCacheEntry;
    const make = (key: string, payload: string, age: number): SearchCacheEntry => ({ ...entry, key, payload, savedAt: initialTime - age, expiresAt: initialTime - age + SEARCH_CACHE_TTL, bytes: new TextEncoder().encode(key + payload).byteLength });
    const pages = Array.from({ length: SEARCH_CACHE_MAX_PAGES + 1 }, (_, index) => make(`page-${index}`, entry.payload, index));
    const retained = retainedCacheEntries(pages, initialTime);
    expect(retained).toHaveLength(SEARCH_CACHE_MAX_PAGES); expect(retained.some(page => page.key === 'page-100')).toBe(false);
    const large = retainedCacheEntries([make('new', 'x'.repeat(SEARCH_CACHE_MAX_BYTES / 2), 0), make('old', 'x'.repeat(SEARCH_CACHE_MAX_BYTES / 2), 1)], initialTime);
    expect(large.map(page => page.key)).toEqual(['new']);
    expect(retainedCacheEntries([{ ...entry, expiresAt: initialTime }], initialTime)).toEqual([]);
  });

  it('keeps search working when reading, deleting or writing storage fails', async () => {
    const h = harness();
    h.store.read.mockRejectedValue(new Error('storage_disabled')); h.store.write.mockRejectedValue(new Error('quota'));
    expect(await h.cache.search(request, context, h.fetch, signal())).toEqual(result());
    expect((await h.cache.search(request, context, h.fetch, signal())).cached).toBe(true);
    h.advance(SEARCH_CACHE_TTL); h.store.remove.mockRejectedValue(new Error('storage_disabled'));
    expect((await h.cache.search(request, context, h.fetch, signal())).cached).toBe(false);
  });

  it('does not retain a thrown network failure', async () => {
    const h = harness(); h.fetch.mockRejectedValueOnce(new Error('offline'));
    await expect(h.cache.search(request, context, h.fetch, signal())).rejects.toThrow('offline');
    expect((await h.cache.search(request, context, h.fetch, signal())).cached).toBe(false);
    expect(h.fetch).toHaveBeenCalledTimes(2);
  });

  it('shares concurrent requests while keeping each caller cancellation and returned objects independent', async () => {
    const h = harness();
    let complete!: (value: SearchResult) => void;
    const fetch = vi.fn((shared: AbortSignal) => new Promise<SearchResult>(resolve => { expect(shared.aborted).toBe(false); complete = resolve; }));
    const cancelled = new AbortController();
    const first = h.cache.search(request, context, fetch, cancelled.signal);
    const rejected = expect(first).rejects.toMatchObject({ name: 'AbortError' });
    const second = h.cache.search(request, context, fetch, signal());
    const third = h.cache.search(request, context, fetch, signal());
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    cancelled.abort(); await rejected; complete(result());
    const [a, b] = await Promise.all([second, third]); a.items[0].title = 'changed';
    expect(b.items[0].title).toBe('Sodium'); expect(h.store.write).toHaveBeenCalledTimes(1);
  });

  it('cancels the shared fetch when all callers leave and never saves its response', async () => {
    const h = harness(); const caller = new AbortController();
    const fetch = vi.fn((shared: AbortSignal) => new Promise<SearchResult>((_, reject) => shared.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')))));
    const pending = h.cache.search(request, context, fetch, caller.signal);
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1)); caller.abort(); await rejected;
    expect(h.store.write).not.toHaveBeenCalled();
    expect((await h.cache.search(request, context, h.fetch, signal())).cached).toBe(false);
    const aborted = new AbortController(); aborted.abort();
    await expect(h.cache.search(request, context, h.fetch, aborted.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(h.fetch).toHaveBeenCalledTimes(1);
  });
});
