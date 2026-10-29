import { updateBrandIcon } from './brand';
import { gameThemeFor } from './game-themes';
import gameColors from '../../shared/data/game-theme-colors.json';
import { backgroundPalette, compositeBackgroundColor, normalizeBackgroundColor, parseBackgroundColor } from './background-color';

const rgb = (hex: string) => [1,3,5].map(offset => parseInt(hex.slice(offset,offset + 2),16));
type ThemeEffect = 'none' | 'petals' | 'rain' | 'fire' | 'bamboo';
// Keep the persisted ID so existing preferences become automatic without losing artwork.
export const THEMES = [{id:'game',ko:'기본 색상',en:'Default color',primary:'#788894',secondary:'#c4cbd0',effect:'none' as ThemeEffect,rgb:rgb('#788894'),secondaryRgb:rgb('#c4cbd0'),grad:'linear-gradient(135deg,#788894,#c4cbd0)'}];
export const themeById = (_id: string) => THEMES[0];
export const AUTO_BACKGROUND = '#1b1e22';
export function defaultBackground(_id: string, gameId = ''): string {
  return Object.hasOwn(gameColors,gameId) ? gameColors[gameId as keyof typeof gameColors] : AUTO_BACKGROUND;
}
function backgroundAppearance(id: string, gameId: string, backgroundColor?: string, photoColor?: string) {
  const custom = normalizeBackgroundColor(backgroundColor);
  const color = custom ?? defaultBackground(id,gameId), rgba = parseBackgroundColor(color);
  const canvas = color.slice(0,7), under = photoColor ?? AUTO_BACKGROUND;
  const visible = compositeBackgroundColor(color,under);
  const colors = backgroundPalette(visible,rgba.a === 0 ? under : canvas);
  return {custom,rgba,canvas,visible,colors};
}
export function sceneAppearance(id: string, gameId: string, backgroundColor?: string, photoColor?: string) {
  const {rgba,canvas,colors} = backgroundAppearance(id,gameId,backgroundColor,photoColor);
  return {canvas,alpha:rgba.a,primary:colors.primary,secondary:colors.secondary,photoOpacity:.18,light:colors.light};
}
export function readThemePreference(storage: Pick<Storage, 'getItem'>): string {
  try {
    const saved = storage.getItem('modfinder-theme');
    if (THEMES.some(theme => theme.id === saved)) return saved!;
  } catch { /* Use the game default when optional storage is unavailable. */ }
  return 'game';
}
export function applyTheme(id: string, gameId = '', backgroundColor?: string, photoColor?: string) {
  const root = document.documentElement, style = root.style;
  const game = gameThemeFor(gameId);
  const {visible:canvas,rgba,colors} = backgroundAppearance(id,gameId,backgroundColor,photoColor);
  const reveal = 1-rgba.a;
  const shadow = reveal > 0 ? `0 1px 3px rgba(${colors.light ? '255,255,255' : '0,0,0'},${.8*reveal})` : 'none';
  root.dataset.accent = themeById(id).id;
  root.dataset.autoTheme = 'true';
  if (reveal > 0) root.dataset.photoReveal = 'true'; else delete root.dataset.photoReveal;
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
    '--photo-text-shadow':shadow,'text-shadow':shadow,
    'color':colors.text,'color-scheme':colors.light ? 'light' : 'dark',
  };
  Object.entries(values).forEach(([name,value])=>style.setProperty(name,value));
  updateBrandIcon(colors.primary,colors.secondary);
}
