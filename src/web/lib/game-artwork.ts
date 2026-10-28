import { getGame } from '../../shared/games';
import logos from '../../shared/data/logos.json';
import { gameThemeFor } from './game-themes';

export interface GameArtwork { name: string; src: string; width: number; height: number; logo?: boolean; anchor: 'search-left' | 'search-top-right' | 'search-bottom-right' | 'ranking-top-left' | 'ranking-bottom-right' }
export function artworkForGame(gameId: string): { id: string; representative: string; characters: readonly GameArtwork[] } | undefined {
  const theme = gameThemeFor(gameId);
  if (theme) return theme;
  const game = getGame(gameId);
  const logo = game && (logos as Record<string, { src: string; width: number; height: number }>)[gameId];
  if (logo) return { id: gameId, representative: 'logo', characters: [{ name: 'logo', ...logo, logo: true, anchor: 'search-left' }] };
}
