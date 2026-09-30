import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Rankings } from '../../src/web/Rankings';
import { downloadRanking, rankingSources } from '../../src/web/lib/rankings';
import { COMMUNITY_GALLERIES, communityMods, countCommunityMentions } from '../../src/shared/community-ranking';
import { communityRanking } from '../../src/shared/community-snapshots';
import { GAMES, getGame } from '../../src/shared/games';
import { listingKey, type Listing, type SearchRequest, type SearchResult } from '../../src/shared/types';
import { collectionPosts, galleryPageUrl, parseCommunityPage, parseCommunityPagination, validateCollection, type CommunityCollection } from '../lib/community-pages';

vi.mock('../../src/web/lib/i18n', () => ({ locale: 'ko', t: (key: string) => key }));
vi.mock('../../src/web/lib/api', () => ({ searchSource: vi.fn() }));

function listing(request: SearchRequest, id = '1', value: number | null = 10): Listing {
  const scope = getGame(request.gameId)!.sources[request.source]!.scope;
  return { key: listingKey(request.source, scope, id), id, scope, gameId: request.gameId, source: request.source,
    title: 'Same title', author: null, summary: '', url: 'https://modrinth.com/mod/example', iconUrl: null, updatedAt: null, versions: null, loaders: null,
    kind: request.gameId === 'minecraft-java' ? 'modpack' : 'mod', tags: [], rank: 1, fetchedAt: new Date().toISOString(),
    metrics: value === null ? [] : [{ label: request.source === 'steam' ? '누적 구독자' : '다운로드', value }] };
}
function response(request: SearchRequest, items: Listing[] = []): SearchResult {
  return { source: request.source, status: items.length ? 'success' : 'empty', items, nextCursor: null, total: items.length,
    fetchedAt: new Date().toISOString(), cached: false, appliedFilters: request.filters, unsupportedFilters: [], externalUrl: null, queryForwarded: false, message: '' };
}

describe('game community rankings', () => {
  it('ships game-specific evidence for every configured mod gallery', () => {
    expect(Object.keys(COMMUNITY_GALLERIES)).toHaveLength(12);
    for (const game of GAMES) {
      const snapshot = communityRanking(game.id);
      if (!COMMUNITY_GALLERIES[game.id]) { expect(snapshot).toBeUndefined(); continue; }
      expect(snapshot!.gameId).toBe(game.id);
      expect(snapshot!.basis).toBe('titles');
      expect(Number.isFinite(Date.parse(snapshot!.fetchedAt))).toBe(true);
      expect(snapshot!.postCount).toBeGreaterThan(0);
      expect(snapshot!.postCount).toBeLessThanOrEqual(750);
      expect(snapshot!.entries.length).toBeGreaterThan(0);
      expect(snapshot!.entries.length).toBeLessThanOrEqual(10);
      expect(snapshot!.sourceUrls).toEqual(COMMUNITY_GALLERIES[game.id].heads.map(head => galleryPageUrl(game.id, head.id, 1)));
      const ids = new Set(communityMods(game.id).map(mod => mod.id));
      snapshot!.entries.forEach((entry, index) => {
        expect(ids.has(entry.id)).toBe(true);
        expect(entry.mentions).toBe(new Set(entry.postIds).size);
        expect(entry.mentions).toBeGreaterThan(0);
        expect(entry.mentions).toBeLessThanOrEqual(snapshot!.postCount);
        expect(entry.postIds.every(id => typeof id === 'string' && /^\d+$/.test(id))).toBe(true);
        if (index) expect(entry.mentions).toBeLessThanOrEqual(snapshot!.entries[index - 1].mentions);
      });
    }
  });
  it('counts aliases once per post and only within the selected game', () => {
    const posts = [{ id: '1', title: '대확장 SVE Stardew Valley Expanded' }, { id: '1', title: '대확장 SVE' }, { id: '2', title: '대확장과 릿지사이드' }, { id: '3', title: 'GTNH' }];
    expect(countCommunityMentions(posts, 'stardew-valley').map(entry => [entry.id, entry.mentions])).toEqual([['sve', 2], ['ridgeside', 1]]);
    expect(countCommunityMentions(posts, 'minecraft-java').map(entry => [entry.id, entry.mentions])).toEqual([['gtnh', 1]]);
    expect(countCommunityMentions(posts, 'cities-skylines')).toEqual([]);
  });
  it('uses the same localized names in stored and newly counted community rankings', () => {
    for (const game of GAMES.filter(game => game.id !== 'minecraft-java')) {
      const mods = communityMods(game.id);
      for (const entry of communityRanking(game.id)?.entries ?? []) {
        expect(entry.koreanName, `${game.id}:${entry.id}`).toBe(mods.find(mod => mod.id === entry.id)?.koreanName);
        expect(entry.koreanName).toBeTruthy();
      }
    }
    expect(countCommunityMentions([{ id: '1', title: 'CJB Cheats Menu' }], 'stardew-valley')[0].koreanName).toBe('CJB 치트 메뉴');
    expect(countCommunityMentions([{ id: '1', title: 'BepInEx' }], 'lethal-company')[0].koreanName).toBe('베핀엑스 팩');
  });
  it('excludes explicitly different games from shared series galleries', () => {
    expect(countCommunityMentions([{ id: '1', title: '[뉴베] CBBE' }, { id: '2', title: '[폴4] CBBE' }], 'fallout-4').map(entry => entry.postIds)).toEqual([['2']]);
    expect(countCommunityMentions([{ id: '1', title: '오블리비언 ENB' }, { id: '2', title: '[SE] ENB' }], 'skyrim-se').map(entry => entry.postIds)).toEqual([['2']]);
  });
  it.each(GAMES.map(game => [game.id]))('renders the appropriate tabs for %s', gameId => {
    const html = renderToStaticMarkup(createElement(Rankings, { gameId, card: () => null, searchMod: vi.fn() }));
    expect(html.includes('검색 순위')).toBe(!!COMMUNITY_GALLERIES[gameId]);
    expect(html).toContain(getGame(gameId)!.sources.steam ? '구독 순위' : '다운로드 순위');
    if (gameId !== 'minecraft-java') expect(html).not.toContain('Sunlit Valley');
  });
});

