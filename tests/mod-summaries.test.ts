import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { GAMES } from '../shared/games';
import { registerModSummaries, translatedModSummary, type SummaryTranslation } from '../shared/mod-summaries';
import { listingText } from '../shared/content';
import { mapModrinth } from '../server/adapters';

describe('imported Korean summaries', () => {
  it('only applies matching game, title and original description without changing provider data', () => {
    registerModSummaries('minecraft-java', [['Example', 'Original description', '번역된 설명', null]]);
    const item = mapModrinth({ project_id: 'example', title: 'Example', description: 'Original description' }, GAMES[0], 1);
    expect(listingText(item, 'ko')).toMatchObject({ title: 'Example', summary: '번역된 설명', translated: true });
    expect(listingText(item, 'en')).toMatchObject({ summary: 'Original description', translated: false });
    expect(item.summary).toBe('Original description');
    expect(translatedModSummary({ ...item, gameId: 'valheim' })).toBeUndefined();
    expect(translatedModSummary({ ...item, title: 'Another' })).toBeUndefined();
    expect(translatedModSummary({ ...item, summary: 'Changed description' })).toBeUndefined();
    expect(translatedModSummary({ ...item, summary: '' })).toBeUndefined();
  });
  it('honors explicit source IDs and leaves conflicting translations unchanged', () => {
    registerModSummaries('test-game', [
      ['Duplicate', 'Original', '첫 번역', 'steam:1:123'],
      ['Duplicate', 'Original', '다른 번역', 'steam:1:456'],
      ['Ambiguous', 'Original', '첫 번역', null],
      ['Ambiguous', 'Original', '다른 번역', null],
    ]);
    const item = { gameId: 'test-game', title: 'Duplicate', summary: 'Original', key: 'steam:1:123' };
    expect(translatedModSummary(item)).toBe('첫 번역');
    expect(translatedModSummary({ ...item, key: 'steam:1:789' })).toBeUndefined();
    expect(translatedModSummary({ ...item, title: 'Ambiguous' })).toBeUndefined();
  });
  it('ships valid nonempty translation catalogs for all games', () => {
    let count = 0;
    for (const game of GAMES) {
      const rows = JSON.parse(readFileSync(`shared/locales/mod-summaries/${game.id}.json`, 'utf8')) as SummaryTranslation[];
      expect(rows.length).toBeGreaterThan(0);
      for (const [title, original, korean, key] of rows) {
        expect(title.trim()).toBeTruthy(); expect(original.trim()).toBeTruthy();
        expect(korean).toMatch(/[가-힣]/); expect(korean).not.toMatch(/<<<#\d+#>>>|\[object Object\]|\uFFFD/);
        if (key) expect(key).toMatch(/^(modrinth|curseforge|thunderstore|nexus|steam):[^:]+:.+$/);
      }
      count += rows.length;
    }
    expect(count).toBe(11126);
  });
  it('shows the nine reviewed descriptions only for their matching game and original text', () => {
    const reviewed = JSON.parse(readFileSync('shared/locales/reviewed-mod-summaries.ko.json', 'utf8')) as Record<string, SummaryTranslation[]>;
    expect(Object.values(reviewed).flat()).toHaveLength(9);
    for (const [gameId, additions] of Object.entries(reviewed)) {
      const rows = JSON.parse(readFileSync(`shared/locales/mod-summaries/${gameId}.json`, 'utf8')) as SummaryTranslation[];
      registerModSummaries(gameId, [...rows, ...additions]);
      for (const [title, summary, korean, key] of additions) {
        const item = { gameId, title, summary, key: key ?? `nexus:${gameId}:sample` };
        expect(translatedModSummary(item)).toBe(korean);
        expect(translatedModSummary({ ...item, summary: `${summary} changed` })).toBeUndefined();
      }
    }
    expect(reviewed['stardew-valley'].find(row => row[0] === 'Gift Taste Helper')?.[2]).toMatch(/더 이상 유지보수되지 않습니다/);
  });
});
