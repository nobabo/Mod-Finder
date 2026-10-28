export interface ArtworkPosition { x: number; y: number }
export interface ArtworkSize { width: number; height: number }
export interface ArtworkRect extends ArtworkSize { left: number; top: number }
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const storageKey = (id: string) => `modfinder-artwork:${id}`;

function bounds(size: ArtworkSize, viewport: ArtworkSize) {
  const left = Math.min(8, Math.max(0, (viewport.width - size.width) / 2));
  const top = Math.min(8, Math.max(0, (viewport.height - size.height) / 2));
  return { left, top, x: Math.max(0, viewport.width - size.width - left * 2), y: Math.max(0, viewport.height - size.height - top * 2) };
}

/** Store fractions of the available space so a smaller screen keeps artwork reachable. */
export function artworkPosition(left: number, top: number, size: ArtworkSize, viewport: ArtworkSize, obstacles: readonly ArtworkRect[] = []): ArtworkPosition {
  const area = bounds(size, viewport);
  const safe = safeArtworkCoordinates(left,top,size,viewport,obstacles);
  return { x: area.x ? clamp((safe.left - area.left) / area.x) : 0, y: area.y ? clamp((safe.top - area.top) / area.y) : 0 };
}

/** Choose the nearest visible position clear of search and filter controls. */
export function safeArtworkCoordinates(left: number, top: number, size: ArtworkSize, viewport: ArtworkSize, obstacles: readonly ArtworkRect[] = []) {
  const area = bounds(size, viewport);
  const clampX = (x: number) => Math.max(area.left,Math.min(area.left+area.x,x));
  const clampY = (y: number) => Math.max(area.top,Math.min(area.top+area.y,y));
  const origin = { left:clampX(left),top:clampY(top) };
  const overlaps = (point: { left: number; top: number }, box: ArtworkRect) => point.left < box.left+box.width+12 && point.left+size.width > box.left-12 && point.top < box.top+box.height+12 && point.top+size.height > box.top-12;
  if (!obstacles.some(box=>overlaps(origin,box))) return origin;
  const xs = [origin.left,area.left,area.left+area.x,...obstacles.flatMap(box=>[box.left-size.width-12,box.left+box.width+12])].map(clampX);
  const ys = [origin.top,area.top,area.top+area.y,...obstacles.flatMap(box=>[box.top-size.height-12,box.top+box.height+12])].map(clampY);
  const candidates = xs.flatMap(x=>ys.map(y=>({left:x,top:y}))).filter(point=>!obstacles.some(box=>overlaps(point,box)));
  candidates.sort((a,b)=>Math.hypot(a.left-origin.left,a.top-origin.top)-Math.hypot(b.left-origin.left,b.top-origin.top));
  return candidates[0] ?? origin;
}

export function artworkCoordinates(position: ArtworkPosition, size: ArtworkSize, viewport: ArtworkSize, obstacles: readonly ArtworkRect[] = []) {
  const area = bounds(size, viewport);
  return safeArtworkCoordinates(area.left + clamp(position.x) * area.x,area.top + clamp(position.y) * area.y,size,viewport,obstacles);
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