describe('gallery collection', () => {
  const row = (id: string, subject: string, title: string) => `<tr class="ub-content us-post" data-no="${id}"><td class="gall_subject">${subject}</td><td class="gall_tit ub-word"><a href="/view">${title}</a><a class="reply_numbox">[99]</a></td></tr>`;
  const html = (head = '40', label = '모드/리텍') => `<input id="search_head" value="${head}"><a onclick="listSearchHead(${head})">${label}</a>`;
  it('reads shortened labels and encoded titles, excluding notices and general posts', () => {
    const page = html() + row('18446744073709551616', '모드/<p class="subject_inner">모드/리텍</p>', '<em></em>SVE &amp; &#x41;utomate') + row('2', '<b>공지</b>', 'SVE') + row('3', '일반', '대확장');
    expect(parseCommunityPage(page, 'stardew-valley', '40')).toEqual([{ id: '18446744073709551616', title: 'SVE & Automate' }]);
  });
  it('rejects changed tabs, ignored filters and malformed pages', () => {
    expect(() => parseCommunityPage(html('40', '정보'), 'stardew-valley', '40')).toThrow('category');
    expect(() => parseCommunityPage(html('0'), 'stardew-valley', '40')).toThrow('category');
    expect(() => parseCommunityPage(html(), 'stardew-valley', '40')).toThrow('Incomplete');
    expect(() => galleryPageUrl('cities-skylines', '0', 1)).toThrow();
  });
  it('detects the real last page and rejects silently clamped pagination', () => {
    const paging = '<input name="move_page" value="7"><span class="num total_page">7</span>';
    expect(parseCommunityPagination(paging, 7)).toBe(7);
    expect(() => parseCommunityPagination(paging, 8)).toThrow('pagination');
  });
  it('deduplicates across tabs, keeps string IDs and rejects incomplete snapshots', () => {
    const first = { page: 1, totalPages: 1, head: '40', url: galleryPageUrl('stardew-valley', '40', 1), titles: [{ id: '99', title: 'SVE' }, { id: '100', title: '대확장' }] };
    expect(collectionPosts([first, first]).map(post => post.id)).toEqual(['100', '99']);
    const collection: CommunityCollection = { gameId: 'stardew-valley', galleryId: 'stardew', fetchedAt: new Date().toISOString(), pages: [first], posts: collectionPosts([first]) };
    expect(() => validateCollection(collection)).not.toThrow();
    expect(() => validateCollection({ ...collection, pages: [{ ...first, totalPages: 2 }] })).toThrow('Missing end');
    expect(() => validateCollection({ ...collection, posts: [] })).toThrow('mismatch');
    expect(() => validateCollection({ ...collection, pages: [{ ...first, head: '0' }] })).toThrow();
  });
});

