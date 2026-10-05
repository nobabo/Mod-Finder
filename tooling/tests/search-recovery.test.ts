import { describe, expect, it } from 'vitest';
import type { SearchRequest, SearchResult, SourceStatus } from '../../src/shared/types';
import { searchRecoveryLinks } from '../../src/web/lib/search-recovery';

const request: SearchRequest = { gameId: 'minecraft-java', source: 'modrinth', query: 'magic & storage', filters: {}, sort: 'downloads' };
const result = (status: SourceStatus, externalUrl: string | null = null): SearchResult => ({
  source: 'modrinth', status, externalUrl, items: [], total: null, nextCursor: null,
  fetchedAt: new Date().toISOString(), cached: false, appliedFilters: {}, unsupportedFilters: [], queryForwarded: true, message: '',
});

describe('search recovery destinations', () => {
  it('offers a source search for transport errors even when the response has no link', () => {
    const [link] = searchRecoveryLinks([{ request, result: result('error') }]);
    expect(link).toMatchObject({ source: 'modrinth', gameId: 'minecraft-java' });
    expect(new URL(link.url).hostname).toBe('modrinth.com');
    expect(new URL(link.url).searchParams.get('q')).toBe('magic & storage');
  });

  it('uses supported external destinations without presenting them as search results', () => {
    const url = 'https://modrinth.com/mods?q=magic';
    const links = searchRecoveryLinks([{ request, result: result('external', url) }]);
    expect(links).toEqual([{ gameId: 'minecraft-java', source: 'modrinth', url }]);
    expect(searchRecoveryLinks([{ request, result: result('success') }, { request, result: result('empty') }, { request }])).toEqual([]);
  });

  it('falls back safely for invalid links and deduplicates failed category buckets', () => {
    const links = searchRecoveryLinks([
      { request, result: result('error', 'javascript:alert(1)') },
      { request: { ...request, filters: { category: 'modrinth:magic' } }, result: result('rate_limited', 'https://untrusted.example/search') },
    ]);
    expect(links).toHaveLength(1);
    expect(new URL(links[0].url).hostname).toBe('modrinth.com');
  });

  it('keeps game-specific external links separate and rejects unknown games', () => {
    const links = searchRecoveryLinks(['stardew-valley', 'skyrim-se', 'missing'].map(gameId => ({ request: { ...request, gameId, source: 'nexus' }, result: result('auth_required') })));
    expect(links.map(link => link.url)).toEqual(['https://www.nexusmods.com/stardewvalley/mods/', 'https://www.nexusmods.com/skyrimspecialedition/mods/']);
  });
});
