import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(root, 'output/mod-translation-source');

const command = process.argv[2];
const gameId = process.argv[3];

if (command === 'status-all') {
  const games = [
    'baldurs-gate-3', 'cities-skylines', 'cyberpunk-2077', 'dont-starve-together',
    'fallout-4', 'lethal-company', 'minecraft-java', 'project-zomboid',
    'rimworld', 'risk-of-rain-2', 'skyrim-se', 'stardew-valley',
    'terraria', 'valheim'
  ];
  let grandTotal = 0;
  let grandDone = 0;
  for (const g of games) {
    const sFile = join(sourceDir, `${g}.json`);
    const kFile = join(sourceDir, `${g}.ko.json`);
    if (!existsSync(sFile)) continue;
    const orig = JSON.parse(await readFile(sFile, 'utf8'));
    const oKeys = Object.keys(orig);
    let exist = {};
    if (existsSync(kFile)) {
      try { exist = JSON.parse(await readFile(kFile, 'utf8')); } catch (e) {}
    }
    let d = 0;
    for (const k of oKeys) {
      if (!orig[k] || !orig[k].trim() || (exist[k] && exist[k].trim())) {
        d++;
      }
    }
    grandTotal += oKeys.length;
    grandDone += d;
    console.log(`${g.padEnd(22)}: ${d.toString().padStart(4)} / ${oKeys.length} (${Math.round(d / oKeys.length * 100)}%)`);
  }
  console.log('='.repeat(40));
  console.log(`TOTAL:                 : ${grandDone.toString().padStart(4)} / ${grandTotal} (${Math.round(grandDone / grandTotal * 100)}%)`);
  process.exit(0);
}

if (!command || !gameId) {
  console.log("Usage: node helper-translate.mjs <status|status-all|get-untranslated|save-batch> <gameId> [args...]");
  process.exit(1);
}

const srcFile = join(sourceDir, `${gameId}.json`);
const koFile = join(sourceDir, `${gameId}.ko.json`);

if (!existsSync(srcFile)) {
  console.error(`Source file not found: ${srcFile}`);
  process.exit(1);
}

const original = JSON.parse(await readFile(srcFile, 'utf8'));
const origKeys = Object.keys(original);

let existing = {};
if (existsSync(koFile)) {
  try {
    existing = JSON.parse(await readFile(koFile, 'utf8'));
  } catch (e) {
    existing = {};
  }
}

if (command === 'status') {
  let done = 0;
  let empty = 0;
  let missing = 0;
  for (const k of origKeys) {
    const origVal = original[k];
    if (!origVal || !origVal.trim()) {
      empty++;
      done++;
    } else if (existing[k] && existing[k].trim()) {
      done++;
    } else {
      missing++;
    }
  }
  console.log(JSON.stringify({ gameId, total: origKeys.length, done, missing, empty, percent: Math.round((done / origKeys.length) * 100) }));
  process.exit(0);
}

if (command === 'get-untranslated') {
  const limit = parseInt(process.argv[4] || '50', 10);
  const items = [];
  for (const k of origKeys) {
    const origVal = original[k];
    if (origVal && origVal.trim() && (!existing[k] || !existing[k].trim())) {
      items.push({ key: k, text: origVal });
      if (items.length >= limit) break;
    }
  }
  console.log(JSON.stringify(items, null, 2));
  process.exit(0);
}

if (command === 'save-batch') {
  const batchFilePath = process.argv[4];
  if (!batchFilePath || !existsSync(batchFilePath)) {
    console.error(`Batch file not found: ${batchFilePath}`);
    process.exit(1);
  }
  const batchData = JSON.parse(await readFile(batchFilePath, 'utf8'));
  // batchData can be { "Key": "Translated Value" } or [{ "key": "...", "translated": "..." }]
  let added = 0;
  if (Array.isArray(batchData)) {
    for (const item of batchData) {
      if (item.key && item.translated) {
        existing[item.key] = item.translated.trim();
        added++;
      }
    }
  } else if (typeof batchData === 'object' && batchData !== null) {
    for (const [k, v] of Object.entries(batchData)) {
      if (v && typeof v === 'string') {
        existing[k] = v.trim();
        added++;
      }
    }
  }

  // Re-order keys to strictly match original
  const ordered = {};
  for (const k of origKeys) {
    if (existing[k] !== undefined) {
      ordered[k] = existing[k];
    } else if (!original[k] || !original[k].trim()) {
      ordered[k] = original[k];
    }
  }

  await writeFile(koFile, JSON.stringify(ordered, null, 2) + '\n', 'utf8');
  const koSubdirFile = join(sourceDir, 'ko', `${gameId}.json`);
  await writeFile(koSubdirFile, JSON.stringify(ordered, null, 2) + '\n', 'utf8');
  console.log(`Saved ${added} items for ${gameId}. Total saved: ${Object.keys(ordered).length}/${origKeys.length}`);
  process.exit(0);
}
