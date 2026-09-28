import { updateBrandIcon } from './brand';

const palette = [
  ['violet','바이올렛','Violet','#956cff','#609bff'],
  ['cyan','시안','Cyan','#1cd1d3','#489af2'],
  ['magenta','마젠타','Magenta','#f564a1','#ff9d6d'],
  ['cobalt','코발트','Cobalt','#367bff','#7866ff'],
  ['emerald','에메랄드','Emerald','#26cd86','#519aff'],
  ['lime','라임','Lime','#bbdf45','#4dcc79'],
  ['amber','앰버','Amber','#ffbc3b','#ff773d'],
  ['coral','코랄','Coral','#ff866d','#ffd495'],
  ['crimson','크림슨','Crimson','#ef3e55','#ff8145'],
  ['rose','로즈','Rose','#ff9dc0','#86b4ff'],
  ['lavender','라벤더','Lavender','#c1abff','#f0baff'],
  ['ice','아이스','Ice','#9de5ff','#b89dff'],
  ['silver','실버','Silver','#bdcbdc','#8eb5ff'],
  ['midnight','미드나이트','Midnight','#526bb8','#bb7d9b'],
] as const;
const rgb = (hex: string) => [1,3,5].map(offset => parseInt(hex.slice(offset,offset + 2),16));
type ThemeEffect = 'none' | 'petals' | 'rain' | 'fire' | 'bamboo';
const effects: Record<typeof palette[number][0], ThemeEffect> = {
  violet:'rain', cyan:'rain', magenta:'petals', cobalt:'rain', emerald:'bamboo',
  lime:'bamboo', amber:'fire', coral:'fire', crimson:'fire', rose:'petals',
  lavender:'petals', ice:'rain', silver:'rain', midnight:'bamboo',
};
export const THEMES = palette.map(([id,ko,en,primary,secondary]) => ({ id,ko,en,primary,secondary,effect:effects[id],rgb:rgb(primary),secondaryRgb:rgb(secondary),grad:`linear-gradient(135deg,${primary},${secondary})` }));
export const themeById = (id: string) => THEMES.find(theme => theme.id === id) ?? THEMES[0];
export function applyTheme(id: string) {
  const theme = themeById(id); const style = document.documentElement.style;
  document.documentElement.dataset.accent = theme.id;
  const tint = (amount: number) => `rgb(${theme.rgb.map(value => Math.round(value * amount)).join(',')})`;
  const values: Record<string,string> = {
    '--tint-rgb':theme.rgb.join(','), '--secondary-rgb':theme.secondaryRgb.join(','),
    '--accent':theme.primary,'--cyan':theme.secondary,'--grad':theme.grad,
    '--canvas':tint(.08),'--surface':tint(.19),'--surface-deep':tint(.12),
    '--muted':`color-mix(in srgb,${theme.primary} 30%,#c0c8da)`,
    '--text-soft':`color-mix(in srgb,${theme.primary} 20%,#f2f5ff)`,
  };
  Object.entries(values).forEach(([name,value]) => style.setProperty(name,value));
  updateBrandIcon(theme.primary);
}
