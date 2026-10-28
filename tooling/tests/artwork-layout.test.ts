import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { GAMES } from '../../src/shared/games';
import { artworkForGame } from '../../src/web/lib/game-artwork';
import { artworkCoordinates, artworkPosition, readArtworkPosition, saveArtworkPosition } from '../../src/web/lib/artwork-layout';

describe('movable home artwork', () => {
  it('provides bundled main-screen artwork for every supported game, keeping existing characters', () => {
    for (const game of GAMES) {
      const artwork = artworkForGame(game.id)!;
      expect(artwork, game.id).toBeDefined();
      expect(artwork.characters.filter(character => character.name === artwork.representative)).toHaveLength(1);
      for (const character of artwork.characters) {
        expect(existsSync(`src/web/public${character.src}`), game.id).toBe(true);
        expect(character.width).toBeGreaterThan(0);
        expect(character.height).toBeGreaterThan(0);
      }
    }
    expect(artworkForGame('minecraft-java')?.characters).toHaveLength(5);
    expect(artworkForGame('stardew-valley')?.characters).toHaveLength(5);
    for (const id of ['all', 'unknown', '__proto__']) expect(artworkForGame(id)).toBeUndefined();
  });

  it('keeps dragged artwork fully inside the viewport and repositions it on a smaller screen', () => {
    const size = { width: 128, height: 170 }, desktop = { width: 1536, height: 960 };
    const position = artworkPosition(1100, 600, size, desktop);
    expect(artworkCoordinates(position, size, desktop)).toEqual({ left: 1100, top: 600 });
    expect(artworkPosition(-1000, 10000, size, desktop)).toEqual({ x: 0, y: 1 });
    const mobile = { width: 320, height: 740 };
    const moved = artworkCoordinates(position, size, mobile);
    expect(moved.left).toBeGreaterThanOrEqual(8);
    expect(moved.left + size.width).toBeLessThanOrEqual(mobile.width - 8);
    expect(moved.top).toBeGreaterThanOrEqual(8);
    expect(moved.top + size.height).toBeLessThanOrEqual(mobile.height - 8);
    expect(artworkCoordinates({ x: 0, y: 1 }, { width: 100, height: 100 }, { width: 100, height: 100 })).toEqual({ left: 0, top: 0 });
  });

  it('persists positions independently per game and image, and removes only a reset image', () => {
    const data = new Map<string, string>();
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
    saveArtworkPosition(storage, 'minecraft-java:steve', { x: .2, y: .7 });
    saveArtworkPosition(storage, 'minecraft-java:alex', { x: .8, y: .4 });
    saveArtworkPosition(storage, 'stardew-valley:junimo', { x: .5, y: .6 });
    expect(readArtworkPosition(storage, 'minecraft-java:steve')).toEqual({ x: .2, y: .7 });
    saveArtworkPosition(storage, 'minecraft-java:steve');
    expect(readArtworkPosition(storage, 'minecraft-java:steve')).toBeUndefined();
    expect(readArtworkPosition(storage, 'minecraft-java:alex')).toEqual({ x: .8, y: .4 });
    expect(readArtworkPosition(storage, 'stardew-valley:junimo')).toEqual({ x: .5, y: .6 });
  });

  it('ignores corrupt coordinates and supports blocked or full storage', () => {
    for (const raw of ['broken', 'null', '{}', '[]', '{"x":".2","y":0}', '{"x":-1,"y":0}', '{"x":0,"y":2}', '{"x":1e999,"y":0}']) {
      expect(readArtworkPosition({ getItem: () => raw }, 'game:art')).toBeUndefined();
    }
    const blocked = () => { throw Error('blocked'); };
    expect(readArtworkPosition({ getItem: blocked }, 'game:art')).toBeUndefined();
    expect(() => saveArtworkPosition({ setItem: blocked, removeItem: blocked }, 'game:art', { x: .2, y: .3 })).not.toThrow();
    expect(() => saveArtworkPosition({ setItem: blocked, removeItem: blocked }, 'game:art')).not.toThrow();
  });
});
