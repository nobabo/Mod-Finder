import artwork from '../../shared/data/game-character-art.json';

export const GAME_THEMES = {
  'minecraft-java': {
    id: 'minecraft',
    representative: 'steve',
    characters: artwork['minecraft-java'],
  },
  'stardew-valley': {
    id: 'stardew',
    representative: 'junimo',
    characters: artwork['stardew-valley'],
  },
} as const;

export type GameTheme = typeof GAME_THEMES[keyof typeof GAME_THEMES];
export function gameThemeFor(gameId: string): GameTheme | undefined {
  return Object.hasOwn(GAME_THEMES, gameId) ? GAME_THEMES[gameId as keyof typeof GAME_THEMES] : undefined;
}
