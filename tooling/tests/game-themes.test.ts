import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { GAME_THEMES, gameThemeFor } from '../../src/web/lib/game-themes';
import { applyTheme, readThemePreference } from '../../src/web/lib/themes';

afterEach(() => vi.unstubAllGlobals());

describe('game default themes', () => {
  const preference = (values: Record<string, string>) => readThemePreference({ getItem: key => values[key] ?? null });

  it('migrates the old automatic default while retaining explicit color choices', () => {
    expect(preference({})).toBe('game');
    expect(preference({ 'modfinder-accent': 'magenta' })).toBe('game');
    expect(preference({ 'modfinder-accent': 'cyan' })).toBe('cyan');
    expect(preference({ 'modfinder-theme': 'magenta', 'modfinder-accent': 'cyan' })).toBe('magenta');
    expect(preference({ 'modfinder-theme': 'game', 'modfinder-accent': 'cyan' })).toBe('game');
    expect(preference({ 'modfinder-theme': 'unknown' })).toBe('game');
    expect(readThemePreference({ getItem: () => { throw new Error('blocked storage'); } })).toBe('game');
  });

  it('follows the selected game and fully restores the dark palette when leaving it', () => {
    const values = new Map<string, string>();
    const root = { dataset: {} as Record<string, string>, style: { setProperty: (name: string, value: string) => values.set(name, value) } };
    vi.stubGlobal('document', { documentElement: root, querySelector: () => null });
    applyTheme('game', 'minecraft-java');
    expect(root.dataset.gameTheme).toBe('minecraft');
    expect(values.get('--canvas')).toBe(GAME_THEMES['minecraft-java'].canvas);
    expect(values.get('--brand-start')).toBe(GAME_THEMES['minecraft-java'].brandStart);
    expect(values.get('color-scheme')).toBe('light');
    applyTheme('game', 'stardew-valley');
    expect(root.dataset.gameTheme).toBe('stardew');
    expect(values.get('--canvas')).toBe(GAME_THEMES['stardew-valley'].canvas);
    applyTheme('cyan', 'stardew-valley');
    expect(root.dataset.gameTheme).toBeUndefined();
    expect(values.get('color-scheme')).toBe('dark');
    expect(values.get('--text')).toBe('#eceaff');
    expect(values.get('--accent')).toBe('#1cd1d3');
    expect(values.get('--brand-start')).toBe('#1cd1d3');
    applyTheme('game', 'all');
    expect(root.dataset.gameTheme).toBeUndefined();
    expect(root.dataset.accent).toBe('magenta');
    expect(gameThemeFor('valheim')).toBeUndefined();
    expect(gameThemeFor('__proto__')).toBeUndefined();
  });

  it('bundles every character locally as a static WebP', () => {
    for (const theme of Object.values(GAME_THEMES)) {
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
});
