export interface GlassTile { width: number; height: number }
export interface GlassAtlas<T> { width: number; height: number; tiles: (T & { x: number; y: number })[] }

// Shelf packing keeps every GPU snapshot within the existing drawing buffer.
// Multiple pages also handle a full-screen lens alongside smaller controls.
export function packGlassAtlas<T extends GlassTile>(tiles: readonly T[], width: number, height: number): GlassAtlas<T>[] {
  const pages: GlassAtlas<T>[] = [];
  let page: GlassAtlas<T> = { width: 0, height: 0, tiles: [] };
  let x = 0; let y = 0; let rowHeight = 0;
  for (const tile of tiles) {
    if (x + tile.width > width) { x = 0; y += rowHeight; rowHeight = 0; }
    if (y + tile.height > height) {
      pages.push(page);
      page = { width: 0, height: 0, tiles: [] };
      x = 0; y = 0; rowHeight = 0;
    }
    page.tiles.push({ ...tile, x, y });
    x += tile.width;
    rowHeight = Math.max(rowHeight, tile.height);
    page.width = Math.max(page.width, x);
    page.height = Math.max(page.height, y + tile.height);
  }
  if (page.tiles.length) pages.push(page);
  return pages;
}
