import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const downloads = JSON.parse(readFileSync(new URL('../../src/shared/data/app-downloads.json', import.meta.url), 'utf8'));

const base = process.argv[2];
assert.ok(base && new URL(base).protocol === 'https:', 'Supply the deployed HTTPS origin');
const checks = [];
async function request(path, options = {}, timeout = 15000) {
  const started = performance.now();
  const response = await fetch(new URL(path, base), { ...options, signal: AbortSignal.timeout(timeout) });
  checks.push({ path: path.startsWith('/v1/listings/') ? '/v1/listings/:source/:scope/:id' : path.split('?')[0], status: response.status, milliseconds: Math.round(performance.now() - started) });
  return response;
}
const health = await request('/health');
assert.equal(health.status, 200);
assert.equal((await health.json()).ok, true);
const expectedVersion = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version;
const version = await request('/health');
assert.equal((await version.json()).version, expectedVersion);
for (const [platform, signature] of [['windows', 'MZ'], ['android', 'PK']]) {
  const path = `/downloads/${platform}`;
  const head = await request(path, { method: 'HEAD' });
  assert.equal(head.status, 200, `${platform} download HEAD`);
  assert.match(head.headers.get('content-disposition'), /^attachment; filename="ModFinder-/);
  assert.equal(head.headers.get('x-checksum-sha256'), null, 'Do not claim per-request checksum verification');
  assert.ok(Number(head.headers.get('content-length')) > 0);
  const partial = await request(path, { headers: { Range: 'bytes=0-3' } });
  assert.equal(partial.status, 206, `${platform} resumed download`);
  assert.match(partial.headers.get('content-range'), /^bytes 0-3\/\d+$/);
  const bytes = Buffer.from(await partial.arrayBuffer());
  assert.equal(bytes.length, 4);
  assert.equal(bytes.subarray(0, 2).toString(), signature);
  const full = await request(path, {}, 120000);
  assert.equal(full.status, 200);
  const hash = createHash('sha256');
  let length = 0;
  for await (const chunk of full.body) { hash.update(chunk); length += chunk.length; assert.ok(length <= Number(head.headers.get('content-length'))); }
  assert.equal(length, Number(head.headers.get('content-length')));
  assert.equal(hash.digest('hex'), downloads[platform].sha256, `${platform} public artifact checksum`);
}
const plan = await request('/v1/search-plan?gameId=minecraft-java&query=소듕&loader=fabric');
assert.equal(plan.status, 200);
assert.ok((await plan.json()).fuzzy.some(request => request.source === 'modrinth' && request.query === 'Sodium' && request.filters.loader === 'fabric'));
const titlePlan = await request('/v1/search-plan?' + new URLSearchParams({ gameId: 'minecraft-java', query: '마우스 트윅', kind: 'mod' }));
assert.equal(titlePlan.status, 200);
assert.ok((await titlePlan.json()).original.some(request => request.source === 'curseforge' && request.query === 'Mouse Tweaks' && request.filters.kind === 'mod'), 'Korean CurseForge title reaches the real provider');
const regional = await request('/v1/games', { headers: { 'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8' } });
assert.equal(regional.headers.get('content-language'), 'ko'); await regional.text();
const thunderstore = await request('/v1/listings/thunderstore/lethal-company/notnotnotswipez-MoreCompany');
assert.equal(thunderstore.status, 200);
assert.equal((await thunderstore.json()).listing.key, 'thunderstore:lethal-company:notnotnotswipez-MoreCompany');
const wrongMethod = await request('/v1/search', { method: 'POST' });
assert.equal(wrongMethod.status, 405); assert.equal(wrongMethod.headers.get('allow'), 'GET, HEAD'); await wrongMethod.text();
const steamPath = '/v1/search?gameId=rimworld&source=steam&sort=popular';
const steam = await (await request(steamPath)).json();
assert.equal(steam.status, 'success'); assert.ok(steam.items.length > 0); assert.ok(steam.nextCursor);
const moreSteam = await (await request(`${steamPath}&cursor=${encodeURIComponent(steam.nextCursor)}`)).json();
assert.equal(moreSteam.status, 'success'); assert.ok(moreSteam.items.length > 0);
assert.equal(moreSteam.items[0].rank, steam.items.length + 1, 'Steam ranks must continue after the first page');
const collections = await (await request('/v1/search?gameId=stardew-valley&source=nexus&category=nexus%3Acollections&query=expanded&sort=downloads')).json();
assert.equal(collections.status, 'success');
assert.ok(collections.items.length > 0 && collections.items.every(item => item.kind === 'modpack' && item.key.startsWith('nexus:stardewvalley:collection-')));
const collection = collections.items[0];
const collectionDetail = await (await request(`/v1/listings/nexus/${encodeURIComponent(collection.scope)}/${encodeURIComponent(collection.id)}`)).json();
assert.equal(collectionDetail.listing?.key, collection.key);
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
