export function normalizeBackgroundColor(value: unknown): string | undefined {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : undefined;
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
