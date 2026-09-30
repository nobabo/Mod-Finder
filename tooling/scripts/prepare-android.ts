import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
const output = resolve(root, 'output/android/assets');
const read = (path: string) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const save = (path: string, value: unknown) => {
  const destination = resolve(output, path); mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, JSON.stringify(value));
};
const logos = read('src/shared/data/logos.json') as Record<string, { src: string }>;
save('catalog.json', { games: GAMES, genres: GENRES, categories: GAME_CATEGORIES, themes: THEMES, languages: LANGUAGES,
  backgrounds: BACKGROUNDS, logos, dictionaries, verifiedLinks: read('src/shared/data/verified-projects.json'),
  rankings: read('src/shared/data/community-rankings.json'), packNames: read('src/shared/data/community-pack-names.ko.json'),
  mods: read('src/shared/locales/mods.ko.json'), search: read('src/shared/locales/search.ko.json'),
  gameSearch: read('src/shared/locales/search.games.ko.json'), corrections: read('src/shared/data/search-corrections.json'),
});
const files = new Set(GAMES.flatMap(game => [game.image, logos[game.id]?.src, ...BACKGROUNDS[game.id].screenshots.map(shot => shot.src)]).filter((file): file is string => !!file));
for (const file of files) {
  const destination = resolve(output, file.slice(1)); mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(resolve(root, 'src/web/public', file.slice(1)), destination);
}
const reviewed = read('src/shared/locales/reviewed-mod-summaries.ko.json') as Record<string, SummaryTranslation[]>;
for (const game of GAMES) {
  const rows = read(`src/shared/locales/mod-summaries/${game.id}.json`) as SummaryTranslation[];
  save(`summaries/${game.id}.json`, withReviewedSummaries(rows, reviewed[game.id] ?? []));
}
console.log(`[Android] Prepared ${GAMES.length} games and ${files.size} local image assets.`);
