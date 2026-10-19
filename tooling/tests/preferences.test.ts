import { describe, expect, it } from 'vitest';
import { preferredGame, readInterests, recommend, recordInterest } from '../../src/web/lib/preferences';
import { emptyLocalData, parseLocalData } from '../../src/web/lib/storage';
import { mapModrinth } from '../../src/server/adapters';
import { GAMES } from '../../src/shared/games';

const now = Date.now();
const game = GAMES.find(g => g.id === 'minecraft-java')!;
const magic = mapModrinth({ project_id: 'magic', title: 'Magic', categories: ['magic'] }, game, 2);
const other = mapModrinth({ project_id: 'other', title: 'Other', categories: [] }, game, 1);
const groups = [other, magic].map(item => ({ id: item.key, listings: [item] }));
describe('local recommendations', () => {
  it('requires explicit opt-in for fresh, legacy and malformed stored preferences', () => {
    expect(emptyLocalData().recommendationsEnabled).toBe(false);
    for (const value of [undefined, false, 'true', 1, null]) {
      expect(parseLocalData(JSON.stringify({ ...emptyLocalData(), recommendationsEnabled: value })).recommendationsEnabled).toBe(false);
    }
    const enabled = parseLocalData(JSON.stringify({ ...emptyLocalData(), recommendationsEnabled: true }));
    expect(parseLocalData(JSON.stringify(enabled)).recommendationsEnabled).toBe(true);
    expect(parseLocalData(JSON.stringify({ ...enabled, recommendationsEnabled: false })).recommendationsEnabled).toBe(false);
  });
  it('combines Korean searches with clicked mod topics without storing provider payloads', () => {
    const events = recordInterest(recordInterest([], game.id, '마법', undefined, now), game.id, '', magic, now + 1);
    expect(recommend(groups, events, now + 2)[0].id).toBe(magic.key);
    expect(events[1].weight).toBe(4);
    expect(events[1].topics).toEqual(['magic']);
    expect(events[1]).not.toHaveProperty('tags');
    expect(events[1]).not.toHaveProperty('title');
  });
  it('bounds and expires signals, rejects malformed data, and suppresses repeated rapid clicks', () => {
    const events = recordInterest([], game.id, '', magic, now);
    expect(recordInterest(events, game.id, '', magic, now + 10)).toEqual(events);
    expect(readInterests([...events, { ...events[0], at: Infinity }, { ...events[0], topics: ['unknown'] }], now)).toEqual(events);
    expect(readInterests(events, now + 91 * 86400000)).toEqual([]);
    expect(readInterests(Array(250).fill(events[0]), now)).toHaveLength(200);
  });
  it('uses recent game activity and keeps interests scoped to their game', () => {
    const old = recordInterest([], 'stardew-valley', '마법', undefined, now - 60 * 86400000);
    const events = recordInterest(old, game.id, '', undefined, now);
    expect(preferredGame(events, now)).toBe(game.id);
    expect(recommend(groups, old, now)).toEqual(groups);
  });
  it('preserves legacy storage and does not rebuild deleted interests from bookmarks or history', () => {
    const data = { ...emptyLocalData(), favorites: [magic], interests: recordInterest([], game.id, '마법', undefined, now) };
    expect(parseLocalData(JSON.stringify(data)).interests).toEqual(data.interests);
    const cleared = parseLocalData(JSON.stringify({ ...data, history: [], interests: [] }));
    expect(cleared.favorites).toEqual([magic]);
    expect(recommend(groups, cleared.interests, now)).toEqual(groups);
    expect(parseLocalData(JSON.stringify(emptyLocalData())).interests).toBeUndefined();
  });
});
