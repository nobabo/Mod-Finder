import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

// English mod search terms selected for the eight genres in shared/data/genres.json.
// Each term gets repeated letters and adjacent-letter swaps. The output
// is checked for ambiguous keys and kept as an editable, explicit JSON dictionary.
const terms = {
  sandbox: 'building crafting furniture blocks structures terrain biomes dimensions shaders textures mining redstone automation farming vehicles storage inventory villages animals decoration blueprints worldgen architecture construction electricity portals exploration recipes generators factories machinery landscaping',
  rpg: 'quests dialogue companions followers armor weapons magic spells classes perks skills leveling factions dungeons enemies merchants romance character races combat bosses crafting alchemy abilities animations portraits equipment artifacts enchantments settlements mounts progression',
  survival: 'hunger thirst stamina temperature weather shelter crafting resources scavenging zombies infection healing medicine injuries weapons defense camping cooking fishing farming wildlife durability seasons darkness exploration inventory containers multiplayer building enemies combat hydration',
  simulation: 'farming crops animals fishing cooking marriage villagers dialogue portraits furniture buildings economy traffic roads vehicles industry automation factories schedules seasons weather relationships professions tourism parks electricity transport housing population finances management businesses',
  strategy: 'tactics combat diplomacy factions research technology logistics economy resources defense warfare units armies battles colonists settlements crafting automation production industry trading supply planning management enemies buildings weapons upgrades expansion territory scenarios difficulty intelligence pathfinding',
  action: 'combat weapons enemies bosses attacks movement dodge sprint stamina abilities skills animations effects projectiles explosions firearms melee armor difficulty upgrades targeting camera controls aiming grenades vehicles multiplayer missions speed parkour grappling crosshair',
  roguelike: 'items artifacts relics loot bosses enemies stages levels difficulty randomizer procedural abilities upgrades unlocks characters classes combat weapons attacks damage healing potions cooldowns challenges modifiers perks skills runs seeds survival multiplayer encounters',
  horror: 'monsters ghosts demons enemies darkness flashlight lighting sound ambience jumpscare sanity survival stealth escape haunted paranormal creatures suspense atmosphere difficulty warnings hallucinations shadows investigation equipment scares screams nightvision cameras traps infection foggy',
};

const common = {
  fabrci: 'fabric', fabirc: 'fabric', farbic: 'fabric',
  soduim: 'sodium', sodum: 'sodium',
  optfine: 'optifine', optifne: 'optifine',
  forg: 'forge', neoforg: 'neoforge',
};

function variants(term) {
  const result = new Set();
  for (let index = 1; index < term.length - 1; index++) {
    if (term[index] !== term[index + 1]) {
      result.add(term.slice(0, index) + term[index + 1] + term[index] + term.slice(index + 2));
    }
    result.add(term.slice(0, index) + term[index] + term.slice(index));
  }
  return result;
}

const genres = {};
for (const [genre, words] of Object.entries(terms)) {
  const canonical = new Set(words.split(' '));
  const entries = {};
  const candidates = [...canonical].map(word => ({ word, typos: [...variants(word)] }));
  for (let round = 0; Object.keys(entries).length < 128 && round < 20; round++) {
    for (const { word, typos } of candidates) {
      const typo = typos[round];
      if (!typo || Object.keys(entries).length >= 128) continue;
      if (canonical.has(typo) || Object.hasOwn(common, typo)) continue;
      if (Object.hasOwn(entries, typo) && entries[typo] !== word) continue;
      entries[typo] = word;
    }
  }
  if (Object.keys(entries).length < 100) throw new Error(`${genre}: fewer than 100 unambiguous corrections`);
  genres[genre] = Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b, 'en')));
  console.log(`${genre}: ${Object.keys(entries).length} corrections`);
}

const destination = resolve(dirname(fileURLToPath(import.meta.url)), '../shared/data/search-corrections.json');
await writeFile(destination, JSON.stringify({ common, genres }, null, 2) + '\n');
