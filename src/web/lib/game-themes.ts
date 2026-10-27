export const GAME_THEMES = {
  'minecraft-java': {
    id: 'minecraft', primary: '#397455', secondary: '#7a6546',
    canvas: '#d9eee0', surface: '#f8fcf6', surfaceDeep: '#f2f8ef',
    text: '#284738', muted: '#587262', brandStart: '#76b79c', brandEnd: '#8eafd0',
    representative: 'steve',
    characters: [
      { name: 'steve', src: '/theme-art/minecraft-steve.webp', width: 526, height: 694 },
      { name: 'alex', src: '/theme-art/minecraft-alex.webp', width: 190, height: 231 },
      { name: 'adventurer', src: '/theme-art/minecraft-adventurer.webp', width: 322, height: 525 },
    ],
  },
  'stardew-valley': {
    id: 'stardew', primary: '#98632f', secondary: '#5d7d46',
    canvas: '#f8edce', surface: '#fffcf1', surfaceDeep: '#fff8e6',
    text: '#58402d', muted: '#80694f', brandStart: '#d0a06b', brandEnd: '#a5b581',
    representative: 'junimo',
    characters: [
      { name: 'junimo', src: '/theme-art/stardew-junimo.webp', width: 42, height: 45 },
      { name: 'cat', src: '/theme-art/stardew-cat.webp', width: 60, height: 76 },
      { name: 'chicken', src: '/theme-art/stardew-chicken.webp', width: 192, height: 192 },
    ],
  },
} as const;

export type GameTheme = typeof GAME_THEMES[keyof typeof GAME_THEMES];
export function gameThemeFor(gameId: string): GameTheme | undefined {
  return Object.hasOwn(GAME_THEMES, gameId) ? GAME_THEMES[gameId as keyof typeof GAME_THEMES] : undefined;
}
