import { expect, it } from 'vitest';
import { reusableThunderstoreArtifact as reusable } from '../scripts/expand-thunderstore-translations.mjs';

const candidates = Array.from({ length: 1000 }, (_, index) => ({ key: `thunderstore:valheim:Team-Package${index}`, title: `Package${index}`, summary: '<b>Original</b> summary' }));
const artifact = () => ({ gameId: 'valheim', kind: 'modpack', source: 'thunderstore', complete: true, count: 1000,
  rows: candidates.map(item => [item.title, 'Original summary', '직접 검수한 한국어 설명', item.key]), metadata: { sampleReview: { count: 25 } } });

it('preserves completed, reviewed artifacts when their entire source selection still matches', () => {
  expect(reusable(artifact(), 'valheim', 'modpack', candidates)).toBe(true);
});
it('rejects a stale source snapshot, even when game, kind, and count are unchanged', () => {
  const changed = candidates.map((item, index) => index ? item : { ...item, summary: 'Changed source description' });
  expect(reusable(artifact(), 'valheim', 'modpack', changed)).toBe(false);
  expect(reusable(artifact(), 'valheim', 'modpack', candidates.slice(1))).toBe(false);
  expect(reusable(artifact(), 'lethal-company', 'modpack', candidates)).toBe(false);
  expect(reusable(artifact(), 'valheim', 'mod', candidates)).toBe(false);
});
it('rejects incomplete, duplicate, or malformed artifacts rather than preserving them as completed work', () => {
  expect(reusable({ ...artifact(), count: 999 }, 'valheim', 'modpack', candidates)).toBe(false);
  const duplicate = artifact(); duplicate.rows[1] = duplicate.rows[0];
  expect(reusable(duplicate, 'valheim', 'modpack', candidates)).toBe(false);
  const malformed = artifact(); malformed.rows[0] = null;
  expect(reusable(malformed, 'valheim', 'modpack', candidates)).toBe(false);
});
