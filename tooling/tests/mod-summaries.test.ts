import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { GAMES } from '../../src/shared/games';
import { registerModSummaries, translatedModSummary, withReviewedSummaries, type SummaryTranslation } from '../../src/shared/mod-summaries';
import { listingText } from '../../src/shared/content';
import { mapModrinth, mapCurseforge } from '../../src/server/adapters';

interface ExpansionReport {
  total: number;
  games: { gameId: string; baseline: number; baselineSha256: string; added: number; total: number }[];
  buckets: { gameId: string; source: string; kind: string; target: number; count: number; complete: boolean; metadata: { exhausted?: boolean }; listingKeys: string[] }[];
}
const expansionReport = () => JSON.parse(readFileSync('tooling/data/translation-expansion.manifest.json', 'utf8')) as ExpansionReport;

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
      const rows = JSON.parse(readFileSync(`src/shared/locales/mod-summaries/${game.id}.json`, 'utf8')) as SummaryTranslation[];
      expect(rows.length).toBeGreaterThan(0);
      for (const [title, original, korean, key] of rows) {
        expect(title.trim()).toBeTruthy(); expect(original.trim()).toBeTruthy();
        expect(korean).toMatch(/[가-힣]/); expect(korean).not.toMatch(/<<<#\d+#>>>|\[object Object\]|\uFFFD/);
        if (key) expect(key).toMatch(/^(modrinth|curseforge|thunderstore|nexus|steam):[^:]+:.+$/);
      }
      count += rows.length;
    }
    expect(count).toBe(expansionReport().total);
  });
  it('shows reviewed descriptions only for their matching game and original text', () => {
    const reviewed = JSON.parse(readFileSync('src/shared/locales/reviewed-mod-summaries.ko.json', 'utf8')) as Record<string, SummaryTranslation[]>;
    expect(Object.values(reviewed).flat()).toHaveLength(18);
    for (const [gameId, additions] of Object.entries(reviewed)) {
      const rows = JSON.parse(readFileSync(`src/shared/locales/mod-summaries/${gameId}.json`, 'utf8')) as SummaryTranslation[];
      registerModSummaries(gameId, withReviewedSummaries(rows, additions));
      for (const [title, summary, korean, key] of additions) {
        const item = { gameId, title, summary, key: key ?? `nexus:${gameId}:sample` };
        expect(translatedModSummary(item)).toBe(korean);
        expect(translatedModSummary({ ...item, summary: `${summary} changed` })).toBeUndefined();
      }
    }
    expect(reviewed['stardew-valley'].find(row => row[0] === 'Gift Taste Helper')?.[2]).toMatch(/더 이상 유지보수되지 않습니다/);
  });
  it('matches adapter markup and whitespace without accepting a changed description', () => {
    registerModSummaries('minecraft-java', [['Example', '<b>Original</b>  description\n[b]here[/b]', '한국어 설명', 'curseforge:432:123']]);
    const item = mapCurseforge({ id: 123, name: 'Example', summary: '<b>Original</b> description\nhere', links: { websiteUrl: 'https://www.curseforge.com/minecraft/mc-mods/example' } }, GAMES[0], 1);
    expect(translatedModSummary(item)).toBe('한국어 설명');
    expect(translatedModSummary({ ...item, summary: 'Original description changed' })).toBeUndefined();
    expect(translatedModSummary({ ...item, key: 'curseforge:432:456' })).toBeUndefined();
  });
  it('prefers an exact source identity over a generic translation and applies reviewed corrections', () => {
    const rows: SummaryTranslation[] = [['Same', 'Original', '기존 번역', null], ['Same', 'Original', '출처별 번역', 'curseforge:432:123']];
    const reviewed: SummaryTranslation[] = [['Same', 'Original', '검수 번역', null]];
    registerModSummaries('test-game', withReviewedSummaries(rows, reviewed));
    const item = { gameId: 'test-game', title: 'Same', summary: 'Original', key: 'curseforge:432:123' };
    expect(translatedModSummary(item)).toBe('출처별 번역');
    expect(translatedModSummary({ ...item, key: 'modrinth:minecraft:other' })).toBe('검수 번역');
    expect(rows[0][2]).toBe('기존 번역');
  });
  it('loads imported CurseForge mods and modpacks with their original source identities', () => {
    const rows = JSON.parse(readFileSync('src/shared/locales/mod-summaries/minecraft-java.json', 'utf8')) as SummaryTranslation[];
    registerModSummaries('minecraft-java', rows);
    const curseforge = rows.filter(row => row[3]?.startsWith('curseforge:432:'));
    expect(curseforge).toHaveLength(4000);
    expect(new Set(curseforge.map(row => row[3])).size).toBe(4000);
    for (const [title, summary, korean, key] of curseforge) {
      const item = mapCurseforge({ id: Number(key!.split(':')[2]), name: title, summary, links: { websiteUrl: 'https://www.curseforge.com/minecraft/mc-mods/example' } }, GAMES[0], 1);
      expect(translatedModSummary(item)).toBe(korean);
    }
    expect(curseforge.some(row => row[3] === 'curseforge:432:60089')).toBe(true);
    expect(curseforge.some(row => row[3] === 'curseforge:432:285109')).toBe(true);
  });
  it('preserves every original catalog row and ships distinct new IDs for each game and content type', () => {
    const report = expansionReport();
    expect(report.games).toHaveLength(GAMES.length);
    expect(report.games.reduce((sum, game) => sum + game.baseline, 0)).toBe(15972);
    const allNewKeys = new Set<string>();
    for (const game of GAMES) {
      const entry = report.games.find(entry => entry.gameId === game.id)!;
      const rows = JSON.parse(readFileSync(`src/shared/locales/mod-summaries/${game.id}.json`, 'utf8')) as SummaryTranslation[];
      expect(createHash('sha256').update(JSON.stringify(rows.slice(0, entry.baseline))).digest('hex')).toBe(entry.baselineSha256);
      expect(rows).toHaveLength(entry.total); expect(entry.total - entry.baseline).toBe(entry.added);
      const additions = new Map(rows.slice(entry.baseline).map(row => [row[3], row]));
      expect(additions.size).toBe(entry.added);
      expect(entry.added).toBeGreaterThanOrEqual(1000);
      const buckets = report.buckets.filter(bucket => bucket.gameId === game.id);
      expect(buckets.some(bucket => bucket.kind === 'mod' && bucket.count === 1000)).toBe(true);
      expect(buckets.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(entry.added);
      for (const bucket of buckets) {
        expect(bucket.count).toBeLessThanOrEqual(bucket.target);
        expect(bucket.count === bucket.target || bucket.metadata.exhausted).toBe(true);
        expect(bucket.listingKeys).toHaveLength(bucket.count);
        for (const key of bucket.listingKeys) {
          expect(typeof key).toBe('string'); expect(allNewKeys.has(key)).toBe(false); allNewKeys.add(key);
          expect(key.startsWith(`${bucket.source}:${game.sources[bucket.source as keyof typeof game.sources]!.scope}:`)).toBe(true);
          expect(additions.has(key)).toBe(true);
          expect(additions.get(key)![2]).not.toMatch(/<unk>|<pad>|<<<#\d+#>>>/);
        }
      }
    }
    expect(allNewKeys.size + 15972).toBe(report.total);
  });
});
