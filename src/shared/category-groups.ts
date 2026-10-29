export interface CategoryLabel { id: string; ko: string; en: string }
export interface CategoryGroup<T extends CategoryLabel = CategoryLabel> { id: string; ko: string; en: string; categories: T[] }

// Navigation groups only. Provider IDs and individual selections stay intact.
const groups = [
  { id: 'content', ko: '컨텐츠', en: 'Content', labels: ['adventure', 'adventure worlds', 'technology', 'magic', 'equipment', 'gear', 'weapons', 'armour', 'armor', 'weapons and armour', 'power armour', 'ammo', 'items', 'item', 'food', 'alchemy', 'quests and adventures', 'expansions', 'skills', 'skills and leveling', 'shouts', 'stealth', 'classes', 'races, classes, and birthsigns', 'traits', 'perks', 'artifacts', 'accessories', 'crafting', 'fishing', 'crops', 'farming', 'scenario', 'overhaul', 'gamemodes', 'mod', 'collections', 'modpacks'] },
  { id: 'system', ko: '시스템·최적화', en: 'System & Optimization', labels: ['bug fixes', 'bugfixes', 'library', 'framework', 'scripts', 'game mechanics', 'gameplay mechanics', 'gameplay', 'optimization', 'performance', 'tweaks', 'tweak', 'balance', 'multiplayer', 'cheats'] },
  { id: 'world', ko: '월드·건축', en: 'World & Building', labels: ['world generation', 'worldgen', 'decoration', 'buildings', 'building', 'furniture', 'maps', 'map', 'moons', 'interiors', 'environment', 'locations', 'weather', 'weather and lighting', 'hazards', 'vehicles', 'vehicle', 'transportation', 'transport', 'player settlement', 'sim settlements 2', 'crafting - home/settlement', 'props and decorations', 'district style', 'map theme', 'prop', 'tree', 'intersection', 'park', 'residential', 'commercial', 'industrial', 'office', 'savegame', 'golf worlds', 'all items worlds', 'starter worlds', 'journey worlds', 'challenge worlds'] },
  { id: 'characters', ko: '캐릭터·생물', en: 'Characters & Creatures', labels: ['characters', 'character', 'new characters', 'player characters', 'npcs', 'npc', 'companions', 'mobs', 'monsters', 'enemies', 'creature', 'creatures', 'animals', 'pets / horses', 'livestock and animals', 'pet', 'factions', 'dialogue', 'events'] },
  { id: 'appearance', ko: '외형·사운드', en: 'Appearance & Sound', labels: ['appearance', 'body, face, and hair', 'character customisation', 'clothing', 'clothing/armor', 'armour and clothing', 'cosmetics', 'skins', 'suits', 'emotes', 'portraits', 'animation', 'animations', 'visuals and graphics', 'high resolution', 'art', 'audio', 'music', 'boombox music', 'radio', 'from terraria mods', 'dice'] },
  { id: 'utility', ko: '편의 기능', en: 'Utilities', labels: ['utility', 'utilities', 'qol', 'tweaks & quality of life', 'storage', 'user interface', 'interface', 'language', 'translation', 'language/translations', 'language/translation', 'pip-boy'] },
];

export function groupCategories<T extends CategoryLabel>(categories: T[]): CategoryGroup<T>[] {
  const buckets = new Map<string, T[]>();
  for (const category of categories) {
    const id = groups.find(group => group.labels.includes(category.en.toLowerCase()))?.id ?? 'other';
    const bucket = buckets.get(id) ?? [];
    bucket.push(category);
    buckets.set(id, bucket);
  }
  return [...groups, { id: 'other', ko: '기타', en: 'Other' }].flatMap(group => {
    const entries = buckets.get(group.id);
    return entries?.length ? [{ id: group.id, ko: group.ko, en: group.en, categories: entries }] : [];
  });
}
