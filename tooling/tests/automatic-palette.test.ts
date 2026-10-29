import { describe, expect, it } from 'vitest';
import { backgroundPalette, compositeBackgroundColor, contrastRatio, normalizeBackgroundColor, parseBackgroundColor } from '../../src/web/lib/background-color';
import { AUTO_BACKGROUND, defaultBackground, sceneAppearance, THEMES } from '../../src/web/lib/themes';
import { GAMES } from '../../src/shared/games';
import gameColors from '../../src/shared/data/game-theme-colors.json';

describe('automatic background palette', () => {
  it('uses distinct RGBA defaults for every game while explicit colors override them', () => {
    expect(THEMES[0].ko).toBe('기본 색상');
    expect(Object.keys(gameColors).sort()).toEqual(GAMES.map(game => game.id).sort());
    expect(defaultBackground('game','minecraft-java')).toBe('#18645266');
    expect(new Set(Object.values(gameColors)).size).toBe(GAMES.length);
    for (const game of GAMES) {
      const color = defaultBackground('game',game.id);
      expect(normalizeBackgroundColor(color)).toBe(color);
      expect(parseBackgroundColor(color).a).toBe(.4);
      expect(parseBackgroundColor(color).a).toBeLessThan(1);
      expect(sceneAppearance('game',game.id)?.alpha).toBe(parseBackgroundColor(color).a);
      expect(sceneAppearance('game',game.id,'#a5c5e5')).toEqual(sceneAppearance('game','minecraft-java','#a5c5e5'));
      expect(sceneAppearance('game',game.id,'#ffffff80','#f1e8d4')).toEqual(sceneAppearance('game','minecraft-java','#ffffff80','#f1e8d4'));
    }
    for (const game of ['all','unknown','__proto__']) expect(defaultBackground('game',game)).toBe(AUTO_BACKGROUND);
  });
  it('keeps renderer colors and contrast in step for game defaults on bright and dark photos', () => {
    for (const game of GAMES) for (const photo of ['#f1e8d4','#101820']) {
      const color = defaultBackground('game',game.id), appearance = sceneAppearance('game',game.id,undefined,photo)!;
      const composite = compositeBackgroundColor(color,photo);
      const expected = backgroundPalette(composite,color.slice(0,7));
      expect(appearance.primary).toBe(expected.primary);
      expect(appearance.light).toBe(expected.light);
      for (const foreground of [expected.primary,expected.secondary,expected.text,expected.muted]) expect(contrastRatio(foreground,composite)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('keeps text, muted text and foreground accents readable across bright, dark and saturated colors', () => {
    for (const background of ['#ffffff','#000000','#777777','#808080','#ffff00','#ff0000','#00ff00','#0000ff','#efc9c9','#121a24','#735e87']) {
      const palette = backgroundPalette(background);
      for (const color of [palette.text,palette.muted,palette.primary,palette.secondary]) expect(contrastRatio(color,background), `${color} on ${background}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(backgroundPalette('#ffffff').light).toBe(true);
    expect(backgroundPalette('#121a24').light).toBe(false);
  });
  it('follows the selected representative hue while checking contrast against the alpha composite', () => {
    const red = backgroundPalette('#222325','#734c4c'), blue = backgroundPalette('#222325','#4c4c73');
    expect(red.primary).not.toBe(blue.primary);
    expect(parseInt(red.primary.slice(1,3),16)).toBeGreaterThan(parseInt(red.primary.slice(5,7),16));
    expect(parseInt(blue.primary.slice(5,7),16)).toBeGreaterThan(parseInt(blue.primary.slice(1,3),16));
    expect(sceneAppearance('game','minecraft-java','#ffffff00')?.light).toBe(false);
    expect(sceneAppearance('game','minecraft-java','#ffffffff')?.light).toBe(true);
  });
});
