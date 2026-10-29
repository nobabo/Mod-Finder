import { describe, expect, it } from 'vitest';
import { packGlassAtlas } from '../../src/web/lib/glass-atlas';

describe('glass atlas packing', () => {
  it('packs mixed-size controls without overlapping or exceeding the drawing buffer', () => {
    const tiles = Array.from({ length: 30 }, (_, id) => ({ id, width: 100 + id % 3 * 75, height: 60 + id % 4 * 30 }));
    const pages = packGlassAtlas(tiles, 640, 360);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.flatMap(page => page.tiles.map(tile => tile.id))).toEqual(tiles.map(tile => tile.id));
    for (const page of pages) {
      expect(page.width).toBeLessThanOrEqual(640);
      expect(page.height).toBeLessThanOrEqual(360);
      for (const tile of page.tiles) {
        expect(tile.x + tile.width).toBeLessThanOrEqual(page.width);
        expect(tile.y + tile.height).toBeLessThanOrEqual(page.height);
        for (const other of page.tiles) {
          if (other === tile) continue;
          expect(tile.x + tile.width <= other.x || other.x + other.width <= tile.x
            || tile.y + tile.height <= other.y || other.y + other.height <= tile.y).toBe(true);
        }
      }
    }
  });

  it('starts a new page for a full-screen panel after smaller controls', () => {
    const pages = packGlassAtlas([{ width: 40, height: 40 }, { width: 640, height: 360 }, { width: 40, height: 40 }], 640, 360);
    expect(pages.map(page => page.tiles.length)).toEqual([1, 1, 1]);
    expect(pages.every(page => page.tiles[0].x === 0 && page.tiles[0].y === 0)).toBe(true);
    expect(packGlassAtlas([], 640, 360)).toEqual([]);
  });
});
