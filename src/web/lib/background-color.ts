export function normalizeBackgroundColor(value: unknown): string | undefined {
  return typeof value === 'string' && /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(value) ? value.toLowerCase() : undefined;
}

export interface RgbaColor { r: number; g: number; b: number; a: number }
export interface HsvColor { h: number; s: number; v: number }
const clamp = (value: number, max = 1) => Math.max(0, Math.min(max, Number.isFinite(value) ? value : 0));
export function parseBackgroundColor(value: string): RgbaColor {
  const hex = normalizeBackgroundColor(value) ?? '#000000';
  return { r: parseInt(hex.slice(1,3),16), g: parseInt(hex.slice(3,5),16), b: parseInt(hex.slice(5,7),16), a: hex.length === 9 ? parseInt(hex.slice(7,9),16) / 255 : 1 };
}
export function colorHex(color: RgbaColor): string {
  const channel = (value: number) => Math.round(clamp(value,255)).toString(16).padStart(2,'0');
  return '#' + [color.r,color.g,color.b].map(channel).join('') + (color.a >= 1 ? '' : channel(clamp(color.a) * 255));
}
export function colorCss(color: RgbaColor): string { return `rgba(${color.r},${color.g},${color.b},${color.a})`; }
export function compositeBackgroundColor(value: string, base: string): string {
  const color = parseBackgroundColor(value), under = parseBackgroundColor(base);
  return colorHex({ r: color.r * color.a + under.r * (1 - color.a), g: color.g * color.a + under.g * (1 - color.a), b: color.b * color.a + under.b * (1 - color.a), a: 1 });
}
export function rgbToHsv({ r, g, b }: RgbaColor): HsvColor {
  const red = r / 255, green = g / 255, blue = b / 255;
  const max = Math.max(red,green,blue), min = Math.min(red,green,blue), delta = max - min;
  const hue = delta === 0 ? 0 : max === red ? ((green-blue) / delta) % 6 : max === green ? (blue-red) / delta + 2 : (red-green) / delta + 4;
  return { h: (hue * 60 + 360) % 360, s: max === 0 ? 0 : delta / max, v: max };
}
export function hsvToRgb({ h, s, v }: HsvColor, a = 1): RgbaColor {
  const hue = ((h % 360) + 360) % 360 / 60, chroma = clamp(v) * clamp(s), x = chroma * (1 - Math.abs(hue % 2 - 1)), m = clamp(v) - chroma;
  const [r,g,b] = hue < 1 ? [chroma,x,0] : hue < 2 ? [x,chroma,0] : hue < 3 ? [0,chroma,x] : hue < 4 ? [0,x,chroma] : hue < 5 ? [x,0,chroma] : [chroma,0,x];
  return { r: Math.round((r+m)*255), g: Math.round((g+m)*255), b: Math.round((b+m)*255), a: clamp(a) };
}

export function readBackgroundColor(storage: Pick<Storage, 'getItem'>): string | undefined {
  try { return normalizeBackgroundColor(storage.getItem('modfinder-background-color')); }
  catch { return undefined; }
}

export function isLightBackground(hex: string): boolean {
  const channels = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722 > .179;
}

export function lightenAccent(hex: string): string {
  return '#' + [1, 3, 5].map(offset => {
    const value = parseInt(hex.slice(offset, offset + 2), 16);
    return Math.round(value + (255 - value) * .45).toString(16).padStart(2, '0');
  }).join('');
}
