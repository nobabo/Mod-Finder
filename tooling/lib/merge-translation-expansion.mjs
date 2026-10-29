import { validateCatalogText } from './catalog-text.mjs';

export const rowIdentity = row => JSON.stringify([row[0], row[1], row[3]]);
export function validateArtifactFile(filename, artifact, gameIds) {
  if (!gameIds.has(artifact.gameId) || filename !== `${artifact.gameId}.${artifact.kind}.${artifact.source}.json`) throw new Error('Artifact filename or game does not match its content');
  if (artifact.target !== 1000) throw new Error('Expansion buckets must target 1000 listings');
  return artifact;
}
export function mergeTranslationExpansion(baseline, artifacts, gameId) {
  const result = [...baseline];
  const existing = new Map(baseline.map(row => [rowIdentity(row), row]));
  const sourceIds = new Map();
  for (const row of baseline) if (row[3]) {
    const previous = sourceIds.get(row[3]) ?? [];
    previous.push(row); sourceIds.set(row[3], previous);
  }
  const sourceKinds = new Map();
  let added = 0;
  for (const artifact of artifacts) {
    if (artifact.gameId !== gameId || !['mod', 'modpack'].includes(artifact.kind) || artifact.count !== artifact.rows?.length || artifact.items?.length !== artifact.count || !Number.isInteger(artifact.target) || artifact.target < 1 || !Number.isInteger(artifact.count) || artifact.count < 0 || artifact.count > artifact.target || typeof artifact.complete !== 'boolean' || artifact.complete !== (artifact.count === artifact.target)) throw new Error('Invalid expansion artifact');
    if (!artifact.complete && artifact.metadata?.exhausted !== true) throw new Error(`${gameId}: incomplete selection has not exhausted the provider`);
    const ids = new Set();
    for (const [index, row] of artifact.rows.entries()) {
      if (!Array.isArray(row) || row.length !== 4 || typeof row[3] !== 'string' || !row[3].startsWith(`${artifact.source}:`) || ids.has(row[3]) || artifact.items[index].key !== row[3] || artifact.items[index].kind !== artifact.kind) throw new Error('Invalid or duplicate source identity');
      ids.add(row[3]);
      validateCatalogText(row[0], 'title', 512); validateCatalogText(row[1], 'original', 1800); validateCatalogText(row[2], 'translation');
      if (!row[0].trim() || !row[1].trim() || !/[가-힣]/.test(row[2]) || /<<<#\d+#>>>|\[object Object\]|\uFFFD/.test(row[2])) throw new Error('Incomplete translation');
      if (sourceKinds.has(row[3]) && sourceKinds.get(row[3]) !== artifact.kind) throw new Error('A source identity appears in both mods and modpacks');
      sourceKinds.set(row[3], artifact.kind);
      const identity = rowIdentity(row), previous = existing.get(identity);
      const sameId = sourceIds.get(row[3]);
      if (sameId && !sameId.some(value => JSON.stringify(value) === JSON.stringify(row))) throw new Error('Expansion would overwrite an existing source identity');
      if (previous) {
        if (previous[2] !== row[2]) throw new Error('Expansion would overwrite an existing translation');
      } else { result.push(row); existing.set(identity, row); sourceIds.set(row[3], [row]); added++; }
    }
  }
  return { rows: result, added };
}
