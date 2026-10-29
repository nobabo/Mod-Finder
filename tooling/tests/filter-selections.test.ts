import { describe, expect, it } from 'vitest';
import { toggleFilter } from '../../src/shared/filter-selections';
import { bucketKey, searchPlan, sourceBucketKey, type SearchSpec } from '../../src/shared/search-plan';
import { runSearchWithCorrections } from '../../src/shared/search-corrections';
import type { SearchRequest } from '../../src/shared/types';

const spec: SearchSpec = { gameId:'minecraft-java', query:'', selectedSource:'modrinth', sort:'downloads', filters:{} };

describe('multiple Minecraft filter selections', () => {
  it('adds and removes values independently, clearing only the requested filter', () => {
    const selected = toggleFilter({ version:'1.21.1', loader:'fabric', kind:'mod' }, 'loader', 'forge');
    expect(selected).toEqual({ version:'1.21.1', loader:['fabric','forge'], kind:'mod' });
    expect(toggleFilter(selected, 'loader', 'fabric')).toEqual({ version:'1.21.1', loader:'forge', kind:'mod' });
    expect(toggleFilter(selected, 'loader', '')).toEqual({ version:'1.21.1', kind:'mod' });
    expect(toggleFilter({ loader:'fabric' }, 'loader', 'fabric')).toEqual({});
  });

  it('searches all selected combinations without duplicating provider requests', () => {
    const requests = searchPlan({ ...spec, filters:{ version:['1.21.1','1.20.1','1.21.1'], loader:['fabric','forge'], kind:['mod','modpack'] } });
    expect(requests).toHaveLength(8);
    expect(new Set(requests.map(bucketKey)).size).toBe(8);
    expect(requests.map(request => request.filters)).toEqual([
      { version:'1.21.1', loader:'fabric', kind:'mod' }, { version:'1.21.1', loader:'fabric', kind:'modpack' },
      { version:'1.21.1', loader:'forge', kind:'mod' }, { version:'1.21.1', loader:'forge', kind:'modpack' },
      { version:'1.20.1', loader:'fabric', kind:'mod' }, { version:'1.20.1', loader:'fabric', kind:'modpack' },
      { version:'1.20.1', loader:'forge', kind:'mod' }, { version:'1.20.1', loader:'forge', kind:'modpack' },
    ]);
    for (const request of requests) expect(bucketKey({ ...request, cursor:'next-page' } as SearchRequest)).toBe(bucketKey(request));
  });

  it('keeps category/source scoping and ignores Minecraft selections in global searches', () => {
    const requests = searchPlan({ ...spec, selectedSource:'all', categories:['modrinth:optimization'], filters:{ loader:['fabric','forge'] } });
    expect(requests).toHaveLength(2);
    expect(requests.every(request => request.source === 'modrinth' && request.filters.category === 'modrinth:optimization')).toBe(true);
    const global = searchPlan({ ...spec, gameId:'all', filters:{ loader:['fabric','forge'] } });
    expect(global).toEqual(searchPlan({ ...spec, gameId:'all' }));
  });

  it('does not let a successful combination suppress another combination’s empty-source fallback', async () => {
    const seen: SearchRequest[] = [];
    await runSearchWithCorrections({ ...spec, query:'sodum', filters:{ loader:['fabric','forge'] } }, async request => {
      seen.push(request);
      const hasItems = request.filters.loader === 'fabric' || request.query.toLowerCase() === 'sodium';
      return { hasItems, empty:!hasItems };
    }, new AbortController().signal, () => {});
    expect(seen.some(request => request.filters.loader === 'forge' && request.query.toLowerCase() === 'sodium')).toBe(true);
    expect(seen.some(request => request.filters.loader === 'fabric' && request.query.toLowerCase() === 'sodium')).toBe(false);
    expect(new Set(seen.map(sourceBucketKey)).size).toBe(2);
  });
});
