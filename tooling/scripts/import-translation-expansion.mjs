import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { root, games, atomicJson } from '../lib/translation-expansion.mjs';
import { mergeTranslationExpansion, validateArtifactFile } from '../lib/merge-translation-expansion.mjs';
import { correctionIndex, prepareTranslationRows } from '../lib/prepare-translation-expansion.mjs';

const directory = join(root, 'output/translation-expansion');
const filenames = (await readdir(directory)).filter(name => /^[a-z0-9-]+\.(mod|modpack)\.(modrinth|curseforge|thunderstore|nexus|steam)\.json$/.test(name)).sort();
const artifacts = await Promise.all(filenames.map(async filename => validateArtifactFile(filename, JSON.parse(await readFile(join(directory, filename), 'utf8')), new Set(games.map(game => game.id)))));
const correctionDirectory = join(root, 'tooling/data');
const manifestPath = join(correctionDirectory, 'translation-expansion.manifest.json');
const correctionFiles = (await readdir(correctionDirectory)).filter(name => /corrections\.ko\.json$/.test(name)).sort();
const corrections = correctionIndex((await Promise.all(correctionFiles.map(async name => JSON.parse(await readFile(join(correctionDirectory, name), 'utf8'))))).flat());
for (const artifact of artifacts) {
  const prepared = prepareTranslationRows(artifact.gameId, artifact.rows, corrections);
  artifact.rows = prepared.rows;
  artifact.metadata = { ...artifact.metadata, preparation: { glossaryVersion: 1, glossaryRepairs: prepared.glossaryKeys.length, sourceBoundCodexCorrections: prepared.reviewedKeys.length } };
}
const batchId = createHash('sha256').update(JSON.stringify(artifacts.map(artifact => [artifact.gameId, artifact.kind, artifact.source, artifact.rows.map(row => [row[3], row[1]])]))).digest('hex');
let previousReport;
try { previousReport = JSON.parse(await readFile(manifestPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (previousReport && (typeof previousReport.batchId !== 'string' || !Array.isArray(previousReport.games))) throw new Error('Invalid previous expansion manifest');
const required = games.flatMap(game => [
  ...(game.id === 'minecraft-java' ? ['modrinth', 'curseforge'].flatMap(source => ['mod', 'modpack'].map(kind => `${game.id}.${kind}.${source}`)) : []),
  ...(game.sources.steam ? [`${game.id}.mod.steam`] : []),
  ...(game.sources.thunderstore ? ['mod', 'modpack'].map(kind => `${game.id}.${kind}.thunderstore`) : []),
  ...(game.sources.nexus && !game.sources.steam && !game.sources.thunderstore ? [`${game.id}.mod.nexus`] : []),
  ...(game.sources.nexus ? [`${game.id}.modpack.nexus`] : []),
]);
for (const bucket of required) if (!filenames.includes(`${bucket}.json`)) throw new Error(`Missing required bucket: ${bucket}`);
for (const filename of filenames) if (!required.includes(filename.slice(0, -5))) throw new Error(`Unexpected expansion bucket: ${filename}`);
const planned = [];
for (const game of games) {
  const path = join(root, `src/shared/locales/mod-summaries/${game.id}.json`);
  const baseline = JSON.parse(await readFile(path, 'utf8'));
  const selected = artifacts.filter(artifact => artifact.gameId === game.id);
  for (const artifact of selected) {
    const scope = game.sources[artifact.source]?.scope;
    if (!scope || artifact.rows.some(row => !row[3]?.startsWith(`${artifact.source}:${scope}:`))) throw new Error(`${game.id}: incorrect provider scope`);
  }
  planned.push({ path, gameId: game.id, baseline: baseline.length, baselineSha256: createHash('sha256').update(JSON.stringify(baseline)).digest('hex'), ...mergeTranslationExpansion(baseline, selected, game.id) });
}
const report = {
  batchId,
  generatedAt: previousReport?.batchId === batchId ? previousReport.generatedAt : new Date().toISOString(),
  translation: 'Automatic Google Translate and local OPUS-MT/M2M100 translations with explicitly recorded Codex translations for small collections; not human reviewed',
  selection: 'Provider download/subscription order; skip existing source IDs and conservatively skip legacy titles whose original export has no IDs. Counts represent source-specific listings, not inferred cross-provider projects.',
  buckets: artifacts.map(({ gameId, kind, source, target, count, complete, metadata, failed, translation, rows }) => ({ gameId, kind, source, target, count, complete, metadata, failed, translation, listingKeys: rows.map(row => row[3]) })),
  games: planned.map(({ gameId, baseline, baselineSha256, added, rows }) => {
    const previous = previousReport?.batchId === batchId ? previousReport.games.find(game => game.gameId === gameId) : null;
    return { gameId, baseline: previous?.baseline ?? baseline, baselineSha256: previous?.baselineSha256 ?? baselineSha256, added: previous?.added ?? added, total: rows.length };
  }),
  review: { method: 'Codex source comparison of samples, detected non-English originals and narrow source-aware glossary repairs; not full human review', correctionFiles },
  total: planned.reduce((sum, item) => sum + item.rows.length, 0),
};
if (report.games.reduce((sum, game) => sum + game.added, 0) !== report.buckets.reduce((sum, bucket) => sum + bucket.count, 0)) throw new Error('Existing listings cannot be counted as newly added translations');
// Build and validate every input, previous catalog and report before writes.
for (const item of planned) await atomicJson(item.path, item.rows, 0);
await atomicJson(manifestPath, report);
console.log(JSON.stringify({ games: report.games, total: report.total }, null, 2));
