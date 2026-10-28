import artwork from '../../shared/data/game-character-art.json';
import { gameThemeFor } from './game-themes';

export interface GameArtwork {
  name: string; src: string; width: number; height: number; imageWidth: number; imageHeight: number;
  crop: readonly number[]; ko: string; en: string; kind: 'character' | 'mob' | 'item'; displayWidth: number; pixelated?: boolean;
}
const catalog = artwork as Record<string, readonly GameArtwork[]>;
export function artworkForGame(gameId: string) {
  if (!Object.hasOwn(catalog,gameId)) return undefined;
  const characters = catalog[gameId];
  return {id:gameThemeFor(gameId)?.id ?? gameId,representative:characters[0].name,characters};
}
