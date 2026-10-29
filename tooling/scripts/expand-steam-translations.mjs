import { readFile, mkdir, writeFile, rename, copyFile } from 'node:fs/promises';
import { resolve, dirname, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { validateCatalogText } from '../lib/catalog-text.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: resolve(root, '.env'), quiet: true });
const gameIds = ['rimworld', 'terraria', 'project-zomboid', 'cities-skylines', 'dont-starve-together'];
const requestedGame = process.argv.find(value => value.startsWith('--game='))?.slice(7);
const target = Number(process.argv.find(value => value.startsWith('--target='))?.slice(9) ?? 1000);
if (!Number.isSafeInteger(target) || target < 1 || target > 1000) throw new Error('Invalid target');
if (requestedGame && !gameIds.includes(requestedGame)) throw new Error('Unknown Steam game');
if (!process.env.STEAM_API_KEY) throw new Error('STEAM_API_KEY is required');

const { games, fetchJson, pause, selectNewCandidates, translateCandidates } = await import('../lib/translation-expansion.mjs');
const output = resolve(root, 'output/translation-expansion');
await mkdir(output, { recursive: true });
const clean = value => String(value ?? '').slice(0, 1800).replace(/<[^>]*>/g, '').replace(/\[\/?[a-z][^\]]*\]/gi, '').trim();
const languagePolicy = { version: 1, sourceLanguage: 'en',
  method: 'langid 1.1.6 predicts English, at least two known English words, no non-Latin letters outside URLs',
  purpose: 'Conservative source selection after observed multilingual translation failures; original catalog remains unchanged' };
const selectedGames = games.filter(game => gameIds.includes(game.id) && (!requestedGame || game.id === requestedGame));

