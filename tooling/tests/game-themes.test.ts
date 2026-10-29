import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import backgrounds from '../../src/shared/data/game-theme-backgrounds.json';
import { GAME_THEMES, gameThemeFor } from '../../src/web/lib/game-themes';
import { AUTO_BACKGROUND, applyTheme, defaultBackground, readThemePreference, sceneAppearance, THEMES } from '../../src/web/lib/themes';
import { backgroundPalette, compositeBackgroundColor, isLightBackground, normalizeBackgroundColor, readBackgroundColor } from '../../src/web/lib/background-color';

afterEach(() => vi.unstubAllGlobals());

describe('game default themes', () => {
  const preference = (values: Record<string, string>) => readThemePreference({ getItem: key => values[key] ?? null });

  it('migrates removed color choices including Crimson to the game default', () => {
    expect(THEMES.map(theme => theme.id)).toEqual(['game']);
    expect(preference({})).toBe('game');
    expect(preference({ 'modfinder-accent': 'magenta' })).toBe('game');
    expect(preference({ 'modfinder-accent': 'cyan' })).toBe('game');
    expect(preference({ 'modfinder-theme': 'magenta', 'modfinder-accent': 'cyan' })).toBe('game');
    expect(preference({ 'modfinder-accent': 'crimson' })).toBe('game');
    expect(preference({ 'modfinder-theme': 'crimson' })).toBe('game');
    expect(preference({ 'modfinder-theme': 'game', 'modfinder-accent': 'cyan' })).toBe('game');
    expect(preference({ 'modfinder-theme': 'unknown' })).toBe('game');
    expect(readThemePreference({ getItem: () => { throw new Error('blocked storage'); } })).toBe('game');
  });

  it('keeps game artwork and derives the palette from each game default', () => {
    const values = new Map<string, string>();
    const root = { dataset: {} as Record<string, string>, style: { setProperty: (name: string, value: string) => values.set(name, value) } };
    vi.stubGlobal('document', { documentElement: root, querySelector: () => null });
    applyTheme('game', 'minecraft-java');
    expect(root.dataset.gameTheme).toBe('minecraft');
    expect(values.get('--canvas')).toBe(compositeBackgroundColor('#18645242',AUTO_BACKGROUND));
    expect(values.get('--brand-start')).toBe(backgroundPalette(values.get('--canvas')!,'#186452').primary);
    expect(root.dataset.photoReveal).toBe('true');
    expect(values.get('color-scheme')).toBe('dark');
    expect(values.get('--text')).toBe(backgroundPalette(values.get('--canvas')!).text);
    expect(sceneAppearance('game', 'minecraft-java')?.light).toBe(false);
    applyTheme('game', 'stardew-valley');
    expect(root.dataset.gameTheme).toBe('stardew');
    expect(values.get('--canvas')).toBe(compositeBackgroundColor(defaultBackground('game','stardew-valley'),AUTO_BACKGROUND));
    expect(sceneAppearance('game', 'stardew-valley')?.light).toBe(false);
    applyTheme('crimson', 'stardew-valley');
    expect(root.dataset.gameTheme).toBe('stardew');
    expect(values.get('color-scheme')).toBe('dark');
    expect(values.get('--text')).toBe(backgroundPalette(values.get('--canvas')!).text);
    expect(values.get('--accent')).toBe(sceneAppearance('game','stardew-valley')?.primary);
    expect(values.get('--brand-start')).toBe(sceneAppearance('game','stardew-valley')?.primary);
    applyTheme('game', 'all');
    expect(root.dataset.gameTheme).toBeUndefined();
    expect(root.dataset.accent).toBe('game');
    expect(gameThemeFor('valheim')).toBeUndefined();
    expect(gameThemeFor('__proto__')).toBeUndefined();
  });

  it('accepts only full hex background colors and handles unavailable storage', () => {
    expect(normalizeBackgroundColor('#ABC123')).toBe('#abc123');
    expect(readBackgroundColor({ getItem: () => '#E5D0B0' })).toBe('#e5d0b0');
    for (const color of [null, undefined, 123, '#fff', 'red', '#1234567', '#12xx56', ' #123456', 'var(--canvas)']) {
      expect(normalizeBackgroundColor(color)).toBeUndefined();
    }
    expect(readBackgroundColor({ getItem: () => { throw Error('blocked'); } })).toBeUndefined();
  });

  it('adapts text and glass to custom light/dark backgrounds, restoring defaults on reset', () => {
    const values = new Map<string, string>();
    const root = { dataset: {} as Record<string, string>, style: { setProperty: (name: string, value: string) => values.set(name, value) } };
    vi.stubGlobal('document', { documentElement: root, querySelector: () => null });
    applyTheme('crimson', 'minecraft-java', '#e5d0b0');
    expect(root.dataset.lightTheme).toBe('true');
    expect(root.dataset.gameTheme).toBe('minecraft');
    expect(values.get('--canvas')).toBe('#e5d0b0');
    expect(values.get('color-scheme')).toBe('light');
    expect(values.get('--text')).toBe(backgroundPalette('#e5d0b0').text);
    expect(sceneAppearance('crimson', 'minecraft-java', '#e5d0b0')?.light).toBe(true);
    applyTheme('game', 'minecraft-java', '#101820');
    expect(root.dataset.gameTheme).toBe('minecraft');
    expect(root.dataset.lightTheme).toBeUndefined();
    expect(values.get('--canvas')).toBe('#101820');
    expect(values.get('--text')).toBe(backgroundPalette(values.get('--canvas')!).text);
    expect(values.get('color-scheme')).toBe('dark');
    expect(sceneAppearance('game','minecraft-java','#101820')?.primary).toBe(sceneAppearance('game','stardew-valley','#101820')?.primary);
    applyTheme('game', 'minecraft-java');
    expect(root.dataset.lightTheme).toBeUndefined();
    expect(values.get('--canvas')).toBe(compositeBackgroundColor(defaultBackground('game','minecraft-java'),AUTO_BACKGROUND));
    applyTheme('crimson', 'minecraft-java');
    expect(root.dataset.lightTheme).toBeUndefined();
    expect(sceneAppearance('crimson', 'minecraft-java')).toEqual(sceneAppearance('game', 'minecraft-java'));
    expect(defaultBackground('crimson', 'minecraft-java')).toBe(defaultBackground('game', 'minecraft-java'));
    expect(isLightBackground('#ffffff')).toBe(true);
    expect(isLightBackground('#000000')).toBe(false);
  });

  it('bundles every character locally as a static WebP', () => {
    for (const theme of Object.values(GAME_THEMES)) {
      expect(theme.characters).toHaveLength(2);
      expect(new Set(theme.characters.map(character => character.src)).size).toBe(2);
      for (const character of theme.characters) {
        const path = `src/web/public${character.src}`;
        expect(existsSync(path)).toBe(true);
        const file = readFileSync(path);
        expect(file.toString('ascii', 0, 4)).toBe('RIFF');
        expect(file.toString('ascii', 8, 12)).toBe('WEBP');
        expect(file.includes(Buffer.from('ANIM'))).toBe(false);
      }
    }
  });

  it('ships five distinct, locally bundled photographs for each game default', () => {
    for (const [gameId, photos] of Object.entries(backgrounds)) {
      expect(gameThemeFor(gameId)).toBeDefined();
      expect(photos).toHaveLength(5);
      expect(new Set(photos.map(photo => photo.sourceUrl)).size).toBe(5);
      const hashes = photos.map(photo => {
        expect(photo.src).toMatch(new RegExp(`^/theme-backgrounds/${gameId}/`));
        expect(photo.sourceUrl).toMatch(/^https:\/\/(www\.minecraft\.net|www\.stardewvalley\.net)\//);
        expect(photo.width).toBeGreaterThanOrEqual(800);
        expect(photo.height).toBeGreaterThanOrEqual(400);
        return createHash('sha256').update(readFileSync(`src/web/public${photo.src}`)).digest('hex');
      });
      expect(new Set(hashes).size).toBe(5);
    }
  });
});
