import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applySteamTranslationGlossary } from '../lib/steam-translation-glossary.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const output = resolve(root, 'output/translation-expansion');
const endpoint = process.env.MOD_TRANSLATION_URL;
if (!endpoint || new URL(endpoint).hostname !== '127.0.0.1') throw new Error('A loopback translation endpoint is required');
const gameIds = ['rimworld', 'terraria', 'project-zomboid', 'cities-skylines', 'dont-starve-together'];
const samples = [];
for (const gameId of gameIds) {
  const prefix = resolve(output, `${gameId}.mod.steam`);
  const source = JSON.parse(await readFile(`${prefix}.candidates.json`, 'utf8'));
  if (source.metadata?.languagePolicy?.version !== 1 || source.candidates.length < 1000) throw new Error(`${gameId}: source policy or sample size mismatch`);
  const checkpoint = JSON.parse(await readFile(`${prefix}.checkpoint.json`, 'utf8').catch(error => {
    if (error.code !== 'ENOENT') throw error;
    return '{}';
  }));
  const chosen = Array.from({ length: 10 }, (_, index) => source.candidates[index * 100]);
  const hash = item => createHash('sha256').update(JSON.stringify([item.key, item.title, item.summary])).digest('hex');
  const missing = chosen.filter(item => !checkpoint[hash(item)]);
  if (missing.length) {
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: missing.map(item => item.summary) }), signal: AbortSignal.timeout(300000) });
    if (!response.ok) throw new Error(`${gameId}: sample translation HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.translations) || data.translations.length !== missing.length || data.translations.some(value => typeof value !== 'string')) throw new Error('Invalid sample response');
    missing.forEach((item, index) => { checkpoint[hash(item)] = data.translations[index]; });
  }
  for (const item of chosen) {
    const korean = checkpoint[hash(item)];
    samples.push({ gameId, key: item.key, title: item.title, original: item.summary, korean,
      correctedKorean: applySteamTranslationGlossary(gameId, item.summary, korean) });
  }
}
const report = { preparedAt: new Date().toISOString(), sampleCount: samples.length,
  selection: '10 samples per game at offsets 0,100,...900 among English-source candidates',
  status: 'Prepared for direct source comparison; this is not a full catalog review', samples };
await writeFile(resolve(output, 'steam-sample-audit.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(`Prepared ${samples.length} source/translation samples for direct comparison`);
