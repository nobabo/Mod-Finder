import assert from 'node:assert/strict';
import { GAMES } from '../../src/shared/games';
import type { SearchResult } from '../../src/shared/types';
const base = process.env.SMOKE_API_URL ?? 'http://127.0.0.1:4318';
const queries = ['Sodium', 'Fabric API', 'Iris', 'Mod Menu', 'Lithium', 'FerriteCore', 'minimap', 'shader', '한글', 'zz-modfinder-no-such-mod-9f137'];
const samples: number[] = [];
for (const query of queries) {
  const start = performance.now();
  const response = await fetch(`${base}/v1/search?${new URLSearchParams({ gameId: 'minecraft-java', source: 'modrinth', query })}`, { signal: AbortSignal.timeout(7000) });
  assert.equal(response.status, 200);
  const data = await response.json() as SearchResult;
  assert.ok(['success', 'empty'].includes(data.status), `${query}: ${data.status}`);
  assert.ok(data.items.every(item => item.gameId === 'minecraft-java' && item.source === 'modrinth' && item.url.startsWith('https://modrinth.com/')));
  samples.push(performance.now() - start);
  console.log(JSON.stringify({ query, status: data.status, count: data.items.length, ms: Math.round(samples.at(-1)!) }));
}
for (const game of GAMES) {
  const response = await fetch(`${base}/v1/games/${game.id}/sources`);
  assert.equal(response.status, 200);
  const data = await response.json() as { sources: { status: string; externalUrl: string | null }[] };
  assert.ok(data.sources.every(s => s.status === 'unsupported' || s.externalUrl?.startsWith('https://')));
}
console.log(JSON.stringify({ samples: samples.length, p95Ms: Math.round([...samples].sort((a,b) => a-b)[Math.ceil(samples.length * .95) - 1]), note: 'Live smoke sample; not a load-test guarantee.' }));
