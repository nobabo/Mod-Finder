import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { prepareAndroidAssets } from '../scripts/prepare-android';

describe('Android artwork packaging', () => {
  it('keeps versioned image references and rankings while removing previous bundled images', () => {
    const base = resolve('output');
    mkdirSync(base, { recursive: true });
    const target = mkdtempSync(resolve(base, 'android-assets-test-'));
    try {
      const oldImage = resolve(target, 'games/minecraft-java.png');
      mkdirSync(dirname(oldImage), { recursive: true });
      writeFileSync(oldImage, 'previous generated artwork');
      const prepared = prepareAndroidAssets(target);
      const catalog = JSON.parse(readFileSync(resolve(target, 'catalog.json'), 'utf8'));
      expect(existsSync(oldImage)).toBe(false);
      expect(prepared.remoteImages).toBeGreaterThan(100);
      expect(Object.keys(catalog.assetRevisions)).toHaveLength(prepared.remoteImages);
      for (const [path, revision] of Object.entries(catalog.assetRevisions)) {
        const bytes = readFileSync(resolve('src/web/public', path.slice(1)));
        expect(revision).toBe(createHash('sha256').update(path.endsWith('.svg') ? bytes.toString('utf8').replace(/\r\n/g, '\n') : bytes).digest('hex'));
      }
      expect(catalog.rankings).toEqual(JSON.parse(readFileSync('src/shared/data/community-rankings.json', 'utf8')));
      expect(readdirSync(resolve(target, 'summaries'))).toHaveLength(prepared.games);
      expect(readdirSync(target, { recursive: true }).filter(file => /\.(?:png|jpe?g|webp|svg)$/i.test(String(file)))).toEqual([]);
    } finally {
      if (!target.startsWith(base + sep + 'android-assets-test-')) throw new Error('Unexpected generated test directory');
      rmSync(target, { recursive: true });
    }
  });
});
