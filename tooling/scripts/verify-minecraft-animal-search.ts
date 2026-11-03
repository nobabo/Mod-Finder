import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { runSearchQueue } from '../../src/shared/search-plan';
import type { Listing, SearchRequest, SearchResult } from '../../src/shared/types';

const base = process.argv[2] ?? 'https://modfinder.pages.dev';
const baseline = process.argv[3] === '--baseline';
assert.equal(new URL(base).protocol, 'https:');
const expectations = [
  { query: '닭', noun: 'chicken', modrinth: ['fQcPH7ab', 'YzR4F72D'], curseforge: ['1368019', '621910'] },
  { query: '오리', noun: 'duck', modrinth: ['jkb861Ih', 'ojFjz7JF'], curseforge: ['597248', '451766', '451789'] },
];
async function json(path: string) {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(60000) });
  assert.equal(response.status, 200, path.split('?')[0]);
  return response.json();
}
const checks = [];
for (const expected of expectations) {
  const plan = await json('/v1/search-plan?' + new URLSearchParams({ gameId: 'minecraft-java', query: expected.query, kind: 'mod' })) as { original: SearchRequest[] };
  for (const source of ['modrinth', 'curseforge'] as const) {
    const requests = plan.original.filter(request => request.source === source);
    const queries = requests.map(request => request.query);
    const items = new Map<string, Listing>();
    const statuses: string[] = [];
    await runSearchQueue(requests, async request => {
      const params = new URLSearchParams({ gameId: request.gameId, source, query: request.query, sort: request.sort, kind: 'mod' });
      const result = await json('/v1/search?' + params) as SearchResult;
      statuses.push(result.status);
      for (const item of result.items) items.set(item.key, item);
    }, new AbortController().signal);
    const found = expected[source].filter(id => [...items.values()].some(item => item.id === id));
    const animalTerms = expected.noun === 'chicken' ? /chicken|roost/i : /duck/i;
    const relevant = [...items.values()].filter(item => animalTerms.test(item.title + ' ' + item.summary));
    const translated = queries.includes(expected.noun) && queries.includes(expected.noun + 's');
    const scoped = !queries.some(query => /Oritech|Origins|Day Counter|Biolith/.test(query));
    const passed = translated && scoped && found.length === expected[source].length && statuses.every(status => status === 'success' || status === 'empty');
    // Evidence contains plans and pass/fail/counts, never persisted provider responses.
    checks.push({ query: expected.query, source, queries, resultCount: items.size, relevantCount: relevant.length, curatedMatches: found.length, expectedCuratedMatches: expected[source].length, translated, scoped, passed });
  }
}
const report = { base, verifiedAt: new Date().toISOString(), baseline, passed: checks.every(check => check.passed), checks };
mkdirSync('output/deployment', { recursive: true });
writeFileSync(`output/deployment/minecraft-animals-${baseline ? 'before' : 'after'}.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (!baseline) assert.equal(report.passed, true, 'Animal keyword plans or live results did not match the verified projects');
