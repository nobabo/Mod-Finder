import { validateCatalogText } from './catalog-text.mjs';
import { applyMinecraftTranslationGlossary } from './minecraft-translation-glossary.mjs';
import { applyNexusTranslationGlossary } from './nexus-translation-glossary.mjs';
import { applySteamTranslationGlossary } from './steam-translation-glossary.mjs';
import { applyThunderstoreTranslationGlossary } from './thunderstore-translation-glossary.mjs';

export function correctionIndex(records) {
  const index = new Map();
  for (const record of records) {
    if (!/^(modrinth|curseforge|thunderstore|nexus|steam):[^:]+:.+$/.test(record.key)) throw new Error('Invalid correction identity');
    validateCatalogText(record.original, 'correction original', 1800);
    validateCatalogText(record.korean, 'correction translation');
    if (!record.original.trim() || !/[가-힣]/.test(record.korean)) throw new Error('Empty correction');
    const identity = JSON.stringify([record.key, record.original]);
    if (index.has(identity) && index.get(identity) !== record.korean) throw new Error(`Conflicting source-bound corrections: ${record.key}`);
    index.set(identity, record.korean);
  }
  return index;
}

export function prepareTranslationRows(gameId, rows, corrections) {
  const glossaryKeys = [], reviewedKeys = [];
  const prepared = rows.map(row => {
    let korean = row[2];
    for (const apply of [applyMinecraftTranslationGlossary, applyNexusTranslationGlossary, applySteamTranslationGlossary, applyThunderstoreTranslationGlossary]) {
      korean = apply(gameId, row[1], korean);
    }
    if (korean !== row[2]) glossaryKeys.push(row[3]);
    const reviewed = corrections.get(JSON.stringify([row[3], row[1]]));
    if (reviewed !== undefined) { korean = reviewed; reviewedKeys.push(row[3]); }
    return [row[0], row[1], korean, row[3]];
  });
  return { rows: prepared, glossaryKeys, reviewedKeys };
}
