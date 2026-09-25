import { describe, expect, it } from 'vitest';
import { emptyLocalData, parseLocalData } from '../src/lib/storage';
import { mapModrinth } from '../server/adapters';
import { GAMES } from '../shared/games';
const item = mapModrinth({ project_id: 'saved', title: 'Saved', categories: [] }, GAMES[0], 1);
describe('persisted data boundary', () => {
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
