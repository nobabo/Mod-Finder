import { describe, expect, it } from 'vitest';
import { GAMES } from '../../src/shared/games';
import { modTranslations } from '../../src/shared/content';
import { communityRanking } from '../../src/shared/community-snapshots';
import packNames from '../../src/shared/data/community-pack-names.ko.json';
import { localizedQueries, MAX_LOCALIZED_QUERIES } from '../../src/shared/localized-search';
import { bucketKey, searchPlan, type SearchSpec } from '../../src/shared/search-plan';
import { runSearchWithCorrections } from '../../src/shared/search-corrections';
import { cursorFor, readCursor, mapCurseforge } from '../../src/server/adapters';
import { appendStable, groupResults } from '../../src/shared/ranking';

const spec: SearchSpec = { gameId: 'minecraft-java', selectedSource: 'curseforge', query: '디시즈', filters: {}, sort: 'relevance' };
describe('localized ranking search', () => {
  it('covers every translated download title and every displayed community ranking title across all games', () => {
    for (const game of GAMES) {
      for (const [source, mapping] of Object.entries(game.sources)) {
        const prefix = `${source}:${mapping.scope}:`;
        for (const [key, entry] of Object.entries(modTranslations).filter(([key]) => key.startsWith(prefix))) {
          expect(localizedQueries(entry.title!, [prefix], game.id), key).toContain(entry.searchTerm);
          if (/[가-힣]/.test(entry.title!)) expect(localizedQueries(entry.title!.replace(/\s/g, ''), [prefix], game.id), key).toContain(entry.searchTerm);
        }
        for (const entry of communityRanking(game.id)?.entries ?? []) {
          const title = entry.koreanName ?? (game.id === 'minecraft-java' ? (packNames as Record<string, string>)[entry.id] : undefined) ?? entry.name;
          expect(localizedQueries(title, [prefix], game.id), `${game.id}:${title}`).toContain(entry.name);
        }
      }
    }
  });
  it.each([
    ['minecraft-java', 'curseforge:432:', '디시즈', 'DeceasedCraft'],
    ['minecraft-java', 'curseforge:432:', '좀비', 'DeceasedCraft'],
    ['minecraft-java', 'curseforge:432:', '아포칼립스', 'DeceasedCraft'],
    ['stardew-valley', 'nexus:stardewvalley:', '대확장', 'Stardew Valley Expanded'],
    ['lethal-company', 'thunderstore:lethal-company:', '검시관', 'Coroner'],
    ['terraria', 'steam:1281930:', '칼라미', 'Calamity Mod'],
  ])('expands %s %s %s to a provider search', (game, prefix, query, term) => {
    expect(localizedQueries(query, [prefix], game)).toContain(term);
  });
  it('keeps broad searches, scope, compatibility filters, category and independent cursors', () => {
    const requests = searchPlan({ ...spec, query: '좀비', filters: { kind: 'modpack', version: '1.20.1', loader: 'forge' } });
    expect(requests.map(r => r.query)).toContain('zombie');
    expect(requests.map(r => r.query)).toContain('DeceasedCraft');
    expect(new Set(requests.map(bucketKey)).size).toBe(requests.length);
    for (const request of requests) {
      expect(request).toMatchObject({ gameId: spec.gameId, source: 'curseforge', sort: 'relevance', filters: { kind: 'modpack', version: '1.20.1', loader: 'forge' } });
      expect(readCursor({ ...request, cursor: cursorFor(request, 20) })).toBe(20);
    }
    expect(() => readCursor({ ...requests[1], cursor: cursorFor(requests[0], 20) })).toThrow('invalid_cursor');
    const categorized = searchPlan({ ...spec, selectedSource: 'all', filters: { category: 'modrinth:adventure' } });
    expect(categorized.length).toBeGreaterThan(0);
    expect(categorized.every(r => r.source === 'modrinth' && r.filters.category === 'modrinth:adventure')).toBe(true);
    expect(localizedQueries('디시즈', ['nexus:stardewvalley:'], 'stardew-valley')).toEqual(['디시즈']);
    expect(localizedQueries('최적화', ['steam:1281930:'], 'terraria')).not.toContain('Sodium');
    expect(localizedQueries('모드', ['steam:1281930:'], 'terraria').length).toBeLessThanOrEqual(MAX_LOCALIZED_QUERIES);
    expect(searchPlan({ ...spec, query: '' })).toHaveLength(1);
  });
  it('runs supplemental searches even if the ordinary query succeeds, and deduplicates only by source ID', async () => {
    const queried: string[] = [];
    await runSearchWithCorrections({ ...spec, query: '좀비' }, async request => {
      queried.push(request.query);
      return { hasItems: true, empty: false };
    }, new AbortController().signal, () => {});
    expect(queried).toContain('zombie');
    expect(queried).toContain('DeceasedCraft');
    const pack = mapCurseforge({ id: 490660, name: 'DeceasedCraft - Urban Zombie Apocalypse', classId: 4471, summary: 'Zombie apocalypse', links: { websiteUrl: 'https://www.curseforge.com/minecraft/modpacks/deceasedcraft' } }, GAMES[0], 16);
    const other = { ...pack, key: 'curseforge:432:other', id: 'other', title: 'Other zombie pack', rank: 1 };
    expect(appendStable([pack], [pack, other])).toHaveLength(2);
    expect(groupResults([other, pack], '디시즈')[0].listings[0].key).toBe(pack.key);
    expect(pack.metrics).toEqual([]);
    expect(pack.versions).toBeNull();
  });
});
