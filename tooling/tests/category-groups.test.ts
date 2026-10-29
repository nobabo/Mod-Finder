import { describe, expect, it } from 'vitest';
import { GAME_CATEGORIES } from '../../src/shared/categories';
import { groupCategories } from '../../src/shared/category-groups';

describe('category navigation groups', () => {
  it('keeps every provider category exactly once for every game', () => {
    for (const categories of Object.values(GAME_CATEGORIES)) {
      const grouped = groupCategories(categories).flatMap(group => group.categories);
      expect(grouped.map(category => category.id).sort()).toEqual(categories.map(category => category.id).sort());
      expect(grouped.every(category => categories.includes(category))).toBe(true);
    }
  });

  it('groups content and system categories without merging their source IDs', () => {
    const labels = ['Equipment', 'Magic', 'Technology', 'Adventure', 'Bug Fixes', 'Library', 'Game Mechanics', 'Optimization'];
    const categories = labels.map((en, i) => ({ id: `source:${i}`, ko: en, en }));
    const result = groupCategories(categories);
    expect(result.find(group => group.id === 'content')?.categories).toEqual(categories.slice(0, 4));
    expect(result.find(group => group.id === 'system')?.categories).toEqual(categories.slice(4));
    const sameLabel = [{ id:'steam:0', ko:'모험', en:'Adventure' }, { id:'nexus:0', ko:'모험', en:'Adventure' }];
    expect(groupCategories(sameLabel)[0].categories).toEqual(sameLabel);
  });

  it('keeps unknown categories reachable and omits empty groups', () => {
    expect(groupCategories([])).toEqual([]);
    const other = { id: 'source:future', ko: '새 장르', en: 'Future Category' };
    expect(groupCategories([other])).toEqual([{ id:'other', ko:'기타', en:'Other', categories:[other] }]);
  });
});
