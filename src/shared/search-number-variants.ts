// Deliberate game-search vocabulary, not a stemmer: trimming a trailing 's'
// would corrupt names such as Iris, Nemesis, or the singular noun 'boss'.
const nounPairs = [
  ['zombie', 'zombies'], ['enemy', 'enemies'], ['boss', 'bosses'],
  ['monster', 'monsters'], ['creature', 'creatures'], ['animal', 'animals'],
  ['pet', 'pets'], ['companion', 'companions'], ['follower', 'followers'],
  ['colonist', 'colonists'], ['settler', 'settlers'], ['villager', 'villagers'],
  ['pawn', 'pawns'], ['survivor', 'survivors'], ['character', 'characters'],
  ['weapon', 'weapons'], ['gun', 'guns'], ['sword', 'swords'],
  ['spell', 'spells'], ['skill', 'skills'], ['perk', 'perks'],
  ['ability', 'abilities'], ['class', 'classes'], ['subclass', 'subclasses'],
  ['race', 'races'], ['trait', 'traits'], ['artifact', 'artifacts'],
  ['item', 'items'], ['relic', 'relics'], ['potion', 'potions'],
  ['quest', 'quests'], ['mission', 'missions'], ['dungeon', 'dungeons'],
  ['building', 'buildings'], ['structure', 'structures'], ['block', 'blocks'],
  ['ore', 'ores'], ['biome', 'biomes'], ['dimension', 'dimensions'],
  ['recipe', 'recipes'], ['crop', 'crops'], ['farm', 'farms'],
  ['tree', 'trees'], ['plant', 'plants'], ['flower', 'flowers'],
  ['vehicle', 'vehicles'], ['car', 'cars'], ['road', 'roads'],
  ['train', 'trains'], ['bus', 'buses'], ['ship', 'ships'],
  ['boat', 'boats'], ['portal', 'portals'], ['chest', 'chests'],
  ['container', 'containers'], ['backpack', 'backpacks'], ['slot', 'slots'],
  ['map', 'maps'], ['texture', 'textures'], ['shader', 'shaders'],
  ['animation', 'animations'], ['effect', 'effects'], ['sound', 'sounds'],
  ['skin', 'skins'], ['portrait', 'portraits'], ['outfit', 'outfits'],
  ['suit', 'suits'], ['emote', 'emotes'], ['moon', 'moons'],
  ['ghost', 'ghosts'], ['demon', 'demons'], ['trap', 'traps'],
  ['season', 'seasons'], ['event', 'events'], ['settlement', 'settlements'],
  ['city', 'cities'], ['library', 'libraries'], ['patch', 'patches'],
] as const;
const variants = new Map<string, string>();
for (const [singular, plural] of nounPairs) {
  variants.set(singular, plural);
  variants.set(plural, singular);
}

export function numberQueries(query: string): string[] {
  const key = query.trim().toLowerCase();
  const other = variants.get(key);
  // Preserve the original request and add at most one supplemental request.
  // Multiword mod titles, punctuation, abbreviations and unknown words stay literal.
  return other ? [query, other] : [query];
}
