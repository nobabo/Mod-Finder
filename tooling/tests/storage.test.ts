import { describe, expect, it, vi } from 'vitest';
import { emptyLocalData, parseLocalData, saveLocalData } from '../../src/web/lib/storage';
import { mapModrinth } from '../../src/server/adapters';
import { GAMES } from '../../src/shared/games';
const item = mapModrinth({ project_id: 'saved', title: 'Saved', categories: [] }, GAMES[0], 1);
describe('persisted data boundary', () => {
  it('excludes CurseForge API data from both restored and newly saved collections', async () => {
    const cf = { ...item, source: 'curseforge' as const, scope: '432', id: '123', key: 'curseforge:432:123', url: 'https://www.curseforge.com/minecraft/mc-mods/example' };
    const data = { ...emptyLocalData(), favorites: [cf, item], compared: [cf, item] };
    expect(parseLocalData(JSON.stringify(data))).toMatchObject({ favorites: [item], compared: [item] });
    const setItem = vi.fn();
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', { setItem });
    try {
      await saveLocalData(data);
      expect(JSON.parse(setItem.mock.calls[0][1])).toMatchObject({ favorites: [item], compared: [item] });
      expect(setItem.mock.calls[0][1]).not.toContain('curseforge');
    } finally { vi.unstubAllGlobals(); }
  });
  it('retains game-specific category history alongside older history', () => {
    const data = { ...emptyLocalData(), history: [{ gameId: 'minecraft-java', query: 'sodium', category: 'modrinth:optimization' }, { gameId: 'stardew-valley', query: 'farm' }] };
    expect(parseLocalData(JSON.stringify(data)).history).toEqual(data.history);
    expect(() => parseLocalData(JSON.stringify({ ...data, history: [{ gameId: 'skyrim-se', query: 'farm', category: 'nexus:Crops' }] }))).toThrow('invalid_local_data');
  });
  it('preserves valid favorites and older collections without compared', () => {
    const data = { ...emptyLocalData(), favorites: [item], compared: undefined };
    expect(parseLocalData(JSON.stringify(data))).toEqual({ ...data, compared: [] });
  });
  it('removes saved listings from the retired source while preserving other local data', () => {
    const retired = { ...item, key: 'atlauncher:minecraft:581', source: 'atlauncher', scope: 'minecraft', id: '581', url: 'https://atlauncher.com/pack/SkyFactoryOne' };
    const data = { ...emptyLocalData(), favorites: [retired, item], compared: [retired, item], history: [{ gameId: 'minecraft-java', query: 'sky' }] };
    expect(parseLocalData(JSON.stringify(data))).toEqual({ ...data, favorites: [item], compared: [item] });
  });
  it.each([
    null,
    { ...emptyLocalData(), favorites: [null] },
    { ...emptyLocalData(), favorites: [{ ...item, metrics: null }] },
    { ...emptyLocalData(), favorites: [{ ...item, url: 'javascript:alert(1)' }] },
    { ...emptyLocalData(), compared: [{ ...item, key: 'wrong-source' }] },
    { ...emptyLocalData(), history: [{ gameId: 'missing', query: 'test' }] },
  ])('rejects corrupt or unsafe data without modifying storage', data => {
    expect(() => parseLocalData(JSON.stringify(data))).toThrow('invalid_local_data');
  });
});
