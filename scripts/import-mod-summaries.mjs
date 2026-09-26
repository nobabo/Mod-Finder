import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const input = join(root, 'output/mod-translation-source');
const destination = join(root, 'shared/locales/mod-summaries');
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const games = await readJson(join(root, 'shared/data/games.json'));
const audit = await readJson(join(input, 'translation-audit.json'));
const report = {};
await mkdir(destination, { recursive: true });
for (const game of games) {
  const source = await readJson(join(input, `${game.id}.json`));
  const translated = await readJson(join(input, `${game.id}.ko.json`));
  const findings = audit.games[game.id];
  const excluded = new Set([
    ...findings.leakedMarkers, ...findings.invalidValues, ...findings.blankTranslations, ...findings.unsupportedTranslations,
    ...findings.addedNumbers.map(item => item.title),
    ...findings.omittedMaintenance.map(item => item.title),
    ...findings.placeholderExpansions.map(item => item.title),
  ]);
  const rows = [];
  let withheld = 0;
  for (const [key, original] of Object.entries(source)) {
    const korean = translated[key];
    if (typeof original !== 'string' || !original.trim() || typeof korean !== 'string' || !/[가-힣]/u.test(korean) || korean === original) continue;
    if (excluded.has(key)) { withheld++; continue; }
    // Duplicate titles in the export carry their source-scoped identity explicitly.
    const identity = key.match(/^(.*) \[((?:modrinth|curseforge|thunderstore|nexus|steam):[^\]]+)\]$/s);
    rows.push([identity?.[1] ?? key, original.trim(), korean.trim(), identity?.[2] ?? null]);
  }
  await writeFile(join(destination, `${game.id}.json`), JSON.stringify(rows) + '\n');
  report[game.id] = { imported: rows.length, withheld };
}
await writeFile(join(input, 'import-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ games: report, imported: Object.values(report).reduce((sum, item) => sum + item.imported, 0), withheld: Object.values(report).reduce((sum, item) => sum + item.withheld, 0) }, null, 2));
