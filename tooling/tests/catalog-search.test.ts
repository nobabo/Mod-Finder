import { describe, expect, it, vi } from 'vitest';
import { GAMES, GENRES, findGames } from '../../src/shared/games';
import { listingText, modTranslations, providerQuery, tagText } from '../../src/shared/content';
import { searchPlan, bucketKey, sourceBucketKey, runSearchQueue, type SearchSpec } from '../../src/shared/search-plan';
import { groupResults } from '../../src/shared/ranking';
import verified from '../../src/shared/data/verified-projects.json';
import { mapModrinth } from '../../src/server/adapters';
import { parseLocalData } from '../../src/web/lib/storage';
import gameSearchKo from '../../src/shared/locales/search.games.ko.json';

const spec: SearchSpec = { gameId: 'all', genre: 'all', query: 'Sodium', selectedSource: 'all', filters: {}, sort: 'relevance' };
const sodium = () => mapModrinth({ project_id: 'AANobbMI', title: 'Sodium', description: 'Original summary' }, GAMES[0], 1);
describe('catalog and global search', () => {
  it('plans keyword-free browsing with the selected scope, filters and sort', () => {
    const requests = searchPlan({ ...spec, gameId: 'minecraft-java', query: '', selectedSource: 'modrinth', sort: 'downloads', filters: { loader: 'fabric', version: '1.21.1' } });
    expect(requests).toEqual([{ gameId: 'minecraft-java', source: 'modrinth', query: '', sort: 'downloads', filters: { loader: 'fabric', version: '1.21.1' } }]);
    const global = searchPlan({ ...spec, genre: 'survival', query: '', selectedSource: 'steam', sort: 'popular' });
    expect(global.length).toBeGreaterThan(1);
    expect(global.every(request => request.query === '' && request.sort === 'popular' && request.source === 'steam' && findGames('', 'survival').some(game => game.id === request.gameId))).toBe(true);
  });
  it('searches every configured game/source pair exactly once', () => {
    const plan = searchPlan(spec);
    expect(plan).toHaveLength(GAMES.reduce((n, g) => n + Object.keys(g.sources).length, 0));
    expect(new Set(plan.map(bucketKey)).size).toBe(plan.length);
    expect(new Set(GAMES.map(g => g.id)).size).toBe(GAMES.length);
    for (const game of GAMES) {
      expect(game.genres.length).toBeGreaterThan(0);
      expect(game.genres.every(id => GENRES.some(g => g.id === id))).toBe(true);
      for (const mapping of Object.values(game.sources)) expect(typeof mapping?.scope).toBe('string');
    }
  });
  it('narrows genres and sources without forwarding Minecraft filters across games', () => {
    const plan = searchPlan({ ...spec, genre: 'survival', selectedSource: 'steam', filters: { loader: 'fabric' } });
    expect(plan.length).toBeGreaterThan(1);
    expect(plan.every(p => p.source === 'steam' && findGames('', 'survival').some(g => g.id === p.gameId) && !Object.keys(p.filters).length)).toBe(true);
    expect(searchPlan({ ...spec, gameId: 'minecraft-java', filters: { loader: 'fabric' } }).every(p => p.filters.loader === 'fabric')).toBe(true);
    expect(searchPlan({ ...spec, query: ' ' }).map(sourceBucketKey)).toEqual(searchPlan(spec).map(sourceBucketKey));
    expect(findGames('좀보이드')[0].id).toBe('project-zomboid');
    expect(GAMES.find(g => g.id === 'terraria')?.sources.steam?.scope).toBe('1281930');
  });
  it('preserves all-game searches when restoring saved data', () => {
    const data = { favorites: [], compared: [], favoriteGames: [], history: [{ gameId: 'all', query: 'Sodium' }] };
    expect(parseLocalData(JSON.stringify(data)).history).toEqual(data.history);
  });
  it('bounds concurrency and does not start queued work after cancellation', async () => {
    const controller = new AbortController();
    let active = 0; let peak = 0;
    const run = vi.fn(async (id: number) => {
      peak = Math.max(peak, ++active);
      await Promise.resolve();
      if (id === 0) controller.abort();
      active--;
    });
    await runSearchQueue([0, 1, 2, 3, 4, 5], run, controller.signal, 2);
    expect(peak).toBe(2); expect(run).toHaveBeenCalledTimes(2);
  });
  it('finishes other results when a source handles a failure', async () => {
    const seen: number[] = [];
    await runSearchQueue([1, 2, 3], async id => { try { if (id === 2) throw new Error('upstream'); seen.push(id); } catch { /* reported by caller */ } }, new AbortController().signal);
    expect(seen).toEqual([1, 3]);
  });
});
describe('localized content and verified duplicates', () => {
  it('keeps ranking translations tied to source IDs and searches their original names', () => {
    for (const game of GAMES.filter(game => game.id !== 'minecraft-java')) {
      const prefixes = Object.entries(game.sources).map(([source, mapping]) => `${source}:${mapping.scope}:`);
      const entries = Object.entries(modTranslations).filter(([key]) => prefixes.some(prefix => key.startsWith(prefix)));
      expect(entries.length, game.id).toBeGreaterThanOrEqual(30);
      for (const [key, entry] of entries) {
        const original = { ...sodium(), key, gameId: game.id, title: entry.searchTerm };
        expect(listingText(original, 'ko').title).toBe(entry.title);
        expect(listingText(original, 'en').title).toBe(entry.searchTerm);
        expect(original.title).toBe(entry.searchTerm);
        expect(providerQuery(entry.title!, [key.slice(0, key.lastIndexOf(':') + 1)], game.id), key).toBe(entry.searchTerm);
        expect(listingText({ ...original, key: `${key}-unknown` }, 'ko').title).toBe(entry.searchTerm);
      }
    }
    const sameName = { ...sodium(), title: 'Content Patcher' };
    expect(listingText({ ...sameName, key: 'nexus:stardewvalley:1915' }, 'ko').title).toBe('콘텐츠 패처');
    expect(listingText({ ...sameName, key: 'nexus:skyrimspecialedition:1915' }, 'ko').title).toBe('Content Patcher');
  });
  it('overlays Korean text without overwriting original data or unknown fields', () => {
    const item = sodium();
    expect(listingText(item, 'ko').title).toBe('소듐 (Sodium)');
    expect(listingText(item, 'en').summary).toBe('Original summary');
    expect(item.title).toBe('Sodium'); expect(item.versions).toBeNull();
    expect(listingText({ ...item, key: 'modrinth:minecraft:unknown' }, 'ko').summary).toBe('Original summary');
    expect(providerQuery('소듐', ['modrinth:minecraft:'], 'minecraft-java')).toBe('Sodium');
    expect(providerQuery('소듐', ['nexus:stardewvalley:'], 'stardew-valley')).toBe('소듐');
  });
  it('keeps Minecraft modpack searches on the remaining configured sources', () => {
    const minecraft = { ...spec, gameId: 'minecraft-java' };
    expect(searchPlan(minecraft).map(request => request.source)).toEqual(['modrinth', 'curseforge']);
    expect(searchPlan({ ...minecraft, filters: { kind: 'modpack' } }).map(request => request.source)).toEqual(['modrinth', 'curseforge']);
  });
  it('translates known result tags only in Korean and preserves unknown names', () => {
    expect(tagText('Gameplay', 'ko')).toBe('게임플레이');
    expect(tagText('quality of life', 'ko')).toBe('편의성');
    expect(tagText('Gameplay', 'en')).toBe('Gameplay');
    expect(tagText('BepInEx', 'ko')).toBe('베핀엑스');
    expect(tagText('bepinex', 'ko')).toBe('베핀엑스');
    expect(tagText('BepInEx', 'en')).toBe('BepInEx');
    expect(tagText('UnknownLoader', 'ko')).toBe('UnknownLoader');
  });
  it('forwards exact Korean search terms in English while leaving other queries untouched', () => {
    const koreanSpec = { ...spec, gameId: 'minecraft-java', query: '  편의성  ' };
    expect(searchPlan(koreanSpec).map(request => request.query)).toEqual(['quality of life', 'quality of life']);
    expect(koreanSpec.query).toBe('  편의성  ');
    expect(providerQuery('셰이더', ['modrinth:minecraft:'], 'minecraft-java')).toBe('shader');
    expect(providerQuery('쉐이더', ['modrinth:minecraft:'], 'minecraft-java')).toBe('shader');
    expect(providerQuery('편의성 모드', ['modrinth:minecraft:'], 'minecraft-java')).toBe('편의성 모드');
    expect(providerQuery('constructor', ['modrinth:minecraft:'], 'minecraft-java')).toBe('constructor');
    expect(providerQuery('소듐', ['modrinth:minecraft:'], 'minecraft-java')).toBe('Sodium');
  });
  it('uses game-specific search terms before shared terms across every source', () => {
    expect(Object.keys(gameSearchKo).sort()).toEqual(GAMES.map(game => game.id).sort());
    const forwarded = (gameId: string, query: string) => [...new Set(searchPlan({ ...spec, gameId, query }).map(request => request.query))];
    expect(forwarded('minecraft-java', '패브릭')).toContain('fabric');
    expect(forwarded('rimworld', '패브릭')).toEqual(['패브릭']);
    expect(forwarded('skyrim-se', '동료')).toContain('follower');
    expect(forwarded('fallout-4', '동료')).toContain('companion');
    expect(forwarded('minecraft-java', '동료')).toContain('companions');
    expect(forwarded('minecraft-java', '시야')).toEqual(['view']);
    expect(forwarded('lethal-company', '시야')).toEqual(['vision']);
    expect(forwarded('cities-skylines', '시야')).toEqual(['camera']);
    const allGames = searchPlan({ ...spec, query: '패브릭' });
    expect(allGames.filter(request => request.gameId === 'minecraft-java').some(request => request.query === 'fabric')).toBe(true);
    expect(allGames.find(request => request.gameId === 'rimworld')?.query).toBe('패브릭');
  });
  it('groups real cross-site IDs only when evidence exists, never by translated title', () => {
    const a = sodium(); const b = { ...a, key: 'curseforge:432:394468', source: 'curseforge' as const, scope: '432', id: '394468' };
    expect(groupResults([a, a, b], '', verified)).toHaveLength(1);
    expect(groupResults([a, { ...b, key: 'curseforge:432:other' }], '', verified)).toHaveLength(2);
    expect(groupResults([a, { ...b, gameId: 'terraria' }], '', verified)).toHaveLength(2);
  });
  it('merges overlapping evidence transitively and retains each distinct source listing', () => {
    const a = sodium(); const b = { ...a, key: 'b' }; const c = { ...a, key: 'c' };
    const links = [{ projectId: 'ab', listingKeys: [a.key, b.key], evidenceUrl: 'https://example.com/a' }, { projectId: 'bc', listingKeys: [b.key, c.key], evidenceUrl: 'https://example.com/b' }];
    expect(groupResults([a, b, c, a], '', links)[0].listings).toHaveLength(3);
  });
});

it.each(['downloads','popular'] as const)('preserves %s sorting across all sources', sort => {
  const requests = searchPlan({ ...spec, sort });
  expect(requests.length).toBeGreaterThan(0);
  expect(requests.every(request => request.sort === sort)).toBe(true);
});
