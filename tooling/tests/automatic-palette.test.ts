import { describe, expect, it } from 'vitest';
import { backgroundPalette, contrastRatio } from '../../src/web/lib/background-color';
import { AUTO_BACKGROUND, defaultBackground, sceneAppearance, THEMES } from '../../src/web/lib/themes';

describe('automatic background palette', () => {
  it('replaces game-specific colors with one automatic preference', () => {
    expect(THEMES[0].ko).toBe('자동 색상');
    for (const game of ['minecraft-java','stardew-valley','valheim','all']) {
      expect(defaultBackground('game',game)).toBe(AUTO_BACKGROUND);
      expect(sceneAppearance('game',game,'#a5c5e5')).toEqual(sceneAppearance('game','minecraft-java','#a5c5e5'));
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
