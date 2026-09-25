import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:4318';
const checks = [];
async function search(gameId, query, cursor) {
  const params = new URLSearchParams({ gameId, source: 'thunderstore', query, sort: 'popular', ...(cursor ? { cursor } : {}) });
  const response = await fetch(`${base}/v1/search?${params}`, { signal: AbortSignal.timeout(15000), headers: { Origin: 'https://tauri.localhost' } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://tauri.localhost');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const result = await response.json();
  assert.ok(['success', 'empty'].includes(result.status), result.message);
  assert.ok(result.items.every(item => item.source === 'thunderstore' && item.gameId === gameId && typeof item.id === 'string' && item.versions === null && item.loaders === null));
  return result;
}
for (const [gameId, query, original] of [
  ['lethal-company', 'MoreCompany', 'notnotnotswipez-MoreCompany'],
  ['valheim', 'ValheimPlus', 'Grantapher-ValheimPlus_Grantapher_Temporary'],
  ['risk-of-rain-2', 'BepInEx', 'bbepis-BepInExPack'],
]) {
  const result = await search(gameId, query);
  assert.ok(result.items.some(item => item.id === original), `${gameId}: expected original package`);
  let nextCount = 0;
  if (result.nextCursor) {
    const next = await search(gameId, query, result.nextCursor);
    assert.ok(next.items.length && next.items.every(item => !result.items.some(previous => previous.key === item.key)));
    nextCount = next.items.length;
  }
  checks.push({ gameId, query, total: result.total, firstPage: result.items.length, nextPage: nextCount });
}
const empty = await search('lethal-company', 'modfinder_no_match_987654321');
assert.equal(empty.status, 'empty'); assert.equal(empty.total, 0); assert.equal(empty.nextCursor, null);
const report = { base, verifiedAt: new Date().toISOString(), checks, emptySearch: true, nativeOriginCors: true };
mkdirSync('output/thunderstore', { recursive: true });
writeFileSync('output/thunderstore/verification.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
