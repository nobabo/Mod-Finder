import assert from 'node:assert/strict';
import { numberQueries } from '../../src/shared/search-number-variants';
import { searchPlan, bucketKey } from '../../src/shared/search-plan';
import { appendStable } from '../../src/shared/ranking';
import type { SearchResult, Source } from '../../src/shared/types';

// Only aggregate first-page counts are reported. Raw responses, including
// Thunderstore listings, stay in memory and are never persisted or shared.
const cases: [string, Source, string, string][] = [
  ['minecraft-java', 'curseforge', 'zombie', 'zombies'],
  ['minecraft-java', 'modrinth', 'enemy', 'enemies'],
  ['minecraft-java', 'modrinth', 'knife', 'knives'],
  ['minecraft-java', 'modrinth', 'leaf', 'leaves'],
  ['minecraft-java', 'modrinth', 'wolf', 'wolves'],
  ['stardew-valley', 'nexus', 'crop', 'crops'],
  ['skyrim-se', 'nexus', 'weapon', 'weapons'],
  ['lethal-company', 'thunderstore', 'monster', 'monsters'],
  ['rimworld', 'steam', 'child', 'children'],
  ['valheim', 'thunderstore', 'portal', 'portals'],
  ['terraria', 'steam', 'recipe', 'recipes'],
  ['project-zomboid', 'steam', 'vehicle', 'vehicles'],
  ['cyberpunk-2077', 'nexus', 'item', 'items'],
  ['baldurs-gate-3', 'nexus', 'spell', 'spells'],
  ['fallout-4', 'nexus', 'companion', 'companions'],
  ['risk-of-rain-2', 'thunderstore', 'skill', 'skills'],
  ['cities-skylines', 'steam', 'tree', 'trees'],
  ['dont-starve-together', 'steam', 'chest', 'chests'],
];
for (const [gameId, source, singular, plural] of cases) {
  try {
    assert.deepEqual(numberQueries(singular), [singular, plural]);
    assert.deepEqual(numberQueries(plural), [plural, singular]);
    const spec = { gameId, selectedSource: source, filters: {}, sort: 'relevance' as const };
    const plan = searchPlan({ ...spec, query: singular });
    assert.deepEqual(new Set(plan.map(request => request.query)), new Set([singular, plural]));
    assert.deepEqual(new Set(searchPlan({ ...spec, query: plural }).map(request => request.query)), new Set([singular, plural]));
    assert.equal(new Set(plan.map(bucketKey)).size, 2);
    const settled = await Promise.allSettled(plan.map(async request => {
      const params = new URLSearchParams({ gameId, source, query: request.query, sort: request.sort });
      const response = await fetch(`https://modfinder.pages.dev/v1/search?${params}`, { signal: AbortSignal.timeout(45000) });
      assert.equal(response.status, 200);
      const result = await response.json() as SearchResult;
      assert.ok(['success', 'empty'].includes(result.status), `${source}: ${result.status}`);
      assert.equal(result.source, source);
      assert.ok(result.items.every(item => item.gameId === gameId && item.source === source));
      return result;
    }));
    for (const result of settled) if (result.status === 'rejected') throw result.reason;
    const [first, second] = settled.map(result => (result as PromiseFulfilledResult<SearchResult>).value);
    const firstKeys = new Set(first.items.map(item => item.key));
    const secondKeys = new Set(second.items.map(item => item.key));
    const union = new Set([...firstKeys, ...secondKeys]);
    const merged = appendStable(first.items, second.items);
    assert.deepEqual(new Set(merged.map(item => item.key)), union);
    assert.equal(merged.length, union.size);
    console.log(JSON.stringify({ gameId, source, singular, plural, checkedAt: new Date().toISOString(),
      totals: [first.total, second.total], firstPageCounts: [first.items.length, second.items.length],
      onlySingular: [...firstKeys].filter(key => !secondKeys.has(key)).length,
      onlyPlural: [...secondKeys].filter(key => !firstKeys.has(key)).length,
      combinedFirstPage: merged.length, unionVerified: true }));
  } catch (error) {
    console.error(JSON.stringify({ gameId, source, singular, plural, error: (error as Error).message }));
    process.exitCode = 1;
  }
}
