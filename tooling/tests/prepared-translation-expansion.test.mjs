import { expect, it } from 'vitest';
import { correctionIndex, prepareTranslationRows } from '../lib/prepare-translation-expansion.mjs';

it('applies a reviewed correction only to the exact provider ID and original text', () => {
  const corrections = correctionIndex([{ key: 'nexus:game:1', original: 'Original', korean: '직접 대조한 번역' }]);
  const rows = [['Same title', 'Original', '기존 초안', 'nexus:game:1'], ['Same title', 'Changed', '바뀐 원문의 초안', 'nexus:game:1'], ['Same title', 'Original', '다른 모드의 초안', 'nexus:game:2']];
  const prepared = prepareTranslationRows('test-game', rows, corrections);
  expect(prepared.rows[0][2]).toBe('직접 대조한 번역');
  expect(prepared.rows.slice(1)).toEqual(rows.slice(1));
  expect(prepared.rows[0].filter((_, index) => index !== 2)).toEqual(rows[0].filter((_, index) => index !== 2));
  expect(rows[0][2]).toBe('기존 초안');
});

it('rejects conflicting corrections and keeps source IDs distinct', () => {
  const first = { key: 'steam:1:123', original: 'Original', korean: '첫 번역' };
  expect(() => correctionIndex([first, { ...first, korean: '다른 번역' }])).toThrow('Conflicting');
  expect(correctionIndex([first, { ...first, key: 'steam:1:456', korean: '다른 번역' }]).size).toBe(2);
});

it('keeps reviewed phrasing authoritative over automated terminology repair', () => {
  const key = 'modrinth:minecraft:sample', original = 'A Minecraft modpack with mobs.';
  const corrections = correctionIndex([{ key, original, korean: '몹을 더한 마인크래프트 모드팩입니다.' }]);
  const result = prepareTranslationRows('minecraft-java', [['Example', original, 'Minecraft modpack with 폭도', key]], corrections);
  expect(result.rows[0][2]).toBe('몹을 더한 마인크래프트 모드팩입니다.');
  expect(result.glossaryKeys).toEqual([key]); expect(result.reviewedKeys).toEqual([key]);
});
