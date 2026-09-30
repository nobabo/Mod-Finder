import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAMES, GENRES } from '../../src/shared/games';
import { GAME_CATEGORIES } from '../../src/shared/categories';
import { BACKGROUNDS } from '../../src/shared/backgrounds';
import { THEMES } from '../../src/web/lib/themes';
import { LANGUAGES } from '../../src/shared/locale';
import { dictionaries } from '../../src/shared/translations';
import { withReviewedSummaries, type SummaryTranslation } from '../../src/shared/mod-summaries';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path: string) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
export function prepareAndroidAssets(output = resolve(root, 'output/android/assets')) {
  const save = (path: string, value: unknown) => {
    const destination = resolve(output, path); mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, JSON.stringify(value));
  };
  const logos = read('src/shared/data/logos.json') as Record<string, { src: string }>;
  const files = new Set(GAMES.flatMap(game => [game.image, logos[game.id]?.src, ...BACKGROUNDS[game.id].screenshots.map(shot => shot.src)]).filter((file): file is string => !!file));
  const assetRevisions: Record<string, string> = {};
  for (const file of files) {
    if (!/^\/(?:games|logos|backgrounds)\/[a-zA-Z0-9/_-]+\.(?:png|jpe?g|webp|avif|gif|svg)$/.test(file)) throw new Error(`Unexpected Android artwork path: ${file}`);
    const content = readFileSync(resolve(root, 'src/web/public', file.slice(1)));
    assetRevisions[file] = createHash('sha256').update(file.endsWith('.svg') ? content.toString('utf8').replace(/\r\n/g, '\n') : content).digest('hex');
    // Remove only known generated images from pre-0.2.1 builds. Keep the assets directory intact.
    const previousCopy = resolve(output, file.slice(1));
    if (existsSync(previousCopy)) unlinkSync(previousCopy);
  }
  save('catalog.json', { games: GAMES, genres: GENRES, categories: GAME_CATEGORIES, themes: THEMES, languages: LANGUAGES,
    backgrounds: BACKGROUNDS, logos, assetRevisions, dictionaries, verifiedLinks: read('src/shared/data/verified-projects.json'),
    rankings: read('src/shared/data/community-rankings.json'), packNames: read('src/shared/data/community-pack-names.ko.json'),
    mods: read('src/shared/locales/mods.ko.json'), search: read('src/shared/locales/search.ko.json'),
    gameSearch: read('src/shared/locales/search.games.ko.json'), corrections: read('src/shared/data/search-corrections.json'),
  });
  const reviewed = read('src/shared/locales/reviewed-mod-summaries.ko.json') as Record<string, SummaryTranslation[]>;
  for (const game of GAMES) {
    const rows = read(`src/shared/locales/mod-summaries/${game.id}.json`) as SummaryTranslation[];
    save(`summaries/${game.id}.json`, withReviewedSummaries(rows, reviewed[game.id] ?? []));
  }
  return { games: GAMES.length, remoteImages: files.size };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = prepareAndroidAssets();
  console.log(`[Android] Prepared ${result.games} games; ${result.remoteImages} images load from the Worker.`);
}
