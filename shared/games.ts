import type { Game } from './types';
import catalog from './data/games.json';
import genres from './data/genres.json';
export const GAMES: Game[] = catalog;
export const GENRES = genres;
export function getGame(id: string): Game | undefined { return GAMES.find(game => game.id === id); }
export function findGames(query = '', genre = 'all'): Game[] {
  const q = query.trim().toLocaleLowerCase();
  return GAMES.filter(g => (genre === 'all' || g.genres.includes(genre)) && [g.id, g.name, g.koreanName, g.edition, ...g.aliases].some(s => s.toLocaleLowerCase().includes(q)));
}
export function gamesInScope(gameId: string, genre = 'all'): Game[] {
  return gameId === 'all' ? findGames('', genre) : GAMES.filter(g => g.id === gameId);
}
