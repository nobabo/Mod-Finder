import { getCategory } from '../../shared/categories';
import { GENRES, getGame } from '../../shared/games';
import type { FilterSelections, Sort } from '../../shared/types';
import { filterValues, MULTI_FILTER_KEYS } from '../../shared/filter-selections';

export type Page = 'discover' | 'favorites' | 'recent';
export interface NavigationState {
  page: Page;
  gameId: string;
  genre: string;
  query: string;
  submitted: boolean;
  filters: FilterSelections;
  categories: string[];
  sort: Sort;
  folder: string;
}

const sorts: Sort[] = ['downloads', 'relevance', 'updated', 'popular'];
const routeKeys = ['page', 'game', 'genre', 'q', 'version', 'loader', 'kind', 'category', 'sort', 'folder'];

export function readNavigation(url: URL): NavigationState {
  const params = url.searchParams;
  const requestedGame = params.get('game') ?? '';
  const gameId = requestedGame === 'all' || getGame(requestedGame) ? requestedGame : 'minecraft-java';
  const requestedGenre = params.get('genre');
  const genre = gameId === 'all' && GENRES.some(item => item.id === requestedGenre) ? requestedGenre! : 'all';
  const requestedPage = params.get('page');
  const page = requestedPage === 'favorites' || requestedPage === 'recent' ? requestedPage : 'discover';
  const requestedSort = params.get('sort');
  const sort = sorts.find(item => item === requestedSort) ?? 'downloads';
  const filters: FilterSelections = {};
  if (gameId === 'minecraft-java') {
    const valid = {
      version: (value: string) => /^\d+\.[\w. +\-]{1,38}$/.test(value),
      loader: (value: string) => ['fabric', 'forge', 'neoforge', 'quilt'].includes(value),
      kind: (value: string) => ['mod', 'modpack', 'resourcepack', 'shader'].includes(value),
    };
    for (const key of MULTI_FILTER_KEYS) {
      const values = filterValues(params.getAll(key)).filter(valid[key]);
      if (values.length) filters[key] = values.length === 1 ? values[0] : values;
    }
  }
  return {
    page, gameId, genre, sort, filters,
    query: (params.get('q') ?? '').trim().slice(0, 200),
    submitted: params.has('q'),
    categories: [...new Set(params.getAll('category'))].filter(id => !!getCategory(gameId, id)),
    folder: params.get('folder') === 'unfiled' ? 'all' : params.get('folder')?.slice(0, 80) || 'all',
  };
}

export function navigationUrl(state: NavigationState, current: URL): string {
  const url = new URL(current);
  for (const key of routeKeys) url.searchParams.delete(key);
  if (state.page !== 'discover') url.searchParams.set('page', state.page);
  if (state.gameId !== 'minecraft-java') url.searchParams.set('game', state.gameId);
  if (state.gameId === 'all' && state.genre !== 'all') url.searchParams.set('genre', state.genre);
  // The presence of q distinguishes browsing all results from the home screen.
  if (state.submitted || state.query) url.searchParams.set('q', state.query);
  for (const key of MULTI_FILTER_KEYS) {
    for (const value of filterValues(state.filters[key])) url.searchParams.append(key, value);
  }
  for (const category of state.categories) url.searchParams.append('category', category);
  if (state.sort !== 'downloads') url.searchParams.set('sort', state.sort);
  if (state.folder !== 'all') url.searchParams.set('folder', state.folder);
  return url.pathname + url.search + url.hash;
}
