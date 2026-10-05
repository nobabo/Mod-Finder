import { describe, expect, it } from 'vitest';
import { navigationUrl, readNavigation } from '../../src/web/lib/navigation';

const origin = 'https://modfinder.pages.dev';
const read = (path: string) => readNavigation(new URL(path, origin));
const roundTrip = (path: string) => {
  const state = read(path);
  return read(navigationUrl(state, new URL(origin)));
};

describe('shareable navigation state', () => {
  it('distinguishes the home screen from a submitted empty search', () => {
    expect(read('/').submitted).toBe(false);
    expect(roundTrip('/?q=')).toMatchObject({ submitted: true, query: '', page: 'discover' });
    expect(navigationUrl(read('/'), new URL(origin))).toBe('/');
  });

  it('restores a non-default game and Korean query after a reload', () => {
    const state = roundTrip('/?game=stardew-valley&q=스타듀%20대확장&sort=updated');
    expect(state).toMatchObject({ gameId: 'stardew-valley', query: '스타듀 대확장', sort: 'updated', submitted: true });
  });

  it('keeps the search context while visiting favorites, folders, and recent searches', () => {
    const search = read('/?q=sodium&version=1.21.1&loader=fabric&kind=mod&category=modrinth:optimization&category=modrinth:utility&sort=relevance');
    for (const page of ['favorites', 'recent'] as const) {
      const state = { ...search, page, folder: 'folder-0001' };
      expect(read(navigationUrl(state, new URL(origin)))).toEqual(state);
    }
  });

  it('preserves an all-games genre without applying categories from an individual game', () => {
    expect(roundTrip('/?game=all&genre=survival&q=&category=modrinth:optimization')).toMatchObject({ gameId: 'all', genre: 'survival', categories: [], submitted: true });
    expect(read('/?game=stardew-valley&genre=survival').genre).toBe('all');
  });

  it('ignores invalid or cross-game filters and bounds untrusted input', () => {
    expect(read('/?game=unknown&page=admin&sort=unsafe&version=javascript:alert(1)&loader=bad&kind=bad&category=steam:Map')).toMatchObject({ gameId: 'minecraft-java', page: 'discover', sort: 'downloads', filters: {}, categories: [] });
    expect(read('/?game=stardew-valley&loader=fabric&version=1.21.1&kind=mod').filters).toEqual({});
    expect(read('/?category=modrinth:magic&category=modrinth:magic').categories).toEqual(['modrinth:magic']);
    expect(read('/?q=' + 'a'.repeat(500)).query).toHaveLength(200);
    expect(read('/?folder=' + 'a'.repeat(500)).folder).toHaveLength(80);
  });

  it('encodes a query as text and retains unrelated URL parameters', () => {
    const base = new URL('/?campaign=shared#top', origin);
    const state = { ...read('/'), query: 'a&game=all#<script>', submitted: true };
    const serialized = navigationUrl(state, base);
    expect(read(serialized).query).toBe(state.query);
    expect(read(serialized).gameId).toBe('minecraft-java');
    expect(new URL(serialized, origin).searchParams.get('campaign')).toBe('shared');
    expect(base.href).toBe(origin + '/?campaign=shared#top');
  });
});
