import pluralize from 'pluralize';

// Pluralize knows inflection rules, not whether a word is a mod's proper name.
// Only reviewed game-search nouns are eligible; titles and unknown words stay literal.
const nouns = new Set(`
  zombie enemy boss monster creature animal pet companion follower colonist settler
  villager pawn survivor character weapon gun sword spell skill perk ability class
  subclass race trait artifact item relic potion quest mission dungeon building
  structure block ore biome dimension recipe crop farm tree plant flower vehicle car
  road train bus ship boat portal chest container backpack slot map texture shader
  animation effect sound skin portrait outfit suit emote moon ghost demon trap season
  event settlement city library patch knife wolf leaf child person
  arrow axe shield helmet boot glove ring amulet gem crystal tool torch lantern
  battery factory machine engine robot turret wall fence door window bridge tower
  dragon fox horse dog cat bird fish sheep deer mouse goose tooth foot shelf berry
  accessory resource modpack
`.trim().split(/\s+/));

export function numberQueries(query: string): string[] {
  const key = query.trim().toLowerCase();
  if (!/^[a-z]+$/.test(key)) return [query];
  const singular = pluralize.singular(key);
  if (!nouns.has(singular)) return [query];
  const other = singular === key ? pluralize.plural(key) : singular;
  // Preserve the original request, with at most one supplemental request.
  return other !== key ? [query, other] : [query];
}
