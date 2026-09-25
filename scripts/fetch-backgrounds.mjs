// Refresh the checked-in screenshot collection from publisher storefronts.
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const steam = {
  'stardew-valley': 413150, 'skyrim-se': 489830, 'lethal-company': 1966720,
  rimworld: 294100, valheim: 892970, terraria: 105600, 'project-zomboid': 108600,
  'cyberpunk-2077': 1091500, 'baldurs-gate-3': 1086940, 'fallout-4': 377160,
  'risk-of-rain-2': 632360, 'cities-skylines': 255710, 'dont-starve-together': 322330,
};
const minecraftPage = 'https://www.minecraft.net/en-us/store/minecraft-java-bedrock-edition-pc';
const minecraftFiles = [
  'PDP-Gallery_OV_2_16x9.jpg', 'PDP-Gallery_OV_6_16x9.jpg', 'PDP-Gallery_OV_1_16x9.jpg',
  'PDP-Gallery_OV_5_16x9.jpg', 'CREATE_BuildAlmostAnything.png', 'EXPLORE_PDPScreenshotRefresh2024_multipleBiomes_01.png',
];
async function get(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Screenshot source returned ${response.status}: ${url}`);
  return response;
}
async function save(gameId, urls, sourcePage) {
  await mkdir(`public/backgrounds/${gameId}`, { recursive: true });
  const screenshots = [];
  for (const [index, url] of urls.entries()) {
    const input = Buffer.from(await (await get(url)).arrayBuffer());
    const output = await sharp(input).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    const file = `/backgrounds/${gameId}/${String(index + 1).padStart(2, '0')}.webp`;
    await writeFile(`public${file}`, output);
    const { width, height } = await sharp(output).metadata();
    screenshots.push({ src: file, width, height, sourceUrl: url });
  }
  console.log(`${gameId}: ${screenshots.length} screenshots`);
  return { sourcePage, retrievedAt: '2026-09-25', screenshots };
}
const catalog = {};
catalog['minecraft-java'] = await save('minecraft-java', minecraftFiles.map(file => `https://www.minecraft.net/content/dam/minecraftnet/games/minecraft/screenshots/${file}`), minecraftPage);
const queue = Object.entries(steam);
await Promise.all(Array.from({ length: 2 }, async () => {
  while (queue.length) {
    const [game, appid] = queue.shift();
    const payload = await (await get(`https://store.steampowered.com/api/appdetails?appids=${appid}&l=english&cc=us`)).json();
    const data = Object.values(payload).find(entry => entry.success && entry.data?.steam_appid === appid)?.data;
    if (!data || data.screenshots.length < 5) throw new Error(`Not enough verified screenshots for ${game}`);
    catalog[game] = await save(game, data.screenshots.slice(0, 6).map(shot => shot.path_full), `https://store.steampowered.com/app/${appid}/`);
  }
}));
await writeFile('shared/data/backgrounds.json', JSON.stringify(catalog, null, 2) + '\n');
console.log(`Saved ${Object.keys(catalog).length} game collections.`);
