import { describe, expect, it, vi } from 'vitest';
import { createFuzzyMatcher, fuzzyQueries } from '../../src/shared/search-fuzzy';
import { runSearchWithCorrections } from '../../src/shared/search-corrections';
import { bucketKey, type SearchSpec } from '../../src/shared/search-plan';
import type { SearchRequest } from '../../src/shared/types';

const empty = { hasItems: false, empty: true };
const success = { hasItems: true, empty: false };
const spec: SearchSpec = { gameId: 'minecraft-java', selectedSource: 'modrinth', query: '소듕',
  filters: { loader: 'fabric', version: '1.21.1' }, sort: 'downloads' };

describe('scoped fuzzy search', () => {
  it.each(['소듕', '소듕'.normalize('NFD'), '소 듕', 'Sodiuum', 'Sodum'])('finds a known mod from %s', query => {
    expect(fuzzyQueries(query, 'minecraft-java', 'modrinth')).toEqual(['Sodium']);
  });
  it('uses Korean keyword aliases and game-specific names', () => {
    expect(fuzzyQueries('인벤토라', 'minecraft-java', 'modrinth')).toEqual(['inventory']);
    expect(fuzzyQueries('DeceasdCraft', 'minecraft-java', 'curseforge')).toEqual(['DeceasedCraft']);
    expect(fuzzyQueries('Calamty', 'terraria', 'steam')).toEqual(['Calamity']);
    expect(fuzzyQueries('소듕', 'stardew-valley', 'nexus')).toEqual([]);
    expect(fuzzyQueries('Calamty', 'minecraft-java', 'modrinth')).toEqual([]);
    expect(fuzzyQueries('소듕', 'minecraft-java', 'nexus')).toEqual([]);
  });
  it.each(['소듐', 'Sodium', 'Iris', 'SMAPI', '그뉴호', '', 'SMA', 'zzqvxxzz', 'a'.repeat(200)])('does not guess for %s', query => {
    expect(fuzzyQueries(query, 'minecraft-java', 'modrinth')).toEqual([]);
  });
  it('rejects competing meanings, while deduplicating aliases for one search term', () => {
    const aliases = [{ name: 'Battles', term: 'Battle Mod' }, { name: 'Bottles', term: 'Bottle Mod' }];
    expect(createFuzzyMatcher(aliases)('Bettles')).toEqual([]);
    expect(createFuzzyMatcher(aliases.map(entry => ({ ...entry, term: 'Same Mod' })))('Bettles')).toEqual(['Same Mod']);
  });
  it('does not turn partial names or other version numbers into corrections', () => {
    const match = createFuzzyMatcher([{ name: 'All the Mods 10', term: 'All the Mods 10' }, { name: 'Sodium Extra', term: 'Sodium Extra' }]);
    expect(match('All the Mods 11')).toEqual([]);
    expect(match('Sodium')).toEqual([]);
    expect(match('All the Mdos 10')).toEqual(['All the Mods 10']);
  });
  it('retries a Korean typo after literal and keyboard searches finish empty, preserving filters', async () => {
    const requests: SearchRequest[] = [];
    await runSearchWithCorrections(spec, async request => {
      requests.push(request);
      return request.query === 'Sodium' ? success : empty;
    }, new AbortController().signal, () => {});
    expect(requests[0].query).toBe('소듕');
    expect(requests.at(-1)?.query).toBe('Sodium');
    expect(requests).toHaveLength(3);
    expect(new Set(requests.map(bucketKey)).size).toBe(requests.length);
    expect(requests.every(request => request.gameId === spec.gameId && request.source === 'modrinth'
      && request.filters === spec.filters && request.sort === spec.sort)).toBe(true);
  });
  it.each([success, { hasItems: false, empty: false }, undefined])('skips guesses after success or an unavailable provider: %j', async outcome => {
    const run = vi.fn(async () => outcome);
    await runSearchWithCorrections(spec, run, new AbortController().signal, () => {});
    expect(run).toHaveBeenCalledTimes(1);
  });
  it('uses curated spelling corrections before fuzzy matches', async () => {
    const queries: string[] = [];
    await runSearchWithCorrections({ ...spec, query: 'soduim' }, async request => {
      queries.push(request.query);
      return request.query === 'sodium' ? success : empty;
    }, new AbortController().signal, () => {});
    expect(queries).toEqual(['soduim', 'sodium']);
  });
  it('preserves another provider’s results while correcting only the empty provider', async () => {
    const requests: SearchRequest[] = [];
    await runSearchWithCorrections({ ...spec, selectedSource: 'all' }, async request => {
      requests.push(request);
      return request.source === 'curseforge' || request.query === 'Sodium' ? success : empty;
    }, new AbortController().signal, () => {});
    expect(requests.filter(request => request.source === 'curseforge').map(request => request.query)).toEqual(['소듕']);
    expect(requests.filter(request => request.source === 'modrinth').map(request => request.query)).toEqual(['소듕', 'Sodium']);
  });
  it('bounds global retries and never sends a Minecraft correction to another game', async () => {
    const requests: SearchRequest[] = [];
    await runSearchWithCorrections({ ...spec, gameId: 'all', selectedSource: 'all' }, async request => {
      requests.push(request); return empty;
    }, new AbortController().signal, () => {});
    const corrected = requests.filter(request => request.query === 'Sodium');
    expect(corrected.length).toBeGreaterThan(0);
    expect(corrected.every(request => request.gameId === 'minecraft-java')).toBe(true);
    expect(new Set(requests.map(bucketKey)).size).toBe(requests.length);
    const buckets = new Map<string, number>();
    for (const request of requests) {
      const key = `${request.gameId}:${request.source}`;
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    expect([...buckets.values()].every(count => count <= 3)).toBe(true);
  });
  it('keeps categories on fuzzy requests and honours cancellation before retry', async () => {
    const requests: SearchRequest[] = [];
    await runSearchWithCorrections({ ...spec, query: 'Sodiuum', categories: ['modrinth:optimization'] }, async request => {
      requests.push(request); return empty;
    }, new AbortController().signal, () => {});
    expect(requests.some(request => request.query === 'Sodium')).toBe(true);
    expect(requests.every(request => request.filters.category === 'modrinth:optimization')).toBe(true);
    const controller = new AbortController();
    const run = vi.fn(async () => { controller.abort(); return empty; });
    await runSearchWithCorrections(spec, run, controller.signal, () => {});
    expect(run).toHaveBeenCalledTimes(1);
  });
});
