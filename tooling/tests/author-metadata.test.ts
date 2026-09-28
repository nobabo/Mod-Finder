import { describe, expect, it, vi } from 'vitest';
import { Adapter, mapCurseforge, mapModrinth, mapThunderstore } from '../../src/server/adapters';
import { readConfig } from '../../src/server/config';
import { UpstreamClient } from '../../src/server/http';
import { getGame } from '../../src/shared/games';

const game = getGame('rimworld')!;
const creator = '76561198000000001';
const other = '76561198000000002';
const workshop = (id: string, owner: unknown = creator) => ({ publishedfileid: id, title: 'Workshop item', creator: owner, result: 1, consumer_app_id: Number(game.sources.steam!.scope) });
function setup(items: Record<string, unknown>[], profiles: unknown, status = 200) {
  const fetcher = vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    return new Response(JSON.stringify(url.includes('GetPlayerSummaries') ? profiles : { response: { publishedfiledetails: items, total: items.length } }), { status: url.includes('GetPlayerSummaries') ? status : 200 });
  });
  const adapter = new Adapter('steam', readConfig({ STEAM_API_KEY: 'test-placeholder' }), new UpstreamClient('Test', fetcher as typeof fetch));
  return { adapter, fetcher };
}
const search = (adapter: Adapter) => adapter.search({ gameId: game.id, source: 'steam', query: 'test', sort: 'relevance', filters: {} });

describe('Steam creator enrichment', () => {
  it('asks Steam to order downloads by lifetime unique subscriptions', async () => {
    const { adapter, fetcher } = setup([{ ...workshop('1'), lifetime_subscriptions: 12, subscriptions: 9 }], {});
    const result = await adapter.search({ gameId: game.id, source: 'steam', query: '', sort: 'downloads', filters: {} });
    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(JSON.parse(url.searchParams.get('input_json')!).query_type).toBe(9);
    expect(result.items[0].metrics).toEqual([{ label: '누적 구독자', value: 12 }]);
  });
  it('batches unique string IDs and matches profiles by ID, not response order', async () => {
    const { adapter, fetcher } = setup([workshop('1'), workshop('2', other), workshop('3')], { response: { players: [
      { steamid: other, personaname: 'Second' }, { steamid: creator, personaname: '첫 제작자' },
    ] } });
    const result = await search(adapter);
    expect(result.items.map(item => item.author)).toEqual(['첫 제작자', 'Second', '첫 제작자']);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const profileUrl = new URL(String(fetcher.mock.calls[1][0]));
    expect(profileUrl.searchParams.get('steamids')).toBe(`${creator},${other}`);
    expect(profileUrl.searchParams.has('key')).toBe(false);
  });
  it('enriches details after validating the game', async () => {
    const { adapter } = setup([workshop('1')], { response: { players: [{ steamid: creator, personaname: 'Maker' }] } });
    expect((await adapter.getDetails(game, '1'))?.author).toBe('Maker');
    const mismatch = setup([{ ...workshop('1'), consumer_app_id: 1 }], {});
    expect(await mismatch.adapter.getDetails(game, '1')).toBeNull();
    expect(mismatch.fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([429, 500])('retains search and detail results when profile lookup returns %s', async status => {
    const { adapter } = setup([workshop('1')], {}, status);
    expect(await search(adapter)).toMatchObject({ status: 'success', items: [{ id: '1', author: null }] });
    const detail = setup([workshop('1')], {}, status);
    expect(await detail.adapter.getDetails(game, '1')).toMatchObject({ id: '1', author: null });
  });
  it.each([{}, { response: { players: [] } }, { response: { players: [{ steamid: other, personaname: 'Unrelated' }] } }])('keeps missing or malformed profiles unknown', async profiles => {
    expect(await search(setup([workshop('1')], profiles).adapter)).toMatchObject({ status: 'success', items: [{ author: null }] });
  });
  it('does not round numeric IDs or look up missing/failed creators', async () => {
    const { adapter, fetcher } = setup([workshop('1', Number(creator)), workshop('2', null), { ...workshop('3'), result: 9 }], {});
    expect((await search(adapter)).items.map(item => item.author)).toEqual([null, null]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const empty = setup([], {});
    expect((await search(empty.adapter)).status).toBe('empty');
    expect(empty.fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('other provider metadata', () => {
  it.each([false, true])('resolves the Modrinth owner and preserves metadata if team lookup fails=%s', async fail => {
    const fetcher = vi.fn(async (input: string | URL | Request) => new Response(JSON.stringify(String(input).endsWith('/members') ? [
      { role: 'Developer', accepted: true, user: { username: 'Contributor' } },
      { role: 'Owner', accepted: false, user: { username: 'Pending' } },
      { role: 'Owner', accepted: true, user: { username: 'Maker' } },
    ] : { id: 'project', title: 'Project', game_versions: ['1.21'], versions: ['version-id'], categories: ['utility'], additional_categories: ['optimization'], loaders: ['fabric'] }), { status: fail && String(input).endsWith('/members') ? 500 : 200 }));
    const adapter = new Adapter('modrinth', readConfig({}), new UpstreamClient('Test', fetcher as typeof fetch));
    expect(await adapter.getDetails(getGame('minecraft-java')!, 'project')).toMatchObject({ author: fail ? null : 'Maker', versions: ['1.21'], tags: ['utility', 'optimization'], loaders: ['fabric'] });
  });
  it('preserves authors already supplied by search providers', () => {
    const minecraft = getGame('minecraft-java')!;
    expect(mapModrinth({ project_id: 'p', title: 'P', author: 'Maker' }, minecraft, 1).author).toBe('Maker');
    expect(mapCurseforge({ id: 1, name: 'P', authors: [{ name: 'One' }, { name: 'Two' }], links: { websiteUrl: 'https://www.curseforge.com/minecraft/mc-mods/test' } }, minecraft, 1).author).toBe('One, Two');
    expect(mapThunderstore({ namespace: 'Team', name: 'Mod', community_identifier: 'lethal-company', description: '', categories: [] }, getGame('lethal-company')!, 1).author).toBe('Team');
  });
});
