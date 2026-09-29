import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

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
    if (typeof original !== 'string') throw new Error(`${game.id}: invalid original for ${key}`);
    if (!original.trim()) { skippedEmptyOriginal.push(key); continue; }
    // Duplicate titles in the export carry their source-scoped identity explicitly.
    const identity = key.match(/^(.*) \[((?:modrinth|curseforge|thunderstore|nexus|steam):[^\]]+)\]$/s);
    const manifestItem = identities.get(key);
    rows.push([manifestItem?.name ?? identity?.[1] ?? key, original.trim(), korean.trim(), manifestItem?.listingKey ?? identity?.[2] ?? null]);
  }
  const target = game.target ?? game.id;
  catalogs.set(target, [...(catalogs.get(target) ?? []), ...rows]);
  report[game.id] = { imported: rows.length, skippedEmptyOriginal };
}
// Finish validating every input before replacing any application catalog.
for (const [gameId, rows] of catalogs) {
  const path = join(destination, `${gameId}.json`);
  await writeFile(`${path}.tmp`, JSON.stringify(rows) + '\n');
  await rename(`${path}.tmp`, path);
}
await writeFile(join(input, 'import-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ games: Object.fromEntries(Object.entries(report).map(([id, { imported, skippedEmptyOriginal }]) => [id, { imported, skippedEmptyOriginal: skippedEmptyOriginal.length }])), imported: Object.values(report).reduce((sum, item) => sum + item.imported, 0) }, null, 2));
