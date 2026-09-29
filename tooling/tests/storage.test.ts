import { describe, expect, it, vi } from 'vitest';
import { emptyLocalData, parseLocalData, saveLocalData, refreshFavoriteReferences, toggleFavorite, moveFavorite } from '../../src/web/lib/storage';
import { mapModrinth } from '../../src/server/adapters';
import { GAMES } from '../../src/shared/games';
const item = mapModrinth({ project_id: 'saved', title: 'Saved', categories: [] }, GAMES[0], 1);
describe('persisted data boundary', () => {
  it('stores CurseForge bookmarks as references and restores their folder membership', async () => {
    const cf = { ...item, source: 'curseforge' as const, scope: '432', id: '123', key: 'curseforge:432:123', title: 'Private API title', summary: 'API description', url: 'https://www.curseforge.com/minecraft/mc-mods/example' };
    const data = moveFavorite(toggleFavorite({ ...emptyLocalData(), folders: [{ id: 'one', name: 'One', keys: [] }] }, cf), cf.key, 'one');
    const setItem = vi.fn(); vi.stubGlobal('window', {}); vi.stubGlobal('localStorage', { setItem });
    try {
      await saveLocalData(data);
      const raw = setItem.mock.calls[0][1]; const stored = JSON.parse(raw);
      expect(stored.favorites).toEqual([{ source: 'curseforge', scope: '432', id: '123', key: cf.key, gameId: cf.gameId, referenceOnly: true }]);
      expect(raw).not.toContain(cf.title); expect(raw).not.toContain(cf.summary);
      const restored = parseLocalData(raw);
      expect(restored.folders[0].keys).toEqual([cf.key]);
      const fresh = await refreshFavoriteReferences(restored, async () => cf);
      expect(fresh.favorites).toEqual([cf]);
      expect(toggleFavorite(fresh, cf).favorites).toEqual([]);
      expect(toggleFavorite(fresh, cf).folders[0].keys).toEqual([]);
      expect(await refreshFavoriteReferences(restored, async () => { throw Error('offline'); })).toEqual(restored);
      expect(await refreshFavoriteReferences(restored, async () => item)).toEqual(restored);
      expect(parseLocalData(JSON.stringify({ ...data, compared: [cf, item] })).compared).toEqual([item]);
    } finally { vi.unstubAllGlobals(); }
  });
  it('rejects malformed bookmark references', () => {
    const ref = { source: 'curseforge', scope: '432', id: '123', key: 'curseforge:432:123', gameId: 'minecraft-java', referenceOnly: true };
    for (const invalid of [{ ...ref, id: '../bad' }, { ...ref, scope: 'wrong' }, { ...ref, key: 'wrong' }]) expect(() => parseLocalData(JSON.stringify({ ...emptyLocalData(), favorites: [invalid] }))).toThrow('invalid_local_data');
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
