import { describe, expect, it } from 'vitest';
import review from '../data/search-trends.json';
import { getGame } from '../../src/shared/games';
import { providerQuery } from '../../src/shared/content';
import { localizedQueries, MAX_LOCALIZED_QUERIES } from '../../src/shared/localized-search';
import { searchPlan } from '../../src/shared/search-plan';
import { groupResults, keywordRelevance, sortResultGroups } from '../../src/shared/ranking';
import { numberQueries } from '../../src/shared/search-number-variants';
import type { Listing, Source } from '../../src/shared/types';

describe('reviewed fandom and character search keywords', () => {
  it.each(review.entries)('$gameId forwards the reviewed $term aliases within its provider scope', entry => {
    const game = getGame(entry.gameId)!;
    for (const project of entry.projects) {
      const source = project.source as Source;
      const prefix = `${source}:${game.sources[source]!.scope}:`;
      expect(typeof project.id).toBe('string');
      expect(project.url.startsWith('https://')).toBe(true);
      for (const alias of entry.aliases) {
        expect(providerQuery(alias, [prefix], game.id)).toBe(entry.term);
        const queries = localizedQueries(alias, [prefix], game.id);
        expect(queries).toContain(entry.term);
        expect(queries.length).toBeLessThanOrEqual(MAX_LOCALIZED_QUERIES);
        const requests = searchPlan({ gameId:game.id, selectedSource:source, query:alias, sort:'relevance', filters:{} });
        expect(requests.some(request => request.query === entry.term)).toBe(true);
        expect(requests.every(request => request.source === source && request.gameId === game.id)).toBe(true);
      }
      expect(numberQueries(entry.term)).toEqual([entry.term]);
    }
  });

  it('does not translate unsupported games or extend unknown proper names', () => {
    expect(providerQuery('치이카와', ['nexus:skyrimspecialedition:'], 'skyrim-se')).toBe('치이카와');
    expect(providerQuery('라부부', ['thunderstore:valheim:'], 'valheim')).toBe('라부부');
    expect(providerQuery('치이카와즈', ['modrinth:minecraft:'], 'minecraft-java')).toBe('치이카와즈');
    const requests = searchPlan({ gameId:'all', selectedSource:'all', query:'치이카와', sort:'relevance', filters:{} });
    for (const gameId of ['minecraft-java','stardew-valley','lethal-company']) expect(requests.some(request => request.gameId === gameId && request.query === 'Chiikawa')).toBe(true);
    expect(requests.filter(request => request.gameId === 'skyrim-se').every(request => request.query !== 'Chiikawa')).toBe(true);
  });

  it('ranks actual character terms ahead of substrings and keeps provider IDs and explicit sorting', () => {
    const item = (id:string, title:string, summary:string, rank:number):Listing => ({ key:`thunderstore:riskofrain2:${id}`, source:'thunderstore', scope:'riskofrain2', id, gameId:'risk-of-rain-2', title, summary, rank, author:null, url:'https://thunderstore.io/', iconUrl:null, updatedAt:null, versions:null, loaders:null, kind:null, metrics:[], tags:[], fetchedAt:'' });
    const unrelated = item('unrelated', 'Chumikusiek Sound Pack', 'An unrelated sound pack', 1);
    const related = item('Dannyduartemgs-Hatsune_Miku', 'Hatsune_Miku', 'Hatsune Miku Artificer skin', 50);
    expect(keywordRelevance(unrelated, '미쿠').coverage).toBe(0);
    expect(groupResults([unrelated,related], '미쿠')[0].listings[0].key).toBe(related.key);
    expect(groupResults([related,{...related,key:'thunderstore:riskofrain2:other',id:'other'}], '미쿠')).toHaveLength(2);
    expect(sortResultGroups(groupResults([unrelated,related], '미쿠'), 'popular')[0].listings[0].key).toBe(unrelated.key);
  });
});