describe('API download rankings', () => {
  it('queries the selected game, keeps healthy providers and does not merge equal titles', async () => {
    const search = vi.fn(async (request: SearchRequest) => {
      if (request.source === 'nexus') throw Error('unavailable');
      return response(request, [listing(request, 'large', 100), listing(request, 'small', 20)]);
    });
    const result = await downloadRanking('lethal-company', new AbortController().signal, search);
    expect(result.status).toBe('ready');
    expect(result.failedSources).toEqual(['nexus']);
    expect(result.items.map(group => group.listings[0].id)).toEqual(['large', 'small']);
    expect(search.mock.calls.map(([request]) => [request.gameId, request.query, request.sort, request.filters])).toEqual([
      ['lethal-company', '', 'downloads', {}], ['lethal-company', '', 'downloads', {}],
    ]);
  });
  it('preserves a good first page when the next page fails', async () => {
    const search = vi.fn(async (request: SearchRequest) => {
      if (request.cursor) return { ...response(request), status: 'rate_limited' as const };
      return { ...response(request, [listing(request)]), nextCursor: 'next' };
    });
    const result = await downloadRanking('stardew-valley', new AbortController().signal, search);
    expect(result.status).toBe('ready');
    expect(result.items).toHaveLength(1);
    expect(result.failedSources).toEqual(['nexus']);
  });
  it('uses Steam subscriptions without mixing Nexus downloads', async () => {
    const search = vi.fn(async (request: SearchRequest) => response(request, [listing(request, '18446744073709551616')]));
    expect(rankingSources('rimworld')).toEqual(['steam']);
    const result = await downloadRanking('rimworld', new AbortController().signal, search);
    expect(search).toHaveBeenCalledTimes(1);
    expect(result.items[0].listings[0].id).toBe('18446744073709551616');
    expect(result.items[0].listings[0].metrics[0].label).toBe('누적 구독자');
  });
  it('requires real metrics and matching game/source/IDs, retaining Minecraft packs only', async () => {
    const search = vi.fn(async (request: SearchRequest) => response(request, [listing(request, 'ok'), listing(request, 'unknown', null), listing(request, 'nan', NaN), listing(request, 'negative', -1),
      { ...listing(request, 'wrong-game'), gameId: 'stardew-valley' }, { ...listing(request, 'wrong-key'), key: 'wrong' }, { ...listing(request, 'mod'), kind: 'mod' }]));
    const result = await downloadRanking('minecraft-java', new AbortController().signal, search);
    expect(result.items).toHaveLength(2);
    expect(result.items.every(group => group.listings[0].id === 'ok')).toBe(true);
    expect(search.mock.calls.every(([request]) => request.filters.kind === 'modpack')).toBe(true);
  });
  it('distinguishes unavailable providers from a successful empty list', async () => {
    const signal = new AbortController().signal;
    expect((await downloadRanking('stardew-valley', signal, async request => ({ ...response(request), status: 'external', externalUrl: 'https://www.nexusmods.com/stardewvalley' }))).status).toBe('error');
    expect((await downloadRanking('stardew-valley', signal, async request => response(request))).status).toBe('ready');
  });
  it('bounds cursor loops and stops requesting after cancellation', async () => {
    const controller = new AbortController();
    const loop = vi.fn(async (request: SearchRequest) => ({ ...response(request, [listing(request)]), nextCursor: 'repeat' }));
    expect((await downloadRanking('stardew-valley', controller.signal, loop)).items).toHaveLength(1);
    expect(loop).toHaveBeenCalledTimes(2);
    controller.abort(); loop.mockClear();
    await downloadRanking('stardew-valley', controller.signal, loop);
    expect(loop).not.toHaveBeenCalled();
  });
});
