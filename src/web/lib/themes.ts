import { updateBrandIcon } from './brand';
import { gameThemeFor } from './game-themes';
import { isLightBackground, lightenAccent, normalizeBackgroundColor } from './background-color';

const palette = [
  ['crimson','크림슨','Crimson','#ef3e55','#ff8145'],
] as const;
const rgb = (hex: string) => [1,3,5].map(offset => parseInt(hex.slice(offset,offset + 2),16));
type ThemeEffect = 'none' | 'petals' | 'rain' | 'fire' | 'bamboo';
const effects: Record<typeof palette[number][0], ThemeEffect> = {
  crimson:'fire',
};
const colorThemes = palette.map(([id,ko,en,primary,secondary]) => ({ id,ko,en,primary,secondary,effect:effects[id],rgb:rgb(primary),secondaryRgb:rgb(secondary),grad:`linear-gradient(135deg,${primary},${secondary})` }));
export const THEMES = [{ ...colorThemes[0], id: 'game', ko: '게임 기본', en: 'Game default', grad: 'linear-gradient(135deg,#14251f 0%,#4a715c 49%,#29221c 50%,#9f805b 100%)' }, ...colorThemes];
export const themeById = (id: string) => colorThemes.find(theme => theme.id === id) ?? colorThemes[0];
export function defaultBackground(id: string, gameId: string): string {
  const game = id === 'game' ? gameThemeFor(gameId) : undefined;
  return game?.canvas ?? '#' + themeById(id).rgb.map(value => Math.round(value * .08).toString(16).padStart(2, '0')).join('');
}
export function sceneAppearance(id: string, gameId: string, backgroundColor?: string) {
  const game = id === 'game' ? gameThemeFor(gameId) : undefined;
  const custom = normalizeBackgroundColor(backgroundColor);
  if (!game && !custom) return undefined;
  const canvas = custom ?? game!.canvas;
  const light = isLightBackground(canvas);
  const theme = game ?? themeById(id);
  return { canvas, primary: game && !light ? lightenAccent(theme.primary) : theme.primary, secondary: game && !light ? lightenAccent(theme.secondary) : theme.secondary, photoOpacity: .18, light };
}
export function readThemePreference(storage: Pick<Storage, 'getItem'>): string {
  try {
    const saved = storage.getItem('modfinder-theme');
    if (THEMES.some(theme => theme.id === saved)) return saved!;
    const legacy = storage.getItem('modfinder-accent');
    if (colorThemes.some(theme => theme.id === legacy)) return legacy!;
  } catch { /* Use the game default when optional storage is unavailable. */ }
  return 'game';
}
export function applyTheme(id: string, gameId = '', backgroundColor?: string) {
  const theme = themeById(id); const style = document.documentElement.style;
  const game = id === 'game' ? gameThemeFor(gameId) : undefined;
  const custom = normalizeBackgroundColor(backgroundColor);
  const appearance = sceneAppearance(id, gameId, custom);
  const light = appearance?.light ?? false;
  document.documentElement.dataset.accent = theme.id;
  if (game) document.documentElement.dataset.gameTheme = game.id;
  else delete document.documentElement.dataset.gameTheme;
  if (light) document.documentElement.dataset.lightTheme = 'true';
  else delete document.documentElement.dataset.lightTheme;
  const tint = (amount: number) => `rgb(${theme.rgb.map(value => Math.round(value * amount)).join(',')})`;
  const values: Record<string,string> = {
    '--tint-rgb':theme.rgb.join(','), '--secondary-rgb':theme.secondaryRgb.join(','),
    '--accent':theme.primary,'--cyan':theme.secondary,'--grad':theme.grad,
    '--canvas':tint(.08),'--surface':tint(.19),'--surface-deep':tint(.12),
    '--muted':`color-mix(in srgb,${theme.primary} 30%,#c0c8da)`,
    '--text-soft':`color-mix(in srgb,${theme.primary} 20%,#f2f5ff)`,
    '--text':'#eceaff', '--glow':`rgba(${theme.rgb.join(',')},.24)`,
    '--brand-start':theme.primary, '--brand-end':theme.secondary,
    'color-scheme':'dark',
  };
  if (game) Object.assign(values, {
    '--tint-rgb':rgb(game.primary).join(','), '--secondary-rgb':rgb(game.secondary).join(','),
    '--accent':game.primary, '--cyan':game.secondary, '--grad':`linear-gradient(135deg,${game.primary},${game.secondary})`,
    '--canvas':game.canvas, '--surface':game.surface, '--surface-deep':game.surfaceDeep,
    '--text':game.text, '--text-soft':game.text, '--muted':game.muted, '--glow':'transparent',
    '--brand-start':game.brandStart, '--brand-end':game.brandEnd,
    'color-scheme':'light',
  });
  if (custom || (game && !light)) Object.assign(values, {
    '--canvas':appearance!.canvas, '--surface':'transparent', '--surface-deep':'transparent',
    '--text':light ? '#17271d' : '#f4f8f5', '--text-soft':light ? '#17271d' : '#f4f8f5',
    '--muted':light ? '#465d4c' : '#c6d3ca', '--glow':'transparent',
    '--accent':appearance!.primary, '--cyan':appearance!.secondary, '--grad':`linear-gradient(135deg,${appearance!.primary},${appearance!.secondary})`,
    '--tint-rgb':rgb(appearance!.primary).join(','), '--secondary-rgb':rgb(appearance!.secondary).join(','),
  });
  values['color-scheme'] = light ? 'light' : 'dark';
  Object.entries(values).forEach(([name,value]) => style.setProperty(name,value));
  updateBrandIcon(game?.brandStart ?? theme.primary, game?.brandEnd ?? theme.secondary);
}
