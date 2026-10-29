export interface ArtworkPosition { x: number; y: number }
export interface ArtworkSize { width: number; height: number }
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const storageKey = (id: string) => `modfinder-artwork:${id}`;

function bounds(size: ArtworkSize, viewport: ArtworkSize) {
  const left = Math.min(8, Math.max(0, (viewport.width - size.width) / 2));
  const top = Math.min(8, Math.max(0, (viewport.height - size.height) / 2));
  return { left, top, x: Math.max(0, viewport.width - size.width - left * 2), y: Math.max(0, viewport.height - size.height - top * 2) };
}

/** Store fractions of the available space so a smaller screen keeps artwork reachable. */
export function artworkPosition(left: number, top: number, size: ArtworkSize, viewport: ArtworkSize): ArtworkPosition {
  const area = bounds(size, viewport);
  return { x: area.x ? clamp((left - area.left) / area.x) : 0, y: area.y ? clamp((top - area.top) / area.y) : 0 };
}

export function artworkCoordinates(position: ArtworkPosition, size: ArtworkSize, viewport: ArtworkSize) {
  const area = bounds(size, viewport);
  return { left: area.left + clamp(position.x) * area.x, top: area.top + clamp(position.y) * area.y };
}

export function readArtworkPosition(storage: Pick<Storage, 'getItem'>, id: string): ArtworkPosition | undefined {
  try {
    const value = JSON.parse(storage.getItem(storageKey(id)) ?? 'null');
    if (value && typeof value.x === 'number' && typeof value.y === 'number' && Number.isFinite(value.x) && Number.isFinite(value.y) && value.x >= 0 && value.x <= 1 && value.y >= 0 && value.y <= 1) return { x: value.x, y: value.y };
  } catch { /* Optional layout storage may be unavailable or contain old data. */ }
}

export function saveArtworkPosition(storage: Pick<Storage, 'setItem' | 'removeItem'>, id: string, position?: ArtworkPosition) {
  try {
    if (position) storage.setItem(storageKey(id), JSON.stringify(position));
    else storage.removeItem(storageKey(id));
  } catch { /* Moving artwork also works without persistent storage. */ }
}
