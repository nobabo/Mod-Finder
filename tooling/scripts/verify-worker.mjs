import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

const config = JSON.parse(readFileSync('tooling/config/wrangler.jsonc', 'utf8'));
const mf = new Miniflare(convertV4MiniflareOptions({
  cf: false,
  workers: [{
  name: 'mod-finder',
  modules: true,
  scriptPath: 'output/worker/index.js',
  compatibilityDate: config.compatibility_date,
  compatibilityFlags: config.compatibility_flags,
  bindings: config.vars,
  assets: { directory: 'output/web', binding: 'ASSETS', run_worker_first: config.assets.run_worker_first, routerConfig: { has_user_worker: true } },
  ratelimits: Object.fromEntries(config.ratelimits.map(({ name, ...options }) => [name, options])),
  }],
}));
try {
  for (const [country, cookie, language] of [
    ['KR', '', 'ko'], ['US', '', 'en'], ['JP', '', 'ja'],
    ['KR', 'mf-language=en', 'en'], ['US', 'mf-language=ko', 'ko'],
  ]) {
    const response = await mf.dispatchFetch('http://localhost/', { cf: { country }, headers: { Cookie: cookie } });
    assert.equal(response.status, 200, response.status === 200 ? undefined : await response.text());
    assert.equal(response.headers.get('content-language'), language);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.match(response.headers.get('content-security-policy'), /script-src 'self'/);
    assert.match(response.headers.get('content-security-policy'), /img-src 'self' https: data:;/);
    assert.match(response.headers.get('content-security-policy'), /script-src 'self';/);
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    const html = await response.text();
    assert.match(html, new RegExp(`data-locale="${language}"`));
    assert.match(html, new RegExp(`lang="${language}"`));
    assert.ok(html.includes('<title>Mod Finder</title>'));
  }
  const head = await mf.dispatchFetch('http://localhost/', { method: 'HEAD', cf: { country: 'KR' } });
  assert.equal(await head.text(), '');
  assert.equal(head.headers.get('content-language'), 'ko');
  const noCountry = await mf.dispatchFetch('http://localhost/', { headers: { 'CF-IPCountry': 'KR' } });
  assert.equal(noCountry.headers.get('content-language'), 'en', 'Never trust a supplied country header');
  await noCountry.text();
  const external = await mf.dispatchFetch('http://localhost/v1/search?gameId=minecraft-java&source=curseforge', { cf: { country: 'KR' }, headers: { 'Accept-Language': 'en' } });
  assert.deepEqual(await external.json().then(({ status, items, total, message }) => ({ status, items, total, message })), {
    status: 'external', items: [], total: null, message: 'Search integration pending · visit the original site',
  });
  const downloadPost = await mf.dispatchFetch('http://localhost/downloads/windows', { method: 'POST' });
  assert.equal(downloadPost.status, 405);
  assert.equal(downloadPost.headers.get('allow'), 'GET, HEAD');
  await downloadPost.text();
  const missingDownload = await mf.dispatchFetch('http://localhost/downloads/missing');
  assert.equal(missingDownload.status, 404);
  await missingDownload.text();
  for (const path of ['/v1/missing', '/internal/metrics']) {
    const response = await mf.dispatchFetch(`http://localhost${path}`);
    assert.equal(response.status, 404);
    assert.match(response.headers.get('content-type'), /json/);
    await response.text();
  }
  const denied = await mf.dispatchFetch('http://localhost/v1/service-status', { headers: { Origin: 'https://untrusted.example' } });
  assert.equal(denied.status, 403);
  await denied.text();
  const preflight = await mf.dispatchFetch('http://localhost/v1/search', { method: 'OPTIONS', headers: { Origin: 'https://tauri.localhost', 'Access-Control-Request-Method': 'GET' } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://tauri.localhost');
  const invalid = await mf.dispatchFetch('http://localhost/v1/search?gameId=minecraft-java&source=modrinth&url=https://untrusted.example');
  assert.equal(invalid.status, 400);
  await invalid.text();
  const asset = await mf.dispatchFetch('http://localhost/favicon.svg');
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get('content-type'), /svg/);
  assert.equal(asset.headers.get('x-content-type-options'), 'nosniff');
  assert.match(asset.headers.get('content-security-policy'), /img-src 'self' https: data:;/);
  await asset.text();
  const index = readFileSync('output/web/index.html', 'utf8');
  const scriptPath = index.match(/src="(\/assets\/[^\"]+\.js)"/)[1];
  const script = await mf.dispatchFetch(`http://localhost${scriptPath}`);
  assert.equal(script.status, 200);
  assert.match(script.headers.get('cache-control'), /max-age=31536000, immutable/);
  await script.text();
  for (const path of ['/.env', '/.dev.vars', '/package.json', '/src/worker/index.ts', '/src/native/Cargo.lock', '/tooling/config/wrangler.jsonc', '/ModFinder-0.1.0-Windows-x64-setup.exe']) {
    const response = await mf.dispatchFetch(`http://localhost${path}`);
    assert.equal(response.status, 404, `Must not publish ${path}`);
    await response.text();
  }
  const missing = await mf.dispatchFetch('http://localhost/no-such-file.js');
  assert.equal(missing.status, 404);
  await missing.text();
  let limited = false;
  for (let i = 0; i < 125; i++) {
    const response = await mf.dispatchFetch('http://localhost/health');
    await response.text();
    if (response.status === 429) { limited = true; assert.equal(response.headers.get('retry-after'), '60'); break; }
  }
  assert.ok(limited, 'Rate limiting must remain active without a database');
  console.log('Worker runtime checks passed: country, language override, HTML isolation, API routing, CORS, validation, static assets and rate limit.');
} finally {
  await mf.dispose();
}
