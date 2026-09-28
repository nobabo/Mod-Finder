import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';

const base = process.argv[2];
assert.ok(base && new URL(base).protocol === 'https:', 'Supply the deployed HTTPS origin');
const checks = [];
async function request(path, options = {}) {
  const started = performance.now();
  const response = await fetch(new URL(path, base), { ...options, signal: AbortSignal.timeout(15000) });
  checks.push({ path: path.startsWith('/v1/listings/') ? '/v1/listings/:source/:scope/:id' : path.split('?')[0], status: response.status, milliseconds: Math.round(performance.now() - started) });
  return response;
}
const health = await request('/health');
assert.equal(health.status, 200);
assert.equal((await health.json()).ok, true);
for (const language of ['ko', 'en']) {
  const response = await request('/', { headers: { Cookie: `mf-language=${language}` } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-language'), language);
  assert.match(response.headers.get('cache-control'), /private, no-store/);
  assert.match(response.headers.get('content-security-policy'), /script-src 'self'/);
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  const html = await response.text();
  assert.match(html, new RegExp(`data-locale="${language}"`));
  const script = html.match(/src="(\/assets\/[^\"]+\.js)"/)[1];
  if (language === 'en') {
    const asset = await request(script);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('cache-control'), /immutable/);
    await asset.arrayBuffer();
  }
}
const trace = await request('/cdn-cgi/trace');
const country = (await trace.text()).match(/^loc=(\w+)$/m)?.[1];
assert.ok(country, 'Expected Cloudflare country metadata');
const automatic = await request('/');
assert.equal(automatic.headers.get('content-language'), country === 'KR' ? 'ko' : 'en');
await automatic.text();
const searchPath = '/v1/search?gameId=minecraft-java&source=modrinth&query=Sodium&loader=fabric';
const search = await request(searchPath, { headers: { 'Accept-Language': 'en' } });
assert.equal(search.status, 200);
const result = await search.json();
assert.equal(result.status, 'success');
assert.ok(result.items.some(item => item.title === 'Sodium'));
assert.ok(result.items.every(item => item.source === 'modrinth' && typeof item.id === 'string' && item.loaders.includes('fabric')));
assert.ok(result.nextCursor);
const next = await request(`${searchPath}&cursor=${encodeURIComponent(result.nextCursor)}`);
assert.equal(next.status, 200);
const nextResult = await next.json();
assert.equal(nextResult.status, 'success');
const firstIds = new Set(result.items.map(item => item.key));
assert.ok(nextResult.items.every(item => !firstIds.has(item.key)));
const status = await request('/v1/service-status');
const sources = (await status.json()).sources;
assert.equal(sources.find(source => source.source === 'modrinth').status, 'ready');
assert.equal(sources.find(item => item.source === 'thunderstore').status, 'ready');
assert.equal(sources.find(item => item.source === 'steam').status, 'ready');
assert.equal(sources.find(item => item.source === 'nexus').status, 'ready');
assert.equal(sources.find(item => item.source === 'curseforge').status, 'ready');
// Keep only pass/fail/count evidence; never persist CurseForge response data.
for (const kind of ['mod', 'modpack']) {
  const path = `/v1/search?gameId=minecraft-java&source=curseforge&kind=${kind}&sort=downloads`;
  const response = await request(path);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const data = await response.json();
  assert.equal(data.status, 'success');
  assert.ok(data.items.length > 0);
  assert.ok(data.items.every(item => item.source === 'curseforge' && typeof item.id === 'string' && item.kind === kind));
  assert.ok(data.nextCursor);
  const nextResponse = await request(`${path}&cursor=${encodeURIComponent(data.nextCursor)}`);
  const nextData = await nextResponse.json();
  assert.equal(nextData.status, 'success');
  const keys = new Set(data.items.map(item => item.key));
  assert.ok(nextData.items.every(item => item.kind === kind && !keys.has(item.key)));
  const detail = await request(`/v1/listings/curseforge/432/${data.items[0].id}`);
  assert.equal(detail.status, 200);
  assert.equal((await detail.json()).listing.key, data.items[0].key);
}
const denied = await request('/v1/service-status', { headers: { Origin: 'https://untrusted.example' } });
assert.equal(denied.status, 403); await denied.text();
const invalid = await request(`${searchPath}&url=https://untrusted.example`);
assert.equal(invalid.status, 400); await invalid.text();
for (const path of ['/.env', '/.dev.vars', '/package.json', '/src/worker/index.ts', '/tooling/config/wrangler.jsonc', '/internal/metrics', '/missing.js']) {
  const response = await request(path); assert.equal(response.status, 404, path); await response.text();
}
const report = { base, verifiedAt: new Date().toISOString(), country, automaticLanguage: country === 'KR' ? 'ko' : 'en', resultCount: result.items.length, nextPageCount: nextResult.items.length, sources, checks };
mkdirSync('output/deployment', { recursive: true });
writeFileSync('output/deployment/verification.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