function classifyEnglish(items) {
  if (!items.length) return [];
  const result = spawnSync(process.env.MOD_TRANSLATION_PYTHON || 'python', [resolve(root, 'tooling/lib/steam-source-language.py')], {
    input: JSON.stringify(items.map(item => item.summary)), encoding: 'utf8', shell: false, windowsHide: true,
    maxBuffer: 16 * 1024 * 1024, timeout: 120000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Steam source language classification failed');
  const classifications = JSON.parse(result.stdout);
  if (!Array.isArray(classifications) || classifications.length !== items.length || classifications.some(item => typeof item.english !== 'boolean' || typeof item.language !== 'string')) {
    throw new Error('Invalid source language classification');
  }
  return classifications;
}

// Keep earlier generated artifacts recoverable while preventing an obsolete,
// complete multilingual artifact from being mistaken for the new selection.
const backup = resolve(output, 'before-steam-english', new Date().toISOString().replace(/[:.]/g, '-'));
for (const game of selectedGames) {
  let previous;
  try { previous = JSON.parse(await readFile(resolve(output, `${game.id}.mod.steam.candidates.json`), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!previous || previous.metadata?.languagePolicy?.version === languagePolicy.version) continue;
  await mkdir(backup, { recursive: true });
  for (const suffix of ['candidates.json', 'checkpoint.json']) {
    const path = resolve(output, `${game.id}.mod.steam.${suffix}`);
    try { await copyFile(path, resolve(backup, basename(path))); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const artifact = resolve(output, `${game.id}.mod.steam.json`);
  try { await rename(artifact, resolve(backup, basename(artifact))); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}

async function collect(game) {
  const scope = game.sources.steam.scope;
  const items = new Map();
  const seenCursors = new Set();
  const languages = new Map();
  let cursor = '*';
  let scanned = 0;
  let total = null;
  let candidates = [];
  while (scanned < 10000) {
    if (seenCursors.has(cursor)) throw new Error(`${game.id}: repeated Steam cursor`);
    seenCursors.add(cursor);
    const input = { appid: Number(scope), search_text: '', cursor, numperpage: 100, query_type: 9,
      return_tags: true, return_short_description: true, return_vote_data: true, filetype: 0 };
    const url = `https://api.steampowered.com/IPublishedFileService/QueryFiles/v1/?input_json=${encodeURIComponent(JSON.stringify(input))}`;
    const data = await fetchJson(url, { headers: { 'x-webapi-key': process.env.STEAM_API_KEY } });
    const result = data.response;
    if ((result?.result !== undefined && result.result !== 1) || !Array.isArray(result?.publishedfiledetails)) {
      throw new Error(`${game.id}: invalid Steam response`);
    }
    if (!Number.isSafeInteger(result.total) || result.total < 0) throw new Error(`${game.id}: invalid Steam total`);
    total = result.total;
    scanned += result.publishedfiledetails.length;
    for (const raw of result.publishedfiledetails) {
      if (raw.result !== undefined && raw.result !== 1) continue;
      if (raw.consumer_app_id !== undefined && String(raw.consumer_app_id) !== scope) throw new Error(`${game.id}: Steam game mismatch`);
      if (raw.file_type !== undefined && raw.file_type !== 0) continue;
      if (typeof raw.publishedfileid !== 'string' || !/^[1-9]\d*$/.test(raw.publishedfileid)) throw new Error(`${game.id}: invalid Steam ID`);
      if (typeof raw.title !== 'string' || !raw.title.trim() || !Number.isFinite(raw.subscriptions) || raw.subscriptions < 0) continue;
      const summary = clean(raw.short_description ?? raw.description);
      if (!summary) continue;
      try {
        validateCatalogText(raw.title.trim(), 'Steam title', 512);
        validateCatalogText(summary, 'Steam summary', 1800);
      } catch { continue; }
      const key = `steam:${scope}:${raw.publishedfileid}`;
      if (!items.has(key)) items.set(key, { key, title: raw.title.trim(), summary, metric: raw.subscriptions,
        url: `https://steamcommunity.com/sharedfiles/filedetails/?id=${raw.publishedfileid}` });
    }
    const newItems = await selectNewCandidates(game.id, [...items.values()]);
    const exhausted = !result.next_cursor || !result.publishedfiledetails.length || scanned >= total || scanned >= 10000;
    const pending = newItems.filter(item => !languages.has(item.key));
    if ((newItems.length >= target + 150 && pending.length >= 300) || exhausted) {
      const classifications = classifyEnglish(pending);
      pending.forEach((item, index) => languages.set(item.key, classifications[index]));
    }
    candidates = newItems.filter(item => languages.get(item.key)?.english);
    console.log(`${game.id}: scanned ${scanned}, new ${newItems.length}, English ${candidates.length}, total ${total}`);
    if (candidates.length >= target + 150 || exhausted) break;
    cursor = result.next_cursor;
    await pause(250);
  }
  return { candidates, metadata: { fetchedAt: new Date().toISOString(), scanned, total, languagePolicy,
    classifiedCandidates: languages.size, excludedNonEnglish: [...languages.values()].filter(item => !item.english).length,
    selection: 'Steam QueryFiles RankedByTotalUniqueSubscriptions; filetype=0; collections excluded; existing translations conservatively excluded',
    classification: { requestFiletype: 0, responseFileType: 0, modpacks: 'No separate modpack file type; Workshop collections are excluded' },
    documentation: 'https://partner.steamgames.com/doc/webapi/IPublishedFileService#EPublishedFileInfoMatchingFileType' } };
}

let failed = false;
for (const game of selectedGames) {
  try {
    const sourcePath = resolve(output, `${game.id}.mod.steam.candidates.json`);
    let collected;
    if (process.argv.includes('--resume')) {
      try { collected = JSON.parse(await readFile(sourcePath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    if (collected?.metadata?.languagePolicy?.version !== languagePolicy.version) collected = undefined;
    if (!collected) {
      collected = await collect(game);
      await writeFile(`${sourcePath}.tmp`, JSON.stringify(collected) + '\n', 'utf8');
      await rename(`${sourcePath}.tmp`, sourcePath);
    }
    const validCandidates = collected.candidates.filter(item => {
      try { validateCatalogText(item.title, 'Steam title', 512); validateCatalogText(item.summary, 'Steam summary', 1800); return true; }
      catch { return false; }
    });
    if (validCandidates.length !== collected.candidates.length) {
      collected.metadata.invalidCatalogTextExcluded = collected.candidates.length - validCandidates.length;
      collected.candidates = validCandidates;
      await writeFile(`${sourcePath}.tmp`, JSON.stringify(collected) + '\n', 'utf8');
      await rename(`${sourcePath}.tmp`, sourcePath);
    }
    if (collected.candidates.length < target) throw new Error(`${game.id}: insufficient new candidates (${collected.candidates.length}/${target})`);
    if (process.argv.includes('--collect-only')) continue;
    const translated = await translateCandidates({ gameId: game.id, kind: 'mod', source: 'steam', candidates: collected.candidates, target,
      metadata: collected.metadata });
    if (!translated.complete) throw new Error(`${game.id}: incomplete translation (${translated.count}/${target})`);
  } catch (error) {
    failed = true;
    console.error(`${game.id}: ${error.message}`);
  }
}
if (failed) process.exitCode = 1;
