import { updateBrandIcon } from './brand';
import { gameThemeFor } from './game-themes';
import { backgroundPalette, compositeBackgroundColor, normalizeBackgroundColor, parseBackgroundColor } from './background-color';

const palette = [['crimson','크림슨','Crimson','#ef3e55','#ff8145']] as const;
const rgb = (hex: string) => [1,3,5].map(offset => parseInt(hex.slice(offset,offset + 2),16));
type ThemeEffect = 'none' | 'petals' | 'rain' | 'fire' | 'bamboo';
const colorThemes = palette.map(([id,ko,en,primary,secondary]) => ({id,ko,en,primary,secondary,effect:'fire' as ThemeEffect,rgb:rgb(primary),secondaryRgb:rgb(secondary),grad:`linear-gradient(135deg,${primary},${secondary})`}));
// Keep the persisted ID so existing preferences become automatic without losing artwork.
export const THEMES = [{...colorThemes[0],id:'game',ko:'자동 색상',en:'Automatic',grad:'linear-gradient(135deg,#788894,#c4cbd0)'},...colorThemes];
export const themeById = (id: string) => colorThemes.find(theme => theme.id === id) ?? colorThemes[0];
export const AUTO_BACKGROUND = '#1b1e22';
export function defaultBackground(id: string, _gameId = ''): string { return id === 'game' ? AUTO_BACKGROUND : '#130507'; }
export function sceneAppearance(id: string, gameId: string, backgroundColor?: string) {
  const custom = normalizeBackgroundColor(backgroundColor), base = defaultBackground(id,gameId);
  const rgba = custom ? parseBackgroundColor(custom) : undefined;
  if (id !== 'game' && (!rgba || rgba.a === 0)) return undefined;
  const canvas = custom ? custom.slice(0,7) : base;
  const visible = custom ? compositeBackgroundColor(custom,base) : base;
  const colors = backgroundPalette(visible,rgba?.a === 0 ? base : canvas);
  return {canvas,baseCanvas:id === 'game' ? base : undefined,alpha:rgba?.a ?? 1,primary:colors.primary,secondary:colors.secondary,photoOpacity:.18,light:colors.light};
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
  const root = document.documentElement, style = root.style;
  const game = id === 'game' ? gameThemeFor(gameId) : undefined;
  const custom = normalizeBackgroundColor(backgroundColor), base = defaultBackground(id,gameId);
  const canvas = custom ? compositeBackgroundColor(custom,base) : base;
  const representative = custom && parseBackgroundColor(custom).a > 0 ? custom.slice(0,7) : base;
  const colors = backgroundPalette(canvas,representative);
  root.dataset.accent = themeById(id).id;
  root.dataset.autoTheme = 'true';
  if (game) root.dataset.gameTheme = game.id; else delete root.dataset.gameTheme;
  if (colors.light) root.dataset.lightTheme = 'true'; else delete root.dataset.lightTheme;
  const primary = rgb(colors.primary).join(','), secondary = rgb(colors.secondary).join(',');
  const values: Record<string,string> = {
    '--canvas':canvas,'--surface':'transparent','--surface-deep':'transparent',
    '--accent':colors.primary,'--cyan':colors.secondary,'--tint-rgb':primary,'--secondary-rgb':secondary,
    '--text':colors.text,'--text-soft':colors.text,'--muted':colors.muted,'--glow':`rgba(${primary},.18)`,
    '--brand-start':colors.primary,'--brand-end':colors.secondary,
    '--grad':`linear-gradient(135deg,${colors.primary},${colors.secondary})`,
    '--grad-soft':`linear-gradient(135deg,rgba(${primary},.15),rgba(${secondary},.07))`,
    '--hairline':`linear-gradient(135deg,rgba(${primary},.6),rgba(${secondary},.3))`,
    '--edge':`rgba(${primary},.55)`,'--edge-hot':`rgba(${primary},.95)`,
    '--gold':colors.secondary,'--ok':colors.primary,'--warn':colors.secondary,
    'color':colors.text,'color-scheme':colors.light ? 'light' : 'dark',
  };
  Object.entries(values).forEach(([name,value])=>style.setProperty(name,value));
  updateBrandIcon(colors.primary,colors.secondary);
}
