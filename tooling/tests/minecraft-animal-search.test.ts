import { describe, expect, it } from 'vitest';
import { providerQuery } from '../../src/shared/content';
import { localizedQueries, MAX_LOCALIZED_QUERIES } from '../../src/shared/localized-search';
import { searchPlan, bucketKey, type SearchSpec } from '../../src/shared/search-plan';
import { nativeSearchPlan } from '../../src/shared/search-corrections';
import { createApi } from '../../src/server/api';
import { readConfig } from '../../src/server/config';

const spec: SearchSpec = { gameId: 'minecraft-java', selectedSource: 'all', query: '', filters: { kind: 'mod', loader: 'forge', version: '1.20.1' }, sort: 'relevance' };

describe('Minecraft Korean animal searches', () => {
  it.each([['닭', 'chicken'], ['오리', 'duck'], ['소', 'cow'], ['양', 'sheep'], ['말', 'horse'], ['거위', 'goose'], ['돼지', 'pig'], ['늑대', 'wolf']])('translates the animal keyword %s without changing other games', (query, term) => {
    expect(providerQuery(query, ['modrinth:minecraft:'], 'minecraft-java')).toBe(term);
    expect(providerQuery(query, ['nexus:skyrimspecialedition:'], 'skyrim-se')).toBe(query);
  });

  it.each(['modrinth:minecraft:', 'curseforge:432:'])('keeps broad duck searches and relevant curated hints within %s', prefix => {
    const queries = localizedQueries('오리', [prefix], spec.gameId);
    expect(queries).toEqual(expect.arrayContaining(['duck', 'Duckling', 'Untitled Duck Mod']));
    for (const unrelated of ['Oritech', 'OriginsSMP', 'Day Counter (Original)']) expect(queries).not.toContain(unrelated);
    expect(queries.length).toBeLessThanOrEqual(MAX_LOCALIZED_QUERIES);
    expect(localizedQueries('덕클링', [prefix], spec.gameId)).toEqual(['Duckling']);
  });

  it.each(['닭', '오리'])('shares animal queries and plural forms with Android while retaining compatibility and cursor scopes: %s', query => {
    const requests = searchPlan({ ...spec, query });
    const terms = query === '닭' ? ['chicken', 'chickens', 'Modern Chickens', 'Roost Ultimate'] : ['duck', 'ducks', 'Duckling', 'Untitled Duck Mod'];
    for (const source of ['modrinth', 'curseforge']) {
      expect(requests.filter(request => request.source === source).map(request => request.query)).toEqual(expect.arrayContaining(terms));
    }
    expect(requests.every(request => request.gameId === spec.gameId && request.filters === spec.filters && request.sort === spec.sort)).toBe(true);
    expect(new Set(requests.map(bucketKey)).size).toBe(requests.length);
    expect(nativeSearchPlan({ ...spec, query }).original).toEqual(requests);
  });

  it('does not expand unknown single syllables or invent cross-provider aliases', () => {
    expect(localizedQueries('쀍', ['curseforge:432:'], spec.gameId)).toEqual(['쀍']);
    expect(localizedQueries('루스트', ['curseforge:432:'], spec.gameId)).toEqual(['Roost']);
    expect(localizedQueries('루스트', ['steam:1281930:'], 'terraria')).toEqual(['루스트']);
  });

  it.each(['닭', '오리'])('serves the same animal plan to native clients through the API: %s', async query => {
    const api = createApi(readConfig({}));
    const response = await api(new Request('https://example.test/v1/search-plan?' + new URLSearchParams({ gameId: spec.gameId, query, kind: 'mod', loader: 'forge', version: '1.20.1' })));
    expect(response.status).toBe(200);
    const plan = await response.json() as ReturnType<typeof nativeSearchPlan>;
    expect(plan.original).toEqual(searchPlan({ ...spec, query }));
  });
});
