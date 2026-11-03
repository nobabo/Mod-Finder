import { describe, expect, it } from 'vitest';
import fixtures from '../data/search-relevance-cases.json';
import { groupResults, keywordRelevance, sortResultGroups } from '../../src/shared/ranking';
import { containsSearchTerm, searchKeywords } from '../../src/shared/search-keywords';
import { searchPlan } from '../../src/shared/search-plan';
import { mapModrinth } from '../../src/server/adapters';
import { GAMES } from '../../src/shared/games';

const listing = (item: typeof fixtures[number]['items'][number]) => ({
  ...mapModrinth({ project_id: item.id, title: item.title, description: item.summary }, GAMES[0], item.rank), tags: item.tags,
});

describe('keyword coverage relevance shared with Android', () => {
  it.each(fixtures)('ranks distinct keyword coverage for $query', fixture => {
    expect(groupResults(fixture.items.map(listing), fixture.query).map(group => group.listings[0].id)).toEqual(fixture.expected);
  });

  it('does not reward repeated words, aliases or repeated tags', () => {
    const item = listing({ id: 'a', title: 'Cow', summary: 'Pigs', tags: ['cow'], rank: 1 });
    expect(keywordRelevance(item, '소 돼지')).toEqual(keywordRelevance(item, '소 cow cows 돼지 pig pigs'));
    expect(keywordRelevance(item, 'cow pig')).toEqual(keywordRelevance({ ...item, title: 'Cow cow cow', summary: 'Pigs pigs pigs', tags: ['cow', 'cow', 'cows'] }, 'cow pig'));
  });

  it('keeps single-word and translated multi-word titles intact, while bounding compound searches', () => {
    expect(searchKeywords('All the Mods 10', 'minecraft-java')).toEqual([]);
    expect(searchKeywords('동적 광원', 'minecraft-java')).toEqual([]);
    expect(searchKeywords('소 돼지', 'minecraft-java').map(concept => concept.term)).toEqual(['cow', 'pig']);
    expect(searchKeywords('unknown pig', 'minecraft-java')).toEqual([]);
    expect(searchKeywords('cow pig cow pig', 'minecraft-java')).toHaveLength(2);
    const requests = searchPlan({ gameId: 'minecraft-java', selectedSource: 'modrinth', query: '소 돼지', filters: { kind: 'mod', loader: 'fabric' }, sort: 'relevance' });
    expect(requests.map(request => request.query)).toEqual(['cow pig', 'cow', 'cows', 'pig', 'pigs']);
    expect(requests.every(request => request.filters.loader === 'fabric' && request.filters.kind === 'mod')).toBe(true);
    expect(containsSearchTerm('piglin and coward', 'pig')).toBe(false);
    expect(containsSearchTerm('소듐', '소')).toBe(false);
    expect(containsSearchTerm('소를 추가합니다', '소')).toBe(true);
  });

  it('preserves download, update and popularity choices and the relevance direction', () => {
    const groups = groupResults(fixtures[0].items.map(listing).map((item, index) => ({ ...item, metrics: [{ label: '다운로드', value: index }], updatedAt: `2026-10-${20 + index}` })), fixtures[0].query);
    for (const sort of ['downloads', 'updated'] as const) expect(sortResultGroups(groups, sort)[0].listings[0].id).toBe('unrelated');
    expect(sortResultGroups(groups, 'popular')[0].listings[0].rank).toBe(1);
    expect(sortResultGroups(groups, 'relevance', false, 'asc').map(group => group.id)).toEqual(groups.map(group => group.id).reverse());
  });
});
