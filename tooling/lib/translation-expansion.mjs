import { readFile, mkdir, writeFile, rename, open, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCatalogText, readTranslationResponse } from './catalog-text.mjs';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const games = JSON.parse(await readFile(join(root, 'src/shared/data/games.json'), 'utf8'));
export const pause = ms => new Promise(done => setTimeout(done, ms));
export async function fetchJson(url, options = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
      if (response.ok) return await response.json();
      await response.body?.cancel();
      if (attempt >= 5 || (response.status !== 429 && response.status < 500)) throw new Error(`Upstream HTTP ${response.status}`);
    } catch (error) { if (attempt >= 5 || /^Upstream HTTP (?!429|5)/.test(error.message)) throw error; }
    await pause(Math.min(30000, 1000 * 2 ** attempt));
  }
}
export const existingCatalog = async gameId => JSON.parse(await readFile(join(root, `src/shared/locales/mod-summaries/${gameId}.json`), 'utf8'));
export async function selectNewCandidates(gameId, items) {
  const baseline = await existingCatalog(gameId);
  const ids = new Set(baseline.map(row => row[3]).filter(Boolean));
  // Old exports lack IDs. Conservatively exclude their titles from *selection*;
  // this never merges identities or changes the application's matching rules.
  const legacyTitles = new Set(baseline.filter(row => !row[3]).map(row => row[0].trim()));
  const seen = new Set();
  return items.filter(item => {
    if (typeof item.key !== 'string' || !/^(modrinth|curseforge|thunderstore|nexus|steam):[^:]+:.+$/.test(item.key)) throw new Error('Invalid source identity');
    // Legacy Nexus exports contain mods, never the separate Collections type.
    const newCollectionType = /^nexus:[^:]+:collection-/.test(item.key);
    if (seen.has(item.key) || ids.has(item.key) || (!newCollectionType && legacyTitles.has(item.title?.trim()))) return false;
    seen.add(item.key);
    return typeof item.title === 'string' && item.title.trim() && typeof item.summary === 'string' && item.summary.trim();
  });
}
export async function atomicJson(path, value, space = 2) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(`${path}.tmp`, JSON.stringify(value, null, space) + '\n', 'utf8');
  await rename(`${path}.tmp`, path);
}
const clean = value => value.slice(0, 1800).replace(/<[^>]*>/g, '').replace(/\[\/?[a-z][^\]]*\]/gi, '').trim();
async function translationSlot() {
  const directory = join(root, 'output/translation-expansion');
  await mkdir(directory, { recursive: true });
  const lock = join(directory, '.translation-rate.lock');
  let handle;
  for (;;) {
    try { handle = await open(lock, 'wx'); break; }
    catch (error) { if (error.code !== 'EEXIST') throw error; await pause(100); }
  }
  let scheduled;
  try {
    let previous = 0;
    try { previous = Number(await readFile(join(directory, '.translation-rate'), 'utf8')) || 0; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    scheduled = Math.max(Date.now(), previous + 1500);
    await writeFile(join(directory, '.translation-rate'), String(scheduled));
  } finally { await handle.close(); await unlink(lock); }
  if (scheduled > Date.now()) await pause(scheduled - Date.now());
}
async function translateText(query) {
  for (let attempt = 0; ; attempt++) {
    try {
      await translationSlot();
      const response = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ko&dt=t', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ q: query }), signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) {
        const retryAfter = Number(response.headers.get('retry-after'));
        await response.body?.cancel();
        if (response.status === 429) await pause(Math.max(60000, Math.min(300000, Number.isFinite(retryAfter) ? retryAfter * 1000 : 60000)));
        throw new Error(`Translation HTTP ${response.status}`);
      }
      return await readTranslationResponse(response);
    } catch (error) { if (attempt >= 5) throw error; await pause(Math.min(30000, 1000 * 2 ** attempt)); }
  }
}
function validTranslation(value) {
  validateCatalogText(value, 'translation');
  if (!/[가-힣]/.test(value) || /<<<#\d+#>>>|\[object Object\]|\uFFFD/.test(value)) throw new Error('Translation is incomplete');
  return value.trim();
}
async function translateBatch(items) {
  if (process.env.MOD_TRANSLATION_URL) {
    const url = new URL(process.env.MOD_TRANSLATION_URL);
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1') throw new Error('Local translation must use loopback HTTP');
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texts: items.map(item => item.summary) }), signal: AbortSignal.timeout(300000) });
    if (!response.ok) throw new Error(`Local translation HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.translations) || data.translations.length !== items.length) throw new Error('Invalid local translation response');
    return data.translations.map(value => { try { return validTranslation(value); } catch { return null; } });
  }
  const token = i => `<<<#${i}#>>>`;
  if (items.length === 1) return [validTranslation(await translateText(items[0].summary))];
  const response = await translateText(items.map((item, i) => `${token(i)} ${item.summary}`).join('\n\n'));
  try {
    const markers = [...response.matchAll(/<<<#(\d+)#>>>/g)];
    if (markers.length !== items.length || markers.some((match, i) => Number(match[1]) !== i)) throw new Error('Invalid batch boundaries');
    return markers.map((match, i) => validTranslation(response.slice(match.index + match[0].length, markers[i + 1]?.index ?? response.length)));
  } catch {
    const result = [];
    for (const item of items) result.push(validTranslation(await translateText(item.summary)));
    return result;
  }
}
export async function translateCandidates({ gameId, kind, source, candidates, target = 1000, metadata = {} }) {
  const untranslated = await selectNewCandidates(gameId, candidates);
  const alreadyKorean = untranslated.filter(item => /[가-힣]/.test(item.summary));
  const selected = untranslated.filter(item => !/[가-힣]/.test(item.summary)).map(item => ({ ...item, summary: clean(item.summary) })).filter(item => item.summary);
  metadata = { ...metadata, alreadyKorean: alreadyKorean.length, ...(process.env.MOD_TRANSLATION_URL ? { localModels: [{ model: 'Helsinki-NLP/opus-mt-tc-big-en-ko', license: 'CC-BY-4.0', source: 'https://huggingface.co/Helsinki-NLP/opus-mt-tc-big-en-ko' }, { model: 'facebook/m2m100_418M', license: 'MIT', source: 'https://huggingface.co/facebook/m2m100_418M' }] } : {}) };
  const prefix = join(root, 'output/translation-expansion', `${gameId}.${kind}.${source}`);
  let checkpoint = {};
  try { checkpoint = JSON.parse(await readFile(`${prefix}.checkpoint.json`, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const hash = item => createHash('sha256').update(JSON.stringify([item.key, item.title, item.summary])).digest('hex');
  const rows = []; const items = []; const failed = [];
  for (let offset = 0; offset < selected.length && rows.length < target;) {
    const batch = []; let characters = 0;
    while (offset < selected.length && batch.length < Math.min(process.env.MOD_TRANSLATION_URL ? 32 : 40, target - rows.length)) {
      const item = selected[offset];
      if (batch.length && characters + item.summary.length + 20 > 4500) break;
      batch.push(item); characters += item.summary.length + 20; offset++;
    }
    const missing = batch.filter(item => !checkpoint[hash(item)]);
    if (missing.length) {
      try {
        const translated = await translateBatch(missing);
        missing.forEach((item, i) => {
          if (translated[i]) checkpoint[hash(item)] = translated[i];
          else failed.push({ key: item.key, reason: 'Model did not return a nonempty Korean translation' });
        });
      } catch (error) {
        for (const item of missing) {
          try {
            const value = (await translateBatch([item]))[0];
            if (!value) throw new Error('Model did not return a nonempty Korean translation');
            checkpoint[hash(item)] = value;
          }
          catch (singleError) { failed.push({ key: item.key, reason: singleError.message }); }
        }
      }
      await atomicJson(`${prefix}.checkpoint.json`, checkpoint);
    }
    for (const item of batch) {
      const korean = checkpoint[hash(item)];
      if (!korean) continue;
      validTranslation(korean); validateCatalogText(item.title, 'title', 512); validateCatalogText(item.summary, 'original', 1800);
      rows.push([item.title, item.summary, korean, item.key]);
      items.push({ key: item.key, kind, url: item.url ?? null });
    }
    if (missing.length || rows.length === target) console.log(`${gameId} ${source} ${kind}: ${rows.length}/${target}`);
    if (missing.length) await pause(200);
  }
  const result = { gameId, kind, source, fetchedAt: new Date().toISOString(), translation: process.env.MOD_TRANSLATION_URL ? 'Automatic translations (resumed Google Translate and local model checkpoints); not human reviewed' : 'Google Translate automatic translation; not human reviewed', target, count: rows.length, candidateCount: selected.length, complete: rows.length === target, metadata, failed, items, rows };
  await atomicJson(`${prefix}.json`, result);
  console.log(`${gameId} ${source} ${kind}: saved ${rows.length}; shortfall ${Math.max(0, target - rows.length)}`);
  return result;
}
