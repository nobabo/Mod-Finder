import { describe, expect, it } from 'vitest';
import { colorHex, compositeBackgroundColor, hsvToRgb, normalizeBackgroundColor, parseBackgroundColor, readBackgroundColor, rgbToHsv } from '../../src/web/lib/background-color';
import { AUTO_BACKGROUND, applyTheme, sceneAppearance } from '../../src/web/lib/themes';
import { afterEach, vi } from 'vitest';

afterEach(() => vi.unstubAllGlobals());

describe('RGBA background colors', () => {
  it('loads existing RGB preferences and preserves RGBA including fully transparent colors', () => {
    expect(parseBackgroundColor('#123456')).toEqual({r:18,g:52,b:86,a:1});
    expect(readBackgroundColor({getItem:()=> '#ABCDEF80'})).toBe('#abcdef80');
    expect(parseBackgroundColor('#abcdef00').a).toBe(0);
    expect(colorHex(parseBackgroundColor('#12345680'))).toBe('#12345680');
    expect(normalizeBackgroundColor('#123456789')).toBeUndefined();
    expect(colorHex({r:-1,g:300,b:12.4,a:2})).toBe('#00ff0c');
  });
  it('round-trips primary, secondary, gray, and black colors through the selection square', () => {
    for (const hex of ['#ff0000','#00ff00','#0000ff','#ffff00','#00ffff','#ff00ff','#999999','#000000','#ffffff','#8acba180']) {
      const rgba = parseBackgroundColor(hex);
      expect(hsvToRgb(rgbToHsv(rgba),rgba.a)).toEqual(rgba);
    }
    expect(hsvToRgb({h:360,s:1,v:1})).toEqual({r:255,g:0,b:0,a:1});
  });
  it('composites alpha over the game default and derives text contrast from the visible color', () => {
    expect(compositeBackgroundColor('#ffffff00','#14251f')).toBe('#14251f');
    expect(compositeBackgroundColor('#ffffff80','#000000')).toBe('#808080');
    expect(sceneAppearance('game','minecraft-java','#ffffff00')?.light).toBe(false);
    expect(sceneAppearance('game','minecraft-java','#ffffffff')?.light).toBe(true);
    const values = new Map<string,string>();
    vi.stubGlobal('document',{documentElement:{dataset:{},style:{setProperty:(name:string,value:string)=>values.set(name,value)}},querySelector:()=>null});
    applyTheme('game','minecraft-java','#ffffff00');
    expect(values.get('--canvas')).toBe(AUTO_BACKGROUND);
    expect(values.get('color-scheme')).toBe('dark');
  });
  it('retains the original Crimson scene for zero alpha and its blend for intermediate alpha', () => {
    expect(sceneAppearance('crimson','minecraft-java','#ffffff00')).toBeUndefined();
    const appearance = sceneAppearance('crimson','minecraft-java','#ffffff80');
    expect(appearance?.baseCanvas).toBeUndefined();
    expect(appearance?.alpha).toBeCloseTo(128/255);
    expect(appearance?.canvas).toBe('#ffffff');
  });
});
