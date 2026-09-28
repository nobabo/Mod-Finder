import catalog from './data/backgrounds.json';
export interface Screenshot { src: string; width: number; height: number; sourceUrl: string }
export interface BackgroundCollection { sourcePage: string; retrievedAt: string; screenshots: Screenshot[] }
export const BACKGROUNDS: Record<string, BackgroundCollection> = catalog;
export function backgroundPlaylist(gameIds: string[]) {
  // Interleave games in the all-games view instead of showing six of one first.
  return Array.from({ length: 6 }, (_, i) => gameIds.flatMap(gameId => {
    const shot = BACKGROUNDS[gameId]?.screenshots[i];
    return shot ? [{ ...shot, gameId }] : [];
  })).flat();
}
