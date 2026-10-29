import { describe, expect, it } from 'vitest';
import { prepareCatalogTitles, titleCorrections, titleSearchCatalog } from '../lib/catalog-titles.mjs';
import { repairTitleTerms } from '../lib/title-glossary.mjs';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

describe('catalog title preparation', () => {
  const row = ['Original', 'Original summary', '한국어 설명', 'curseforge:432:123'];
  it('keeps original titles, summaries and identities and gives reviewed names priority', () => {
    const candidates = { Original: { title: '자동 제목' } };
    const corrections = titleCorrections([{ Original: '교정 제목' }]);
    const rows = prepareCatalogTitles([row], candidates, corrections, { [row[3]]: { title: '검수 제목' } });
    expect(rows).toEqual([[...row, '검수 제목']]);
    expect(row).toHaveLength(4);
    expect(prepareCatalogTitles(rows, candidates, corrections, { [row[3]]: { title: '검수 제목' } })).toEqual(rows);
    const legacy = [...row.slice(0, 3), null];
    expect(prepareCatalogTitles([row, legacy], candidates, corrections, { [row[3]]: { title: '검수 제목', searchTerm: 'Original' } })[1][4]).toBe('검수 제목');
  });
  it('rejects missing/conflicting candidates and never infers source identities from titles', () => {
    expect(() => titleCorrections([{ Original: '첫 제목' }, { Original: '다른 제목' }])).toThrow('Conflicting');
    expect(() => prepareCatalogTitles([row], {}, new Map(), {})).toThrow('Missing');
    const second = [...row]; second[3] = 'modrinth:minecraft:123';
    const rows = prepareCatalogTitles([row, second, [...row.slice(0, 3), null]], { Original: { title: '새 제목' } }, new Map(), {});
    expect(titleSearchCatalog(rows)).toEqual([[row[3], row[0], '새 제목'], [second[3], second[0], '새 제목']]);
    expect(() => titleSearchCatalog([...rows, [...row, '상충 제목']])).toThrow('Conflicting');
  });
  it('uses game and source terms to distinguish libraries, brands and ordinary words', () => {
    expect(repairTitleTerms('Fabric Library', '직물 도서관', 'minecraft-java')).toBe('패브릭 라이브러리');
    expect(repairTitleTerms('Fabric Shop', '직물 상점', 'cities-skylines')).toBe('직물 상점');
    expect(repairTitleTerms('Calamity Addon', '재난 애드온', 'terraria')).toBe('칼라미티 애드온');
    expect(repairTitleTerms('Disaster', '재난', 'cities-skylines')).toBe('재난');
    const corrections = titleCorrections([{ Original: '공통 제목' }, { gameId: 'minecraft-java', titles: { Original: '마크 제목' } }]);
    expect(prepareCatalogTitles([row], {}, corrections, {}, 'minecraft-java')[0][4]).toBe('마크 제목');
    expect(prepareCatalogTitles([row], {}, corrections, {}, 'terraria')[0][4]).toBe('공통 제목');
  });
  it('ships a complete title set without changing the four original source/description columns', () => {
    const report = JSON.parse(readFileSync('tooling/data/title-translation.manifest.json', 'utf8'));
    const search = JSON.parse(readFileSync('src/shared/locales/mod-titles.ko.json', 'utf8'));
    let total = 0;
    for (const game of report.games) {
      const rows = JSON.parse(readFileSync(`src/shared/locales/mod-summaries/${game.gameId}.json`, 'utf8'));
      expect(rows).toHaveLength(game.count);
      expect(createHash('sha256').update(JSON.stringify(rows.map(row => row.slice(0, 4)))).digest('hex')).toBe(game.originalFourColumnsSha256);
      for (const row of rows) {
        expect(row).toHaveLength(5); expect(row[4].trim()).toBeTruthy();
        expect(row[4]).not.toMatch(/<unk>|<pad>|<<<#\d+#>>>|상품명\s*:|근처 오락거리|회사 소개|스카이프 8\.49/);
      }
      expect(search[game.gameId]).toEqual(titleSearchCatalog(rows));
      expect(search[game.gameId]).toHaveLength(game.sourceBound);
      total += rows.length;
    }
    expect(total).toBe(40084); expect(report.total).toBe(total);
  });
});
