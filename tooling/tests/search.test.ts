import { describe, expect, it } from 'vitest';
import { GAMES, findGames, getGame } from '../../src/shared/games';
import { externalSearch, safeExternalUrl } from '../../src/shared/links';
import { appendStable, groupResults, matchPriority, sortResultGroups } from '../../src/shared/ranking';
import { mapModrinth, mapSteam, mapThunderstore, cursorFor, readCursor } from '../../src/server/adapters';
import type { SearchRequest } from '../../src/shared/types';
const request: SearchRequest = { gameId: 'minecraft-java', source: 'modrinth', query: 'Sodium', filters: {}, sort: 'relevance' };
const mod = (id: string, rank = 1) => mapModrinth({ project_id: id, title: 'Sodium', description: 'Renderer', categories: ['fabric'], versions: ['1.21.1'] }, GAMES[0], rank);
describe('identity and relevance', () => {
  it('ranks both fields, title only, then description only regardless of source rank', () => {
    const both = { ...mod('both',100),title:'Sodium Plus',summary:'SODIUM rendering tools' };
    const title = { ...mod('title',1),summary:'' };
    const description = { ...mod('description',1),title:'Rendering Tools',summary:'Supports Sodium' };
    const unrelated = { ...mod('unrelated',1),title:'Tools',summary:'Utility collection' };
    expect(groupResults([unrelated,description,title,both],' sodium ').map(g=>g.listings[0].id)).toEqual(['both','title','description','unrelated']);
    expect(matchPriority({...both,title:'ＳＯＤＩＵＭ'},'sodium')).toBe(0);
    expect(matchPriority(description,'sodium')).toBe(2);
  });
  it('uses translated aliases without conflating separate projects', () => {
    expect(matchPriority({...mod('AANobbMI'),summary:'Sodium renderer'},'소듐')).toBe(0);
    expect(groupResults([mod('a'),mod('b')],'소듐')).toHaveLength(2);
  });
  it('resolves Korean aliases without conflating unsupported editions', () => {
    expect(findGames('스듀').map(g => g.id)).toEqual(['stardew-valley']);
    expect(findGames('bedrock')).toHaveLength(0);
    expect(GAMES.find(g => g.id === 'skyrim-se')?.sources.nexus?.scope).toBe('skyrimspecialedition');
  });
  it('never merges same-title mods without verified evidence', () => expect(groupResults([mod('a'), mod('b')], 'Sodium')).toHaveLength(2));
  it('groups verified links while preserving each source listing', () => {
    const a = mod('a'); const b = mod('b');
    expect(groupResults([a, b], '', [{ projectId: 'verified', listingKeys: [a.key, b.key], evidenceUrl: 'https://modrinth.com/mod/a' }])[0].listings).toHaveLength(2);
  });
  it('keeps already displayed results stable and deduplicates pages', () => {
    const a = mod('a', 9); const b = mod('b', 1);
    expect(appendStable([a], [b, a, b]).map(i => i.id)).toEqual(['a', 'b']);
  });
  it('prefers exact title matches without comparing downloads', () => {
    const exact = { ...mod('a', 15), metrics: [] }; const other = { ...mod('b', 1), title: 'Sodium Extra', metrics: [{ label: '다운로드', value: 999999999 }] };
    expect(groupResults([other, exact], 'sodium')[0].listings[0].id).toBe('a');
  });
  it('preserves uint64 IDs and unknown metadata', () => {
    const item = mapSteam({ publishedfileid: '18446744073709551615', title: 'Test' }, GAMES[4], 1);
    expect(item.id).toBe('18446744073709551615'); expect(item.versions).toBeNull(); expect(item.metrics).toEqual([]);
    expect(() => mapSteam({ publishedfileid: 18446744073709551615, title: 'Lossy' }, GAMES[4], 1)).toThrow();
  });
});
describe('boundaries', () => {
  it.each(['javascript:alert(1)', 'file:///etc/passwd', 'http://modrinth.com/mod/a', 'https://modrinth.com.evil.test/', 'https://user:pass@modrinth.com/', 'https://modrinth.com:444/'])('rejects unsafe URL %s', value => expect(safeExternalUrl(value)).toBeNull());
  it('encodes user input and marks Nexus query as not forwarded', () => {
    const result = externalSearch(GAMES[0], 'modrinth', '한글 & #test');
    expect(new URL(result.url!).searchParams.get('q')).toBe('한글 & #test');
    expect(externalSearch(GAMES[1], 'nexus', 'farm').queryForwarded).toBe(false);
    expect(externalSearch(GAMES[0], 'steam', 'a').url).toBeNull();
  });
  it('binds cursors to the complete search', () => {
    const cursor = cursorFor(request, 20);
    expect(readCursor({ ...request, cursor })).toBe(20);
    expect(() => readCursor({ ...request, query: 'other', cursor })).toThrow('invalid_cursor');
    expect(() => readCursor({ ...request, filters: { loader: 'forge' }, cursor })).toThrow();
    expect(() => readCursor({ ...request, cursor: 'bad' })).toThrow();
    expect(() => readCursor({ ...request, cursor: cursorFor(request, '20') })).toThrow();
  });
});

