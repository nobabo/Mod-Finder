import { describe, expect, it } from 'vitest';
import { mergeTranslationExpansion, validateArtifactFile } from '../lib/merge-translation-expansion.mjs';

const row = ['Example', 'Original description', '한국어 설명', 'nexus:game:collection-example'];
const artifact = (rows = [row], kind = 'modpack') => ({ gameId: 'game', kind, source: 'nexus', target: rows.length, count: rows.length, complete: true, rows, items: rows.map(row => ({ key: row[3], kind })) });

describe('translation expansion import', () => {
  it('preserves all baseline translations and remains idempotent', () => {
    const baseline = [['Legacy', 'Original', '기존 설명', null]];
    const merged = mergeTranslationExpansion(baseline, [artifact()], 'game');
    expect(merged.added).toBe(1); expect(merged.rows[0]).toEqual(baseline[0]);
    expect(baseline).toHaveLength(1);
    expect(mergeTranslationExpansion(merged.rows, [artifact()], 'game')).toEqual({ rows: merged.rows, added: 0 });
    const titled = [[...row, '예시 제목']];
    expect(mergeTranslationExpansion(titled, [artifact()], 'game')).toEqual({ rows: titled, added: 0 });
    expect(() => mergeTranslationExpansion([row], [artifact([[...row.slice(0, 2), '다른 번역', row[3]]])], 'game')).toThrow('overwrite');
  });
  it('keeps equal titles with separate source IDs and rejects cross-category duplication', () => {
    const other = [...row.slice(0, 3), 'nexus:game:123'];
    expect(mergeTranslationExpansion([], [artifact([row, other])], 'game').rows).toHaveLength(2);
    expect(() => mergeTranslationExpansion([], [artifact(), artifact([row], 'mod')], 'game')).toThrow('both mods and modpacks');
    expect(() => mergeTranslationExpansion([], [artifact([row, row])], 'game')).toThrow('duplicate');
  });
  it('requires an exhausted provider for shortages and rejects malformed input before import', () => {
    expect(() => mergeTranslationExpansion([], [{ ...artifact(), target: 1000, complete: false }], 'game')).toThrow('exhausted');
    expect(mergeTranslationExpansion([], [{ ...artifact(), target: 1000, complete: false, metadata: { exhausted: true } }], 'game').added).toBe(1);
    expect(() => mergeTranslationExpansion([], [artifact()], 'another-game')).toThrow('artifact');
    expect(() => mergeTranslationExpansion([], [artifact([[row[0], row[1], '<<<#0#>>> 한국어', row[3]]])], 'game')).toThrow('Incomplete');
  });
  it('rejects renamed or changed content from an already registered source ID', () => {
    expect(() => mergeTranslationExpansion([row], [artifact([['Renamed', 'Changed source', '새 번역', row[3]]])], 'game')).toThrow('source identity');
    expect(() => mergeTranslationExpansion([], [artifact(), artifact([['Renamed', row[1], row[2], row[3]]])], 'game')).toThrow('source identity');
  });
  it('rejects false completion claims and incorrect filenames before a batch can be imported', () => {
    expect(() => mergeTranslationExpansion([], [{ ...artifact(), target: 1000 }], 'game')).toThrow('Invalid');
    expect(() => mergeTranslationExpansion([], [{ ...artifact([]), target: 1000 }], 'game')).toThrow('Invalid');
    expect(() => validateArtifactFile('game.modpack.nexus.json', { ...artifact(), target: 1000 }, new Set(['game']))).not.toThrow();
    expect(() => validateArtifactFile('game.mod.nexus.json', { ...artifact(), target: 1000 }, new Set(['game']))).toThrow('filename');
    expect(() => validateArtifactFile('game.modpack.nexus.json', { ...artifact(), target: 1000 }, new Set(['other']))).toThrow('filename');
  });
});
