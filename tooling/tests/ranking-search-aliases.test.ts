import { describe, expect, it } from 'vitest';
import { providerQuery, modTranslations } from '../../src/shared/content';
import { communityRanking } from '../../src/shared/community-snapshots';
import { GAMES } from '../../src/shared/games';
import { searchPlan, type SearchSpec } from '../../src/shared/search-plan';

const spec: SearchSpec = { gameId: 'all', query: '', filters: {}, sort: 'relevance', selectedSource: 'all' };
describe('ranked Korean search aliases', () => {
  it.each([
    ['minecraft-java', '그뉴호', 'GT New Horizons'],
    ['minecraft-java', '던크래프트', 'DawnCraft'],
    ['stardew-valley', '대확장', 'Stardew Valley Expanded'],
    ['skyrim-se', '레메', 'RaceMenu'],
    ['lethal-company', '리썰립', 'LethalLib'],
    ['rimworld', '컴벳', 'Combat Extended'],
    ['valheim', '와키 에픽 엠엠오', 'WackyEpicMMOSystem'],
    ['terraria', '루이아프크', 'LuiAFK'],
    ['project-zomboid', '차르 라이브러리', "Tsar's Common Library"],
    ['cyberpunk-2077', '아카이브 엑스엘', 'ArchiveXL'],
    ['baldurs-gate-3', '파티 리밋 비곤', 'Party Limit Begone'],
    ['fallout-4', '심셋2', 'Sim Settlements 2'],
    ['risk-of-rain-2', '셰어스위트', 'ShareSuite'],
    ['cities-skylines', '트래픽 매니저', 'Traffic Manager'],
    ['dont-starve-together', '지오메트릭 플레이스먼트', 'Geometric Placement'],
  ])('%s: %s searches the English name', (gameId, query, expected) => {
    expect(searchPlan({ ...spec, gameId, query }).map(request => request.query)).toContain(expected);
  });
  it('connects every translated community ranking name on each configured source', () => {
    for (const game of GAMES) {
      for (const entry of communityRanking(game.id)?.entries ?? []) {
        if (!entry.koreanName || entry.koreanName === entry.name) continue;
        for (const [source, mapping] of Object.entries(game.sources)) {
          const translated = providerQuery(entry.koreanName, [`${source}:${mapping.scope}:`], game.id);
          expect(translated, `${game.id}:${source}:${entry.id}`).not.toBe(entry.koreanName);
        }
      }
    }
  });
  it('tolerates Korean spacing and Unicode composition without using partial regex matches', () => {
    const translate = (query: string) => providerQuery(query, ['nexus:stardewvalley:'], 'stardew-valley');
    expect(translate('  스타듀밸리대확장  ')).toBe('Stardew Valley Expanded');
    expect(translate('스타듀 밸리 대확장'.normalize('NFD'))).toBe('Stardew Valley Expanded');
    expect(translate('대확장 오류 질문')).toBe('대확장 오류 질문');
    expect(providerQuery('모니터', ['modrinth:minecraft:'], 'minecraft-java')).toBe('모니터');
  });
  it('keeps aliases scoped to their game and retains ambiguous source aliases', () => {
    expect(providerQuery('그뉴호', ['steam:294100:'], 'rimworld')).toBe('그뉴호');
    expect(providerQuery('대확장', ['nexus:fallout4:'], 'fallout-4')).toBe('대확장');
    const key = 'modrinth:minecraft:alias-collision-test';
    modTranslations[key] = { searchTerm: 'Other Project', aliases: ['소듐'], sourceUrl: 'https://example.com', reviewedAt: '2026-10-04' };
    try { expect(providerQuery('소듐', ['modrinth:minecraft:'], 'minecraft-java')).toBe('소듐'); }
    finally { delete modTranslations[key]; }
  });
  it('does not resolve spacing collisions arbitrarily', () => {
    const keys = ['modrinth:minecraft:spacing-a', 'modrinth:minecraft:spacing-b'];
    for (const [index, key] of keys.entries()) modTranslations[key] = {
      searchTerm: `Project ${index}`, aliases: [index ? '시험 별칭' : '시험별 칭'], sourceUrl: 'https://example.com', reviewedAt: '2026-10-04',
    };
    try {
      expect(providerQuery('시험별칭', ['modrinth:minecraft:'], 'minecraft-java')).toBe('시험별칭');
      expect(providerQuery('시험 별칭', ['modrinth:minecraft:'], 'minecraft-java')).toBe('Project 1');
    } finally { keys.forEach(key => { delete modTranslations[key]; }); }
  });
});
