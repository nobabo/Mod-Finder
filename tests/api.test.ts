import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../server/app';
import { readConfig } from '../server/config';
import { UpstreamClient } from '../server/http';
let app: FastifyInstance;
afterEach(async () => { await app?.close(); });
function fakeHttp(body: unknown, status = 200, headers: Record<string, string> = {}) {
  const fetcher = vi.fn(async () => new Response(JSON.stringify(body), { status, headers }));
  return { http: new UpstreamClient('Test', fetcher as typeof fetch), fetcher };
}
const path = '/v1/search?gameId=minecraft-java&source=modrinth&query=Sodium';
describe('search API', () => {
  it('rejects unexpectedly large result arrays', async () => {
    app = await createApp({ config: readConfig({}), ...fakeHttp({ hits: Array.from({ length: 21 }, (_, i) => ({ project_id: String(i), title: 'Too many' })), total_hits: 21 }) });
    expect((await app.inject(path)).json().status).toBe('error');
  });
  it('normalizes results and forwards game filters', async () => {
    const { http, fetcher } = fakeHttp({ hits: [{ project_id: 'a', title: 'Sodium', categories: ['fabric'], downloads: 42 }], total_hits: 22 });
    app = await createApp({ config: readConfig({}), http });
    const res = await app.inject(path + '&loader=fabric&version=1.21.1');
    expect(res.statusCode).toBe(200); expect(res.json().status).toBe('success'); expect(res.json().items[0].metrics[0].label).toBe('다운로드'); expect(res.json().nextCursor).toBeTruthy();
    const url = new URL((fetcher.mock.calls[0] as unknown as [string])[0]);
    expect(JSON.parse(url.searchParams.get('facets')!)).toContainEqual(['categories:fabric']);
  });
  it('returns an actual empty state', async () => { app = await createApp({ config: readConfig({}), ...fakeHttp({ hits: [], total_hits: 0 }) }); expect((await app.inject(path)).json().status).toBe('empty'); });
  it('keeps unapproved and unsupported sources out of result counts', async () => {
    const { http, fetcher } = fakeHttp({}); app = await createApp({ config: readConfig({}), http });
    expect((await app.inject('/v1/search?gameId=minecraft-java&source=nexus')).json()).toMatchObject({ status: 'unsupported', items: [], total: null, queryForwarded: false });
    expect((await app.inject('/v1/search?gameId=minecraft-java&source=steam')).json().status).toBe('unsupported');
    expect((await app.inject('/v1/search?gameId=minecraft-java&source=thunderstore')).json()).toMatchObject({ status: 'unsupported', items: [], total: null });
    expect((await app.inject('/v1/listings/thunderstore/lethal-company/123')).statusCode).toBe(404);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('enforces remote source disable even when credentials exist', async () => {
    const { http, fetcher } = fakeHttp({}); app = await createApp({ config: readConfig({ CURSEFORGE_API_KEY: 'private', DISABLED_SOURCES: 'curseforge' }), http });
    const res = await app.inject('/v1/search?gameId=minecraft-java&source=curseforge'); expect(res.json().status).toBe('disabled'); expect(fetcher).not.toHaveBeenCalled(); expect(res.body).not.toContain('private');
  });
  it('honors Retry-After without repeated upstream calls', async () => {
    const { http, fetcher } = fakeHttp({}, 429, { 'retry-after': '120' }); app = await createApp({ config: readConfig({}), http });
    expect((await app.inject(path)).json()).toMatchObject({ status: 'rate_limited', retryAfter: 120 });
    expect((await app.inject(path)).json().status).toBe('rate_limited'); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('treats malformed upstream results as errors, not empty results', async () => { app = await createApp({ config: readConfig({}), ...fakeHttp({ hits: [{ title: 'missing id' }], total_hits: 1 }) }); expect((await app.inject(path)).json().status).toBe('error'); });
  it('does not expose auth errors or credentials', async () => { app = await createApp({ config: readConfig({}), ...fakeHttp({ secret: 'hidden' }, 401) }); const res = await app.inject(path); expect(res.json().status).toBe('error'); expect(res.body).not.toContain('hidden'); });
  it('does not follow upstream redirects in Workers-compatible fetch mode', async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, options?: RequestInit) => {
      expect(options?.redirect).toBe('manual');
      return new Response(null, { status: 302, headers: { Location: 'https://untrusted.example/' } });
    });
    app = await createApp({ config: readConfig({}), http: new UpstreamClient('Test', fetcher as typeof fetch) });
    expect((await app.inject(path)).json().status).toBe('error');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('rejects unknown games, invalid filters and arbitrary proxy parameters', async () => {
    app = await createApp({ config: readConfig({}) });
    expect((await app.inject('/v1/search?gameId=bedrock&source=modrinth')).statusCode).toBe(404);
    expect((await app.inject(path + '&loader=evil')).statusCode).toBe(400);
    expect((await app.inject(path + '&url=https://example.com')).statusCode).toBe(400);
  });
  it('fetches each search live without a cache', async () => {
    const { http, fetcher } = fakeHttp({ hits: [], total_hits: 0 }); app = await createApp({ config: readConfig({}), http });
    await app.inject(path); await app.inject(path); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('only returns safe health state', async () => { app = await createApp({ config: readConfig({ STEAM_API_KEY: 'secret-value' }) }); const res = await app.inject('/v1/service-status'); expect(res.body).not.toContain('secret-value'); expect(res.json().sources).toHaveLength(5); });
});
describe('upstream resource boundaries', () => {
  it.each([302, 401, 429, 500])('cancels the unused body for status %s', async status => {
    const cancel = vi.fn();
    const http = new UpstreamClient('Test', vi.fn(async () => new Response(new ReadableStream({ cancel }), { status })) as typeof fetch);
    await expect(http.json('https://api.modrinth.com/v2/search')).rejects.toThrow();
    expect(cancel).toHaveBeenCalledOnce();
  });
  it('cancels a body larger than 4 MiB before parsing', async () => {
    const cancel = vi.fn();
    const http = new UpstreamClient('Test', vi.fn(async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(4 * 1024 * 1024 + 1)); }, cancel }))) as typeof fetch);
    await expect(http.json('https://api.modrinth.com/v2/search')).rejects.toThrow('invalid');
    expect(cancel).toHaveBeenCalledOnce();
  });
});

it('forwards download sorting to the provider', async () => {
  const { http, fetcher } = fakeHttp({ hits:[], total_hits:0 });
  app = await createApp({ config:readConfig({}), http });
  const response = await app.inject(path + '&sort=downloads');
  expect(response.statusCode).toBe(200);
  expect(response.json().status).toBe('empty');
  const url = new URL((fetcher.mock.calls[0] as unknown as [string])[0]);
  expect(url.searchParams.get('index')).toBe('downloads');
});
