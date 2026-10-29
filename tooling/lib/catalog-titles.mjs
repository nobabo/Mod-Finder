import { validateCatalogText } from './catalog-text.mjs';
import { repairTitleTerms } from './title-glossary.mjs';

export function titleCorrections(documents) {
  const result = new Map();
  for (const document of documents) {
    if (!document || Array.isArray(document) || typeof document !== 'object') throw new Error('Invalid title corrections');
    const scoped = typeof document.gameId === 'string' && document.titles;
    for (const [original, korean] of Object.entries(scoped ? document.titles : document)) {
      validateCatalogText(original, 'original title', 512); validateCatalogText(korean, 'Korean title', 1024);
      if (!original.trim() || !korean.trim()) throw new Error('Empty title correction');
      const key = scoped ? JSON.stringify([document.gameId, original]) : original;
      if (result.has(key) && result.get(key) !== korean) throw new Error(`Conflicting title correction: ${original}`);
      result.set(key, korean);
    }
  }
  return result;
}

export function prepareCatalogTitles(rows, candidates, corrections, reviewed, gameId) {
  const scopes = new Set(rows.filter(row => row[3]).map(row => row[3].split(':').slice(0, 2).join(':') + ':'));
  const manualNames = new Map();
  const addManual = (original, korean) => {
    const values = manualNames.get(original) ?? new Set(); values.add(korean); manualNames.set(original, values);
  };
  for (const [key, entry] of Object.entries(reviewed)) {
    if (!entry.title || ![...scopes].some(scope => key.startsWith(scope))) continue;
    if (entry.searchTerm) addManual(entry.searchTerm, entry.title);
  }
  for (const row of rows) if (row[3] && reviewed[row[3]]?.title) addManual(row[0], reviewed[row[3]].title);
  return rows.map(row => {
    if (!Array.isArray(row) || row.length < 4 || row.length > 5) throw new Error('Invalid summary row');
    const original = row[0];
    const legacyNames = !row[3] && manualNames.get(original);
    const manual = row[3] ? reviewed[row[3]]?.title : legacyNames?.size === 1 ? [...legacyNames][0] : undefined;
    const translated = manual || corrections.get(JSON.stringify([gameId, original])) || corrections.get(original) || (candidates[original]?.title && repairTitleTerms(original, candidates[original].title, gameId));
    if (typeof translated !== 'string' || !translated.trim()) throw new Error(`Missing title translation: ${original}`);
    validateCatalogText(translated, 'Korean title', 1024);
    if (/<<<#\d+#>>>|\[object Object\]|\uFFFD/.test(translated)) throw new Error(`Invalid title translation: ${original}`);
    return [...row.slice(0, 4), translated.trim()];
  });
}

export function titleSearchCatalog(rows) {
  const result = new Map();
  for (const row of rows) {
    if (!row[3]) continue;
    const identity = JSON.stringify([row[3], row[0]]);
    if (result.has(identity) && result.get(identity)[2] !== row[4]) throw new Error('Conflicting source title');
    result.set(identity, [row[3], row[0], row[4]]);
  }
  return [...result.values()];
}
