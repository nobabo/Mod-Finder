import { getCategory } from '../../shared/categories';
import { GENRES, getGame } from '../../shared/games';
import type { Filters, Sort } from '../../shared/types';

export type Page = 'discover' | 'favorites' | 'recent';
export interface NavigationState {
  page: Page;
  gameId: string;
  genre: string;
  query: string;
  submitted: boolean;
  filters: Filters;
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
  const filters: Filters = {};
  if (gameId === 'minecraft-java') {
    const version = params.get('version');
    const loader = params.get('loader');
    const kind = params.get('kind');
    if (version && /^\d+\.[\w. +\-]{1,38}$/.test(version)) filters.version = version;
    if (loader && ['fabric', 'forge', 'neoforge', 'quilt'].includes(loader)) filters.loader = loader;
    if (kind && ['mod', 'modpack', 'resourcepack', 'shader'].includes(kind)) filters.kind = kind;
  }
  return {
    page, gameId, genre, sort, filters,
    query: (params.get('q') ?? '').trim().slice(0, 200),
    submitted: params.has('q'),
    categories: [...new Set(params.getAll('category'))].filter(id => !!getCategory(gameId, id)),
    folder: params.get('folder')?.slice(0, 80) || 'all',
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
  for (const key of ['version', 'loader', 'kind'] as const) {
    if (state.filters[key]) url.searchParams.set(key, state.filters[key]!);
  }
  for (const category of state.categories) url.searchParams.append('category', category);
  if (state.sort !== 'downloads') url.searchParams.set('sort', state.sort);
  if (state.folder !== 'all') url.searchParams.set('folder', state.folder);
  return url.pathname + url.search + url.hash;
}
