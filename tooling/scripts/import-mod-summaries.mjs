import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { validateCatalogText } from '../lib/catalog-text.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const input = join(root, 'output/mod-translation-source');
const destination = join(root, 'src/shared/locales/mod-summaries');
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const games = await readJson(join(root, 'src/shared/data/games.json'));
const report = {};
const catalogs = new Map();
await mkdir(destination, { recursive: true });
for (const game of [...games, { id: 'curseforge/minecraft-mods', target: 'minecraft-java' }, { id: 'curseforge/minecraft-modpacks', target: 'minecraft-java' }]) {
  const source = await readJson(join(input, `${game.id}.json`));
  const translated = await readJson(join(input, `${game.id}.ko.json`));
  if (Object.keys(source).length !== Object.keys(translated).length ||
      Object.keys(source).some(key => !Object.hasOwn(translated, key) || typeof translated[key] !== 'string')) {
    throw new Error(`${game.id}: translation keys or values do not match the original`);
  }
  const manifest = game.target ? (await readJson(join(input, `${game.id}.manifest.json`))).items : null;
  const identities = new Map((manifest ?? []).map(item => [item.key, item]));
  if (manifest && (identities.size !== Object.keys(source).length || manifest.length !== identities.size ||
      new Set(manifest.map(item => item.listingKey)).size !== manifest.length ||
      Object.keys(source).some(key => !identities.has(key)) ||
      manifest.some(item => typeof item.name !== 'string' || !item.name.trim() || !/^curseforge:432:\d+$/.test(item.listingKey)))) {
    throw new Error(`${game.id}: invalid source identity manifest`);
  }
  const rows = [];
  const skippedEmptyOriginal = [];
  for (const [key, original] of Object.entries(source)) {
    const korean = translated[key];
    validateCatalogText(original, `${game.id}: original`, 1800);
    validateCatalogText(korean, `${game.id}: translation`);
    if (!original.trim()) { skippedEmptyOriginal.push(key); continue; }
    // Duplicate titles in the export carry their source-scoped identity explicitly.
    const identity = key.match(/^(.*) \[((?:modrinth|curseforge|thunderstore|nexus|steam):[^\]]+)\]$/s);
    const manifestItem = identities.get(key);
    const title = validateCatalogText(manifestItem?.name ?? identity?.[1] ?? key, `${game.id}: title`, 512);
    rows.push([title, original.trim(), korean.trim(), manifestItem?.listingKey ?? identity?.[2] ?? null]);
  }
  const target = game.target ?? game.id;
  catalogs.set(target, [...(catalogs.get(target) ?? []), ...rows]);
  report[game.id] = { imported: rows.length, skippedEmptyOriginal };
}
// Read every previous catalog as part of validation before replacing any file.
const planned = [];
for (const [gameId, rows] of catalogs) {
  const path = join(destination, `${gameId}.json`);
  // Preserve later source-scoped expansions when reimporting older source files.
  let previous = [];
  try { previous = await readJson(path); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const identity = row => JSON.stringify([row[0], row[1], row[3]]);
  const incoming = new Set(rows.map(identity));
  const merged = [...rows, ...previous.filter(row => row[3] && !incoming.has(identity(row)))];
  planned.push({ path, merged });
}
for (const { path, merged } of planned) {
  await writeFile(`${path}.tmp`, JSON.stringify(merged) + '\n');
  await rename(`${path}.tmp`, path);
}
await writeFile(join(input, 'import-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ games: Object.fromEntries(Object.entries(report).map(([id, { imported, skippedEmptyOriginal }]) => [id, { imported, skippedEmptyOriginal: skippedEmptyOriginal.length }])), imported: Object.values(report).reduce((sum, item) => sum + item.imported, 0) }, null, 2));
