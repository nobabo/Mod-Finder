import { describe, expect, it, vi } from 'vitest';
import { correctedQueries, koreanKeyboardToEnglish, runSearchWithCorrections } from '../shared/search-corrections';
import type { SearchSpec } from '../shared/search-plan';
import type { SearchRequest } from '../shared/types';
import corrections from '../shared/data/search-corrections.json';
import { GENRES } from '../shared/games';

const spec: SearchSpec = { gameId: 'minecraft-java', query: 'ㄹ뮤걏', filters: { loader: 'fabric' }, sort: 'downloads', selectedSource: 'modrinth' };
const empty = { hasItems: false, empty: true };

describe('search corrections', () => {
  it('converts syllables, compound vowels, final consonants and standalone jamo', () => {
    expect(koreanKeyboardToEnglish('ㄹ뮤걏')).toBe('fabric');
    expect(koreanKeyboardToEnglish('ㄹ뮤걏'.normalize('NFD'))).toBe('fabric');
    expect(koreanKeyboardToEnglish('ㄹ뮤갸ㅊ')).toBe('fabric');
    expect(koreanKeyboardToEnglish('쐐 값 ㄳ ㅘ ABC-123')).toBe('Tho rkqt rt hk ABC-123');
  });
  it('corrects the supplied example and dictionary typos', () => {
    expect(correctedQueries('ㄹ뮤걏')[0]).toBe('fabric');
    expect(correctedQueries(' FABRCI API ')).toEqual(['fabric API']);
    expect(correctedQueries('soduim')).toEqual(['sodium']);
    expect(correctedQueries('fabric')).toEqual([]);
    expect(correctedQueries('')).toEqual([]);
    expect(correctedQueries('constructor')).toEqual([]);
  });
  it('has at least 100 distinct, effective corrections for every game genre', () => {
    expect(Object.keys(corrections.genres).sort()).toEqual(GENRES.map(genre => genre.id).sort());
    for (const genre of GENRES) {
      const entries = corrections.genres[genre.id as keyof typeof corrections.genres];
      expect(Object.keys(entries).length).toBeGreaterThanOrEqual(100);
      for (const [typo, canonical] of Object.entries(entries)) {
        expect(typo).not.toBe(canonical);
        expect(correctedQueries(typo, { gameId: 'all', genre: genre.id })).toContain(canonical);
      }
    }
  });
  it('applies corrections in the selected genre or game', () => {
    expect(correctedQueries('qusets', { gameId: 'all', genre: 'rpg' })).toEqual(['quests']);
    expect(correctedQueries('qusets', { gameId: 'all', genre: 'sandbox' })).toEqual([]);
    expect(correctedQueries('fllashlight', { gameId: 'lethal-company', genre: 'all' })).toEqual(['flashlight']);
    expect(correctedQueries('fllashlight', { gameId: 'minecraft-java', genre: 'all' })).toEqual([]);
  });
  it('retries an empty search while retaining filters and sort', async () => {
    const requests: SearchRequest[] = [];
    await runSearchWithCorrections(spec, async request => {
      requests.push(request);
      return request.query === 'fabric' ? { hasItems: true, empty: false } : empty;
    }, new AbortController().signal, () => {});
    expect(requests.map(request => request.query)).toEqual(['ㄹ뮤걏', 'fabric']);
    expect(requests.every(request => request.filters.loader === 'fabric' && request.sort === 'downloads' && !request.cursor)).toBe(true);
  });
  it('keeps successful original results and does not retry failed or external sources', async () => {
    for (const outcome of [{ hasItems: true, empty: false }, { hasItems: false, empty: false }, undefined]) {
      const run = vi.fn(async () => outcome);
      await runSearchWithCorrections(spec, run, new AbortController().signal, () => {});
      expect(run).toHaveBeenCalledTimes(1);
    }
  });
  it('waits for all original sources and skips corrections if any source has results', async () => {
    const requests: SearchRequest[] = [];
    await runSearchWithCorrections({ ...spec, selectedSource: 'all' }, async request => {
      requests.push(request);
      return request.source === 'modrinth' ? { hasItems: true, empty: false } : empty;
    }, new AbortController().signal, () => {});
    expect(requests.length).toBeGreaterThan(1);
    expect(requests.every(request => request.query === spec.query)).toBe(true);
  });
  it('stops correction searches when a query is cancelled', async () => {
    const controller = new AbortController();
    const run = vi.fn(async () => { controller.abort(); return empty; });
    await runSearchWithCorrections(spec, run, controller.signal, () => {});
    expect(run).toHaveBeenCalledTimes(1);
  });
  it('bounds unsuccessful retries and applies existing Korean aliases first', async () => {
    const run = vi.fn(async () => empty);
    await runSearchWithCorrections(spec, run, new AbortController().signal, () => {});
    expect(run.mock.calls.length).toBeLessThanOrEqual(3);
    const queries: string[] = [];
    await runSearchWithCorrections({ ...spec, query: '소듐' }, async request => {
      queries.push(request.query);
      return { hasItems: true, empty: false };
    }, new AbortController().signal, () => {});
    expect(queries).toEqual(['Sodium']);
  });
});
