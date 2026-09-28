import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:4318';
const checks = [];
async function search(gameId, query, cursor) {
  const params = new URLSearchParams({ gameId, source: 'nexus', query, sort: 'relevance', ...(cursor ? { cursor } : {}) });
  const response = await fetch(`${base}/v1/search?${params}`, { headers: { Origin: 'https://tauri.localhost' }, signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://tauri.localhost');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const result = await response.json();
  assert.ok(['success', 'empty'].includes(result.status), result.message);
  assert.ok(result.items.every(item => item.source === 'nexus' && item.gameId === gameId && typeof item.id === 'string' && item.versions === null && item.loaders === null));
  return result;
}
for (const [gameId, query, original] of [['stardew-valley', 'SMAPI', '2400'], ['skyrim-se', 'SkyUI', '12604']]) {
  const first = await search(gameId, query);
  assert.ok(first.items.some(item => item.id === original), `${gameId}: original mod missing`);
  assert.ok(first.nextCursor);
  const next = await search(gameId, query, first.nextCursor);
  assert.ok(next.items.length && next.items.every(item => !first.items.some(previous => previous.key === item.key)));
  checks.push({ gameId, query, total: first.total, firstPage: first.items.length, nextPage: next.items.length });
}
const empty = await search('stardew-valley', 'qzxvbrtpkj982764001');
assert.equal(empty.status, 'empty'); assert.equal(empty.total, 0);
const report = { base, verifiedAt: new Date().toISOString(), checks, emptySearch: true, nativeOriginCors: true };
mkdirSync('output/nexus', { recursive: true });
writeFileSync('output/nexus/verification.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
