import { afterEach, describe, expect, it, vi } from 'vitest';
import { lastBackground, rememberBackground, shuffleBackgrounds } from '../../src/web/lib/background-order';

afterEach(() => vi.unstubAllGlobals());
const photos = Array.from({ length: 5 }, (_, index) => ({ src: `${index + 1}.webp` }));

describe('shuffled background rounds', () => {
  it('keeps each photograph exactly once without mutating the source collection', () => {
    const original = [...photos];
    const order = shuffleBackgrounds(photos, undefined, () => .25);
    expect(order).not.toEqual(photos);
    expect(order.map(photo => photo.src).sort()).toEqual(photos.map(photo => photo.src).sort());
    expect(photos).toEqual(original);
  });

  it('avoids a repeat when reloading or starting a new round', () => {
    for (const photo of photos) {
      const order = shuffleBackgrounds(photos, photo.src, () => .999);
      expect(order[0].src).not.toBe(photo.src);
      expect(new Set(order.map(item => item.src)).size).toBe(5);
    }
  });

  it('produces varied starts and orders rather than a fixed rotation', () => {
    const starts = new Set<string>();
    const orders = new Set<string>();
    for (let seed = 1; seed <= 24; seed++) {
      let state = seed;
      const random = () => { state = Math.imul(state, 1664525) + 1013904223 | 0; return (state >>> 0) / 4294967296; };
      const order = shuffleBackgrounds(photos, undefined, random);
      starts.add(order[0].src); orders.add(order.map(photo => photo.src).join(','));
    }
    expect(starts.size).toBeGreaterThan(2);
    expect(orders.size).toBeGreaterThan(10);
  });

  it('handles empty and single-image collections', () => {
    expect(shuffleBackgrounds([])).toEqual([]);
    expect(shuffleBackgrounds(photos.slice(0, 1), photos[0].src)).toEqual([photos[0]]);
  });

  it('remembers the last image separately for each game and tolerates blocked storage', () => {
    const saved = new Map<string, string>();
    vi.stubGlobal('sessionStorage', { getItem: (key: string) => saved.get(key), setItem: (key: string, value: string) => saved.set(key, value) });
    rememberBackground('minecraft-java', 'forest.webp');
    rememberBackground('stardew-valley', 'farm.webp');
    expect(lastBackground('minecraft-java')).toBe('forest.webp');
    expect(lastBackground('stardew-valley')).toBe('farm.webp');
    vi.stubGlobal('sessionStorage', { getItem: () => { throw Error('blocked'); }, setItem: () => { throw Error('blocked'); } });
    expect(lastBackground('minecraft-java')).toBeUndefined();
    expect(() => rememberBackground('minecraft-java', 'forest.webp')).not.toThrow();
  });
});
