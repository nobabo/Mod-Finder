import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { root, atomicJson } from '../lib/translation-expansion.mjs';
import { titleCorrections, prepareCatalogTitles, titleSearchCatalog } from '../lib/catalog-titles.mjs';

const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const data = join(root, 'tooling/data');
const correctionFiles = (await readdir(data)).filter(name => /-title-corrections\.ko\.json$/.test(name)).sort();
const corrections = titleCorrections(await Promise.all(correctionFiles.map(async name => {
  const titles = await readJson(join(data, name));
  return name === 'minecraft-title-corrections.ko.json' ? { gameId: 'minecraft-java', titles } : titles;
})));
const candidates = await readJson(join(root, 'output/title-translation/checkpoint.json'));
const reviewed = await readJson(join(root, 'src/shared/locales/mods.ko.json'));
const directory = join(root, 'src/shared/locales/mod-summaries');
const planned = [], search = {}, games = [];
for (const filename of (await readdir(directory)).filter(name => name.endsWith('.json')).sort()) {
  const gameId = filename.slice(0, -5), path = join(directory, filename);
  const original = await readJson(path);
  const rows = prepareCatalogTitles(original, candidates, corrections, reviewed, gameId);
  const unchangedSourceHash = createHash('sha256').update(JSON.stringify(rows.map(row => row.slice(0, 4)))).digest('hex');
  if (JSON.stringify(rows.map(row => row.slice(0, 4))) !== JSON.stringify(original.map(row => row.slice(0, 4)))) throw new Error('Title import changed summary data');
  search[gameId] = titleSearchCatalog(rows);
  games.push({ gameId, count: rows.length, sourceBound: search[gameId].length, originalFourColumnsSha256: unchangedSourceHash,
    korean: rows.filter(row => /[가-힣]/.test(row[4])).length, unchangedNames: rows.filter(row => row[0] === row[4]).length });
  planned.push({ path, rows });
}
const report = { version: 1, method: 'Offline OPUS-MT/M2M100 candidate titles with source-bound existing reviewed names and explicit title corrections; automatic titles are not fully human reviewed',
  correctionFiles, correctionCount: corrections.size, games, total: games.reduce((sum, game) => sum + game.count, 0) };
// Validate the complete set before writing either the render catalogs or search index.
for (const { path, rows } of planned) await atomicJson(path, rows, 0);
await atomicJson(join(root, 'src/shared/locales/mod-titles.ko.json'), search, 0);
await atomicJson(join(data, 'title-translation.manifest.json'), report);
console.log(JSON.stringify(report, null, 2));
