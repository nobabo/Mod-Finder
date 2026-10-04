import { describe, expect, it } from 'vitest';
import { numberQueries } from '../../src/shared/search-number-variants';
import { searchPlan, bucketKey, type SearchSpec } from '../../src/shared/search-plan';
import { runSearchWithCorrections } from '../../src/shared/search-corrections';
import { appendStable, matchPriority } from '../../src/shared/ranking';
import { mapModrinth } from '../../src/server/adapters';
import { GAMES } from '../../src/shared/games';
import type { SearchRequest } from '../../src/shared/types';

describe('English singular and plural searches', () => {
  it.each([
    ['Zombie', ['Zombie', 'zombies']], ['Zombies', ['Zombies', 'zombie']],
    ['enemy', ['enemy', 'enemies']], ['enemies', ['enemies', 'enemy']],
    ['boss', ['boss', 'bosses']], ['bosses', ['bosses', 'boss']],
    ['class', ['class', 'classes']], ['cities', ['cities', 'city']],
    [' bus ', [' bus ', 'buses']], ['libraries', ['libraries', 'library']],
    ['weapon', ['weapon', 'weapons']], ['companions', ['companions', 'companion']],
    ['spell', ['spell', 'spells']], ['vehicles', ['vehicles', 'vehicle']],
    ['chest', ['chest', 'chests']], ['crops', ['crops', 'crop']],
    ['knife', ['knife', 'knives']], ['wolves', ['wolves', 'wolf']],
    ['leaf', ['leaf', 'leaves']], ['children', ['children', 'child']],
    ['person', ['person', 'people']],
  ])('searches both number forms for %s', (query, expected) => {
    expect(numberQueries(query)).toEqual(expected);
  });
  it.each(['Iris', 'Nemesis', 'SMAPI', 'Sodium', 'All the Mods 10', 'Zombie Apocalypse', 'zombie-mod', 'Glass', 'news', 'zombiez', '좀비', ''])('preserves titles and unknown words: %s', query => {
    expect(numberQueries(query)).toEqual([query]);
  });
  const spec: SearchSpec = { gameId: 'minecraft-java', query: '좀비', selectedSource: 'modrinth', filters: { kind: 'modpack', loader: 'forge' }, sort: 'downloads' };
  it.each(['좀비', 'Zombie', 'Zombies'])('plans both queries after translation, preserving filters: %s', query => {
    const requests = searchPlan({ ...spec, query });
    expect(requests.map(request => request.query.toLowerCase())).toEqual(expect.arrayContaining(['zombie', 'zombies']));
    expect(requests.every(request => request.gameId === spec.gameId && request.source === 'modrinth' && request.filters === spec.filters && request.sort === 'downloads')).toBe(true);
    expect(new Set(requests.map(bucketKey)).size).toBe(requests.length);
    expect(bucketKey({ ...requests[0], cursor: 'next-page' } as SearchRequest)).toBe(bucketKey(requests[0]));
  });
  it('runs both number forms even when the first already found results', async () => {
    const queries: string[] = [];
    await runSearchWithCorrections({ ...spec, query: 'Zombies' }, async request => {
      queries.push(request.query);
      return { hasItems: true, empty: false };
    }, new AbortController().signal, () => {});
    expect(queries).toEqual(['Zombies', 'zombie']);
  });
  it('retains results from a healthy variant when the other fails', async () => {
    const requests: SearchRequest[] = [];
    await runSearchWithCorrections({ ...spec, query: 'Zombie' }, async request => {
      requests.push(request);
      return request.query === 'Zombie' ? undefined : { hasItems: true, empty: false };
    }, new AbortController().signal, () => {});
    expect(requests.map(request => request.query)).toEqual(['Zombie', 'zombies']);
  });
  it('combines overlapping result pages by source ID, retaining distinct same-title projects', () => {
    const listing = (id: string) => mapModrinth({ project_id: id, title: 'Zombie Pack', description: 'Zombies' }, GAMES[0], 1);
    const merged = appendStable([listing('same')], [listing('same'), listing('other')]);
    expect(merged.map(item => item.id)).toEqual(['same', 'other']);
  });
  it('scores singular and plural results as relevant in either direction', () => {
    const item = mapModrinth({ project_id: 'variant-test', title: 'Zombie Adventure', description: 'A zombie apocalypse' }, GAMES[0], 1);
    expect(matchPriority(item, 'Zombies')).toBe(0);
    expect(matchPriority({ ...item, title: 'Enemy Overhaul', summary: 'New enemies' }, 'Enemies')).toBe(0);
  });
});
