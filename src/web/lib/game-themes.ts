export const GAME_THEMES = {
  'minecraft-java': {
    id: 'minecraft',
    representative: 'steve',
    characters: [
      { name: 'steve', src: '/theme-art/minecraft-steve.webp', width: 526, height: 694 },
      { name: 'alex', src: '/theme-art/minecraft-alex.webp', width: 190, height: 231 },
      { name: 'creeper', src: '/theme-art/minecraft-creeper.webp', width: 472, height: 964 },
      { name: 'grass', src: '/theme-art/minecraft-grass.webp', width: 268, height: 296 },
      { name: 'diamond', src: '/theme-art/minecraft-diamond.webp', width: 12, height: 13 },
    ],
  },
  'stardew-valley': {
    id: 'stardew',
    representative: 'junimo',
    characters: [
      { name: 'junimo', src: '/theme-art/stardew-junimo.webp', width: 42, height: 45 },
      { name: 'cat', src: '/theme-art/stardew-cat.webp', width: 60, height: 76 },
      { name: 'chicken', src: '/theme-art/stardew-chicken.webp', width: 192, height: 192 },
      { name: 'krobus', src: '/theme-art/stardew-krobus.webp', width: 104, height: 114 },
      { name: 'stardrop', src: '/theme-art/stardew-stardrop.webp', width: 44, height: 48 },
    ],
  },
} as const;

export type GameTheme = typeof GAME_THEMES[keyof typeof GAME_THEMES];
export function gameThemeFor(gameId: string): GameTheme | undefined {
  return Object.hasOwn(GAME_THEMES, gameId) ? GAME_THEMES[gameId as keyof typeof GAME_THEMES] : undefined;
}
