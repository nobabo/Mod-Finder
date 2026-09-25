import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(root, 'output/mod-translation-source');
const koSubDir = join(sourceDir, 'ko');

const games = [
  'baldurs-gate-3',
  'cities-skylines',
  'cyberpunk-2077',
  'dont-starve-together',
  'fallout-4',
  'lethal-company',
  'minecraft-java',
  'project-zomboid',
  'rimworld',
  'risk-of-rain-2',
  'skyrim-se',
  'stardew-valley',
  'terraria',
  'valheim'
];

const pause = ms => new Promise(res => setTimeout(res, ms));

async function fetchGoogleTranslate(query) {
  const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ko&dt=t';
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: new URLSearchParams({ q: query }).toString(),
        signal: AbortSignal.timeout(15000)
      });
      if (res.ok) {
        const data = await res.json();
        return data[0].map(item => item[0]).filter(Boolean).join('');
      }
      if (res.status === 429 || res.status >= 500) {
        console.warn(`[HTTP ${res.status}] Retrying after pause... (attempt ${attempt + 1})`);
        await pause(1000 * 2 ** attempt);
        continue;
      }
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (attempt === 4) throw err;
      await pause(1000 * 2 ** attempt);
    }
  }
  throw new Error('Translation failed after retries');
}

async function translateSingle(text) {
  if (!text || !text.trim()) return text;
  try {
    const result = await fetchGoogleTranslate(text);
    return result.trim();
  } catch (err) {
    console.error('Failed single translation:', err.message);
    return text;
  }
}

async function translateBatch(items) {
  // items: [{ key, text }]
  if (items.length === 0) return [];
  if (items.length === 1) {
    const tr = await translateSingle(items[0].text);
    return [tr];
  }

  const tokenFor = i => `<<<#${i}#>>>`;
  const query = items.map((it, i) => `${tokenFor(i)} ${it.text}`).join('\n\n');

  try {
    const trans = await fetchGoogleTranslate(query);
    const results = [];
    let hasMissing = false;

    for (let i = 0; i < items.length; i++) {
      const currentToken = tokenFor(i);
      const nextToken = tokenFor(i + 1);
      const startIdx = trans.indexOf(currentToken);
      if (startIdx === -1) {
        hasMissing = true;
        break;
      }
      const contentStart = startIdx + currentToken.length;
      const endIdx = i < items.length - 1 ? trans.indexOf(nextToken, contentStart) : trans.length;
      const part = endIdx !== -1 ? trans.slice(contentStart, endIdx).trim() : trans.slice(contentStart).trim();
      results.push(part);
    }

    if (!hasMissing && results.length === items.length) {
      return results;
    }
  } catch (err) {
    console.warn(`Batch of ${items.length} failed (${err.message}), falling back to single translation...`);
  }

  // Fallback to single translation
  const fallbackResults = [];
  for (const it of items) {
    fallbackResults.push(await translateSingle(it.text));
    await pause(50);
  }
  return fallbackResults;
}

async function processGame(gameId) {
  const srcFile = join(sourceDir, `${gameId}.json`);
  const koFile = join(sourceDir, `${gameId}.ko.json`);
  const subKoFile = join(koSubDir, `${gameId}.json`);

  console.log(`\n=== Processing ${gameId} ===`);
  const original = JSON.parse(await readFile(srcFile, 'utf8'));
  const keys = Object.keys(original);

  let existing = {};
  try {
    existing = JSON.parse(await readFile(koFile, 'utf8'));
  } catch {
    // No existing file
  }

  // Find keys that need translation
  const toTranslate = [];
  for (const key of keys) {
    const val = original[key];
    if (!val || !val.trim()) {
      existing[key] = val; // Empty or whitespace
    } else if (existing[key] && existing[key].trim()) {
      // Already translated
    } else {
      toTranslate.push({ key, text: val });
    }
  }

  const alreadyCount = keys.length - toTranslate.length;
  console.log(`Total: ${keys.length} | Already translated: ${alreadyCount} | Need translation: ${toTranslate.length}`);

  const BATCH_SIZE = 20;
  for (let i = 0; i < toTranslate.length; i += BATCH_SIZE) {
    const chunk = toTranslate.slice(i, i + BATCH_SIZE);
    const translatedTexts = await translateBatch(chunk);

    for (let j = 0; j < chunk.length; j++) {
      existing[chunk[j].key] = translatedTexts[j];
    }

    const currentDone = alreadyCount + i + chunk.length;
    process.stdout.write(`\rProgress: ${currentDone}/${keys.length} (${Math.round((currentDone / keys.length) * 100)}%)`);

    // Periodic save every 100 items or at the end
    if ((i + BATCH_SIZE) % 100 === 0 || i + chunk.length >= toTranslate.length) {
      // Re-order keys to match original
      const ordered = {};
      for (const k of keys) {
        if (existing[k] !== undefined) {
          ordered[k] = existing[k];
        }
      }
      await writeFile(koFile, JSON.stringify(ordered, null, 2) + '\n', 'utf8');
      await writeFile(subKoFile, JSON.stringify(ordered, null, 2) + '\n', 'utf8');
    }

    await pause(150);
  }

  // Final write to ensure perfect key order
  const finalOrdered = {};
  for (const k of keys) {
    finalOrdered[k] = existing[k] !== undefined ? existing[k] : original[k];
  }

  await writeFile(koFile, JSON.stringify(finalOrdered, null, 2) + '\n', 'utf8');
  await writeFile(subKoFile, JSON.stringify(finalOrdered, null, 2) + '\n', 'utf8');
  console.log(`\nCompleted ${gameId}: ${keys.length} entries written to ${gameId}.ko.json and ko/${gameId}.json`);
}

async function main() {
  await mkdir(koSubDir, { recursive: true });
  const targetGame = process.argv.find(arg => arg.startsWith('--game='))?.slice(7);
  const targets = targetGame ? [targetGame] : games;

  for (const gameId of targets) {
    await processGame(gameId);
  }
  console.log('\nAll games successfully processed!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
