import { describe, expect, it } from 'vitest';
import { deleteFavoriteFolder, emptyLocalData, moveFavorite, parseLocalData, setShortcutFolder, shortcutFavorites, toggleFavorite } from '../../src/web/lib/storage';
import { mapModrinth } from '../../src/server/adapters';
import { getGame } from '../../src/shared/games';
import { appendStable, groupResults, prioritizeCategories, sortResultGroups } from '../../src/shared/ranking';
import { bucketKey, searchPlan } from '../../src/shared/search-plan';
import { countCommunityMentions } from '../../src/shared/community-ranking';
import snapshot from '../../src/shared/data/community-ranking.json';

const item = mapModrinth({ project_id: 'favorite', title: 'Favorite', downloads: 1 }, getGame('minecraft-java')!, 1);
const categories = ['modrinth:adventure', 'modrinth:magic'];
describe('favorite folders', () => {
  it('keeps one shortcut group and persists its selection across reloads', () => {
    const data = { ...emptyLocalData(), favorites: [item], folders: [{ id: 'one', name: 'One', keys: [item.key] }, { id: 'two', name: 'Two', keys: [] }] };
    const first = parseLocalData(JSON.stringify(setShortcutFolder(data, 'one', true)));
    expect(shortcutFavorites(first)).toEqual([item]);
    const second = setShortcutFolder(first, 'two', true);
    expect(second.shortcutFolderId).toBe('two');
    expect(shortcutFavorites(second)).toEqual([]);
    expect(setShortcutFolder(second, 'one', false).shortcutFolderId).toBe('two');
    expect(setShortcutFolder(second, 'missing', true)).toBe(second);
    expect(setShortcutFolder(second, 'two', false).shortcutFolderId).toBeUndefined();
  });
  it('keeps favorites when deleting groups and clears stale shortcuts', () => {
    const data = { ...emptyLocalData(), favorites: [item], shortcutFolderId: 'one', folders: [{ id: 'one', name: 'One', keys: [item.key] }, { id: 'two', name: 'Two', keys: [] }] };
    expect(deleteFavoriteFolder(data, 'two').shortcutFolderId).toBe('one');
    const deleted = deleteFavoriteFolder(data, 'one');
    expect(deleted.favorites).toEqual([item]);
    expect(deleted.shortcutFolderId).toBeUndefined();
    expect(shortcutFavorites(deleted)).toEqual([]);
    expect(parseLocalData(JSON.stringify({ ...data, shortcutFolderId: 'missing' })).shortcutFolderId).toBeUndefined();
    expect(shortcutFavorites(toggleFavorite(data, item))).toEqual([]);
    expect(shortcutFavorites(moveFavorite(data, item.key, 'two'))).toEqual([]);
  });
  it('migrates existing favorites without requiring a reset', () => {
    const { folders: _, ...legacy } = { ...emptyLocalData(), favorites: [item] };
    expect(parseLocalData(JSON.stringify(legacy))).toEqual({ ...legacy, folders: [] });
  });
  it('moves between folders and unfiled without losing the favorite', () => {
    const initial = { ...emptyLocalData(), favorites: [item], folders: [{ id: 'one', name: 'One', keys: [item.key] }, { id: 'two', name: 'Two', keys: [] }] };
    const moved = moveFavorite(initial, item.key, 'two');
    expect(moved.folders.map(folder => folder.keys)).toEqual([[], [item.key]]);
    const unfiled = moveFavorite(moved, item.key, null);
    expect(unfiled.favorites).toEqual([item]);
    expect(unfiled.folders.every(folder => !folder.keys.length)).toBe(true);
    expect(moveFavorite(initial, item.key, 'missing')).toEqual(initial);
    expect(initial.folders[0].keys).toEqual([item.key]);
  });
  it('removes folder membership when unsaving and adds back to unfiled', () => {
    const initial = { ...emptyLocalData(), favorites: [item], folders: [{ id: 'one', name: 'One', keys: [item.key] }] };
    const removed = toggleFavorite(initial, item);
    expect(removed.favorites).toEqual([]);
    expect(removed.folders[0].keys).toEqual([]);
    const restored = toggleFavorite(removed, item);
    expect(restored.favorites).toEqual([item]);
    expect(restored.folders[0].keys).toEqual([]);
  });
  it('preserves source IDs and cleans dangling and duplicate folder references', () => {
    const result = parseLocalData(JSON.stringify({ ...emptyLocalData(), favorites: [item], folders: [{ id: 'one', name: ' One ', keys: [item.key, item.key, 'missing'] }, { id: 'two', name: 'Two', keys: [item.key] }] }));
    expect(result.folders).toEqual([{ id: 'one', name: 'One', keys: [item.key] }, { id: 'two', name: 'Two', keys: [] }]);
  });
  it('round-trips multiple tags in search history', () => {
    const data = { ...emptyLocalData(), history: [{ gameId: 'minecraft-java', query: 'test', categories }] };
    expect(parseLocalData(JSON.stringify(data))).toEqual(data);
    expect(() => parseLocalData(JSON.stringify({ ...data, history: [{ gameId: 'minecraft-java', query: 'test', categories: ['steam:Map'] }] }))).toThrow();
  });
});
describe('multiple tags', () => {
  it('queries each selected category with independent pagination buckets', () => {
    const plan = searchPlan({ gameId: 'minecraft-java', query: 'magic', filters: { loader: 'fabric' }, categories: [...categories, categories[0]], sort: 'downloads', selectedSource: 'all' });
    expect(plan).toHaveLength(2);
    expect(new Set(plan.map(bucketKey)).size).toBe(2);
    expect(plan.map(request => request.filters)).toEqual(categories.map(category => ({ loader: 'fabric', category })));
    expect(plan.every(request => request.source === 'modrinth')).toBe(true);
  });
  it('places all selected tags first, partial matches next, preserving the chosen sort within each tier', () => {
    const both = { ...item, matchedCategories: categories };
    const one = { ...item, key: 'modrinth:minecraft:one', id: 'one', matchedCategories: [categories[0]], metrics: [{ label: '다운로드', value: 500 }] };
    const other = { ...item, key: 'modrinth:minecraft:other', id: 'other', matchedCategories: [categories[1]], metrics: [{ label: '다운로드', value: 100 }] };
    const result = prioritizeCategories(sortResultGroups(groupResults([other, one, both], ''), 'downloads'), categories);
    expect(result.map(group => group.listings[0].id)).toEqual(['favorite', 'one', 'other']);
  });
  it('merges tag evidence across pages without merging equal titles from different IDs', () => {
    const first = { ...item, matchedCategories: [categories[0]] };
    const second = { ...item, matchedCategories: [categories[1]] };
    const sameTitle = { ...second, key: 'modrinth:minecraft:distinct', id: 'distinct' };
    const result = appendStable([first], [second, sameTitle]);
    expect(result).toHaveLength(2);
    expect(result[0].matchedCategories).toEqual(categories);
    expect(prioritizeCategories(groupResults(result, ''), categories)[0].listings[0].id).toBe(item.id);
  });
});
describe('community ranking', () => {
  it('counts each unique post and each pack once, even with aliases or multiple mentions', () => {
    const posts = [{ id: '1', title: 'GTNH 뉴호 gtnh' }, { id: '1', title: 'GTNH 뉴호 gtnh' }, { id: '2', title: '모니팩하다가 GTNH' }, { id: '3', title: '모니터 추천' }];
    const ranking = countCommunityMentions(posts);
    expect(ranking.map(entry => [entry.id, entry.mentions])).toEqual([['gtnh', 2], ['monifactory', 1]]);
  });
  it('does not conflate distinct pack editions or standalone mods', () => {
    const ranking = countCommunityMentions([{ id: '1', title: 'ATM9 TTS' }, { id: '2', title: 'ATM 9 질문' }, { id: '3', title: 'ATM 10' }, { id: '4', title: 'Create AE2 항공학 코블몬' }]);
    expect(ranking).toHaveLength(3);
    expect(ranking.every(entry => entry.mentions === 1)).toBe(true);
  });
  it('ships a complete, dated 15-page snapshot with ten verifiable counts', () => {
    expect(snapshot.pages).toBe(15);
    expect(snapshot.entries).toHaveLength(10);
    expect(Number.isFinite(Date.parse(snapshot.fetchedAt))).toBe(true);
    expect(snapshot.basis).toBe('titles');
    snapshot.entries.forEach((entry, index) => {
      expect(entry.mentions).toBe(new Set(entry.postIds).size);
      expect(entry.mentions).toBeGreaterThan(0);
      if (index) expect(entry.mentions).toBeLessThanOrEqual(snapshot.entries[index - 1].mentions);
    });
  });
});
