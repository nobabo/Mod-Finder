import { describe, expect, it } from 'vitest';
import { emptyLocalData, parseLocalData } from '../src/lib/storage';
import { mapModrinth } from '../server/adapters';
import { GAMES } from '../shared/games';
const item = mapModrinth({ project_id: 'saved', title: 'Saved', categories: [] }, GAMES[0], 1);
describe('persisted data boundary', () => {
  it('retains game-specific category history alongside older history', () => {
    const data = { ...emptyLocalData(), history: [{ gameId: 'minecraft-java', query: 'sodium', category: 'modrinth:optimization' }, { gameId: 'stardew-valley', query: 'farm' }] };
    expect(parseLocalData(JSON.stringify(data)).history).toEqual(data.history);
    expect(() => parseLocalData(JSON.stringify({ ...data, history: [{ gameId: 'skyrim-se', query: 'farm', category: 'nexus:Crops' }] }))).toThrow('invalid_local_data');
  });
  it('preserves valid favorites and older collections without compared', () => {
    const data = { ...emptyLocalData(), favorites: [item], compared: undefined };
    expect(parseLocalData(JSON.stringify(data))).toEqual({ ...data, compared: [] });
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
