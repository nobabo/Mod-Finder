export const GAME_THEMES = {
  'minecraft-java': {
    id: 'minecraft', primary: '#397455', secondary: '#7a6546',
    canvas: '#c6ddcf', surface: 'transparent', surfaceDeep: 'transparent',
    text: '#243f30', muted: '#506856', brandStart: '#76b79c', brandEnd: '#8eafd0',
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
    id: 'stardew', primary: '#98632f', secondary: '#5d7d46',
    canvas: '#e8d9b5', surface: 'transparent', surfaceDeep: 'transparent',
    text: '#513923', muted: '#725b40', brandStart: '#d0a06b', brandEnd: '#a5b581',
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