it('sorts merged pages by downloads, keeping missing metrics after zero', () => {
  const unknown = mod('unknown', 1);
  const zero = { ...mod('zero', 2), metrics:[{ label:'다운로드', value:0 }] };
  const high = { ...mod('high', 3), title:'Sodium Plus', metrics:[{ label:'다운로드', value:100 }] };
  const groups = groupResults(appendStable([unknown,zero],[high]),'Sodium');
  expect(sortResultGroups(groups,'downloads').map(g => g.listings[0].id)).toEqual(['high','zero','unknown']);
  expect(unknown.metrics).toEqual([]);
  expect(sortResultGroups(groups,'popular').map(g => g.listings[0].id)).toEqual(['unknown','zero','high']);
});

it('sorts Steam Workshop results by the displayed lifetime subscriptions', () => {
  const game = getGame('rimworld')!;
  const steam = (id: string, lifetime?: number) => mapSteam({ publishedfileid: id, title: `Mod ${id}`, subscriptions: 999999,
    ...(lifetime === undefined ? {} : { lifetime_subscriptions: lifetime }) }, game, Number(id));
  const groups = groupResults([steam('3', 30), steam('1'), steam('2', 100), steam('4', 0)], '');
  expect(sortResultGroups(groups, 'downloads').map(group => group.listings[0].id)).toEqual(['2', '3', '4', '1']);
  expect(sortResultGroups(groups, 'downloads')[0].listings[0].metrics).toEqual([{ label: '누적 구독자', value: 100 }]);
  expect(sortResultGroups(groups, 'downloads').at(-1)?.listings[0].metrics).toEqual([]);
});

it('promotes known modpacks across Minecraft and other game genres', () => {
  const minecraftMod = { ...mod('popular-mod'), metrics: [{ label: '다운로드', value: 1000 }] };
  const minecraftPack = mapModrinth({ project_id: '581', title: 'SkyFactory One', project_type: 'modpack' }, getGame('minecraft-java')!, 1);
  const lethal = getGame('lethal-company')!;
  const thunderstoreHit = (name: string, category: string, downloads: number) => ({
    namespace: 'Maker', name, community_identifier: 'lethal-company', description: 'Pack search result',
    categories: [{ name: category, slug: category }], download_count: downloads,
  });
  const lethalMod = mapThunderstore(thunderstoreHit('RegularMod', 'mods', 500), lethal, 1);
  const lethalPack = mapThunderstore(thunderstoreHit('Modpack', 'modpacks', 2), lethal, 2);
  const groups = groupResults([minecraftMod, lethalMod, minecraftPack, lethalPack], '');
  expect(sortResultGroups(groups, 'downloads').map(group => group.listings[0].key)).toEqual([
    minecraftMod.key, lethalMod.key, lethalPack.key, minecraftPack.key,
  ]);
  expect(sortResultGroups(groups, 'downloads', true).map(group => group.listings[0].key)).toEqual([
    lethalPack.key, minecraftPack.key, minecraftMod.key, lethalMod.key,
  ]);
  expect(sortResultGroups(groups, 'relevance', true).slice(0, 2).every(group => group.listings[0].kind === 'modpack')).toBe(true);
});
