import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sourceDir = join(root, 'output/mod-translation-source');
const games = JSON.parse(await readFile(join(root, 'src/shared/data/games.json'), 'utf8'));
const report = { checkedAt: new Date().toISOString(), games: {}, totals: {} };
const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const numbers = value => [...value.normalize('NFKC').matchAll(/(?<![\p{L}\p{N}])\d+(?:[.,]\d+)*(?:%|x)?/gu)]
  .map(match => match[0].replaceAll(',', ''));

for (const game of games) {
  const id = game.id;
  const original = JSON.parse(await readFile(join(sourceDir, `${id}.json`), 'utf8'));
  const korean = JSON.parse(await readFile(join(sourceDir, `${id}.ko.json`), 'utf8'));
  const mirror = JSON.parse(await readFile(join(sourceDir, 'ko', `${id}.json`), 'utf8'));
  const sourceKeys = Object.keys(original);
  const translatedKeys = Object.keys(korean);
  const sourcePositions = new Map(sourceKeys.map((key, index) => [key, index]));
  const missingKeys = sourceKeys.filter(key => !has(korean, key));
  const extraKeys = translatedKeys.filter(key => !has(original, key));
  const sourceEmpty = sourceKeys.filter(key => typeof original[key] === 'string' && !original[key].trim());
  const invalidValues = translatedKeys.filter(key => typeof korean[key] !== 'string');
  const blankTranslations = sourceKeys.filter(key => has(korean, key) && original[key]?.trim() && !korean[key]?.trim());
  const unsupportedTranslations = sourceEmpty.filter(key => has(korean, key) && korean[key]?.trim());
  const unchanged = sourceKeys.filter(key => has(korean, key) && original[key]?.trim() && original[key] === korean[key]);
  const noHangul = sourceKeys.filter(key => has(korean, key) && original[key]?.trim() && korean[key]?.trim() && !/[가-힣]/u.test(korean[key]));
  const leakedMarkers = sourceKeys.filter(key => has(korean, key) && /<<<#\d+#>>>|\[object Object\]|\uFFFD/u.test(korean[key]));
  const shortSourceExpansions = sourceKeys.filter(key => has(korean, key) && original[key]?.trim().length >= 15
    && original[key].trim().length < 100 && korean[key]?.length > original[key].length * 2.2)
    .map(title => ({ title, original: original[title], translation: korean[title] }));
  const placeholderExpansions = sourceKeys.filter(key => has(korean, key)
    && /^(placeholder description\.?|example description\.?|read the description\.?|no description\.?|coming soon\.?|tbd\.?)$/iu.test(original[key]?.trim())
    && korean[key]?.trim() && korean[key].trim() !== original[key].trim())
    .map(title => ({ title, original: original[title], translation: korean[title] }));
  const omittedMaintenance = sourceKeys.filter(key => has(korean, key)
    && /\b(not maintained|no longer maintained|obsolete|deprecated)\b/iu.test(original[key])
    && !/(유지보수.{0,8}중단|지원.{0,8}중단|구식|구버전|폐기|더 이상.{0,12}(필수|지원|사용))/u.test(korean[key]))
    .map(title => ({ title, original: original[title], translation: korean[title] }));
  const addedNumbers = sourceKeys.flatMap(key => {
    if (!has(korean, key) || !original[key]?.trim() || !korean[key]?.trim()) return [];
    const allowed = new Set(numbers(`${key} ${original[key]}`));
    const added = [...new Set(numbers(korean[key]).filter(number => !allowed.has(number)))];
    return added.length ? [{ title: key, added, original: original[key], translation: korean[key] }] : [];
  });
  const translatedPositions = translatedKeys.filter(key => sourcePositions.has(key)).map(key => sourcePositions.get(key));
  const orderPreserved = translatedPositions.every((position, index) => !index || position > translatedPositions[index - 1]);
  const mirrorMatches = translatedKeys.length === Object.keys(mirror).length && translatedKeys.every(key => has(mirror, key) && mirror[key] === korean[key]);
  report.games[id] = {
    sourceCount: sourceKeys.length,
    translatedCount: translatedKeys.length,
    missingCount: missingKeys.length,
    missingNonemptyCount: missingKeys.filter(key => original[key]?.trim()).length,
    missingSample: missingKeys.slice(0, 10),
    extraKeys,
    invalidValues,
    sourceEmptyCount: sourceEmpty.length,
    blankTranslations,
    unsupportedTranslations,
    unchanged,
    noHangul,
    leakedMarkers,
    shortSourceExpansions,
    placeholderExpansions,
    omittedMaintenance,
    addedNumbers,
    orderPreserved,
    mirrorMatches
  };
}

const tagCandidates = JSON.parse(await readFile(join(sourceDir, 'tag-candidates.json'), 'utf8'));
const tagTranslations = JSON.parse(await readFile(join(root, 'src/shared/locales/tags.ko.json'), 'utf8'));
report.tags = {
  candidateCount: Object.keys(tagCandidates).length,
  translatedCount: Object.keys(tagTranslations).length,
  unknownKeys: Object.keys(tagTranslations).filter(key => !has(tagCandidates, key)),
  invalidValues: Object.keys(tagTranslations).filter(key => typeof tagTranslations[key] !== 'string' || !tagTranslations[key].trim())
};
const results = Object.values(report.games);
report.totals = {
  sourceCount: results.reduce((sum, game) => sum + game.sourceCount, 0),
  translatedCount: results.reduce((sum, game) => sum + game.translatedCount, 0),
  missingCount: results.reduce((sum, game) => sum + game.missingCount, 0),
  missingNonemptyCount: results.reduce((sum, game) => sum + game.missingNonemptyCount, 0),
  extraCount: results.reduce((sum, game) => sum + game.extraKeys.length, 0),
  blankCount: results.reduce((sum, game) => sum + game.blankTranslations.length, 0),
  unsupportedCount: results.reduce((sum, game) => sum + game.unsupportedTranslations.length, 0),
  unchangedCount: results.reduce((sum, game) => sum + game.unchanged.length, 0),
  noHangulCount: results.reduce((sum, game) => sum + game.noHangul.length, 0),
  markerCount: results.reduce((sum, game) => sum + game.leakedMarkers.length, 0),
  shortSourceExpansionCount: results.reduce((sum, game) => sum + game.shortSourceExpansions.length, 0),
  placeholderExpansionCount: results.reduce((sum, game) => sum + game.placeholderExpansions.length, 0),
  omittedMaintenanceCount: results.reduce((sum, game) => sum + game.omittedMaintenance.length, 0),
  addedNumberCount: results.reduce((sum, game) => sum + game.addedNumbers.length, 0),
  orderProblems: results.filter(game => !game.orderPreserved).length,
  mirrorProblems: results.filter(game => !game.mirrorMatches).length
};
const reportPath = join(sourceDir, 'translation-audit.json');
await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ checkedAt: report.checkedAt, totals: report.totals, tags: report.tags, reportPath }, null, 2));
