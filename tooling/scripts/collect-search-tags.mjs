import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: join(root, '.env'), quiet: true });
const games = JSON.parse(await readFile(join(root, 'src/shared/data/games.json'), 'utf8'));
const tags = new Map();
const pause = ms => new Promise(done => setTimeout(done, ms));

function record(value, source, gameId, amount = 1) {
  const tag = typeof value === 'string' ? value.trim() : '';
  if (!tag) return;
  const item = tags.get(tag) ?? { occurrences: 0, sources: new Set(), games: new Set() };
  item.occurrences += amount;
  item.sources.add(source);
  item.games.add(gameId);
  tags.set(tag, item);
}

async function json(url, options = {}) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
      if (response.ok) return response.json();
      if (response.status === 429 || response.status >= 500) {
        const retryAfter = Number(response.headers.get('retry-after'));
        await response.body?.cancel();
        if (attempt < 3) {
          await pause(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 30000) : 1000 * 2 ** attempt);
          continue;
        }
      }
      await response.body?.cancel();
      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (attempt === 3 || (error instanceof Error && error.message.startsWith('HTTP '))) throw error;
      await pause(1000 * 2 ** attempt);
    }
  }
  throw new Error('Request retry limit reached');
}

const modrinth = await json('https://api.modrinth.com/v2/tag/category');
if (!Array.isArray(modrinth)) throw new Error('Invalid Modrinth categories');
for (const item of modrinth) record(item.name, 'modrinth', 'minecraft-java', 0);
console.log(`Modrinth: ${modrinth.length} categories`);

for (const game of games.filter(item => item.sources.thunderstore)) {
  const scope = game.sources.thunderstore.scope;
  let cursor = null;
  let pages = 0;
  do {
    const url = new URL(`https://thunderstore.io/api/experimental/community/${encodeURIComponent(scope)}/category/`);
    if (cursor) url.searchParams.set('cursor', cursor);
    const data = await json(url);
    if (!Array.isArray(data.results)) throw new Error(`Invalid Thunderstore categories for ${game.id}`);
    for (const item of data.results) record(item.name, 'thunderstore', game.id, 0);
    const next = data.pagination?.next_link;
    cursor = next ? new URL(next, url).searchParams.get('cursor') : null;
    pages++;
    if (pages > 10) throw new Error('Thunderstore category pagination limit reached');
  } while (cursor);
  console.log(`${game.id}: Thunderstore categories done`);
}

const nexusQuery = `query TagSamples($filter: ModsFilter, $sort: [ModsSort!], $offset: Int, $count: Int) {
  mods(filter: $filter, sort: $sort, offset: $offset, count: $count) {
    totalCount nodes { category }
  }
}`;
for (const game of games.filter(item => item.sources.nexus)) {
  const scope = game.sources.nexus.scope;
  let offset = 0;
  while (offset < 1000) {
    const data = await json('https://api.nexusmods.com/v2/graphql', {
      method: 'POST', credentials: 'omit',
      headers: { 'Content-Type': 'application/json', 'Application-Name': 'ModFinder', 'Application-Version': '0.1.0' },
      body: JSON.stringify({ query: nexusQuery, variables: {
        filter: { gameDomainName: [{ value: scope, op: 'EQUALS' }] },
        sort: [{ downloads: { direction: 'DESC' } }, { name: { direction: 'ASC' } }, { createdAt: { direction: 'ASC' } }],
        offset, count: 100,
      } }),
    });
    if (data.errors || !Array.isArray(data.data?.mods?.nodes) || !Number.isInteger(data.data.mods.totalCount)) throw new Error(`Invalid Nexus tags for ${game.id}`);
    const nodes = data.data.mods.nodes;
    for (const item of nodes) record(item.category, 'nexus', game.id);
    offset += nodes.length;
    if (!nodes.length || offset >= data.data.mods.totalCount) break;
    await pause(250);
  }
  console.log(`${game.id}: Nexus ${offset} mods`);
}

for (const game of games.filter(item => item.sources.steam)) {
  if (!process.env.STEAM_API_KEY) throw new Error('Steam key is unavailable');
  const scope = game.sources.steam.scope;
  let cursor = '*';
  let count = 0;
  const seen = new Set();
  while (count < 1000) {
    if (seen.has(cursor)) throw new Error('Repeated Steam cursor');
    seen.add(cursor);
    const input = { appid: Number(scope), search_text: '', cursor, numperpage: 100, query_type: 9, return_tags: true, return_short_description: false, filetype: 0 };
    const url = `https://api.steampowered.com/IPublishedFileService/QueryFiles/v1/?input_json=${encodeURIComponent(JSON.stringify(input))}`;
    const data = await json(url, { headers: { 'x-webapi-key': process.env.STEAM_API_KEY } });
    const items = data.response?.publishedfiledetails;
    if (!Array.isArray(items)) throw new Error(`Invalid Steam tags for ${game.id}`);
    for (const item of items) for (const value of item.tags ?? []) record(value.tag, 'steam', game.id);
    count += items.length;
    if (!items.length || !data.response.next_cursor) break;
    cursor = data.response.next_cursor;
    await pause(250);
  }
  console.log(`${game.id}: Steam ${count} items`);
}

const output = join(root, 'output/mod-translation-source');
await mkdir(output, { recursive: true });
const result = Object.fromEntries([...tags.entries()]
  .sort((a, b) => b[1].occurrences - a[1].occurrences || a[0].localeCompare(b[0]))
  .map(([tag, item]) => [tag, { occurrences: item.occurrences, sources: [...item.sources].sort(), games: [...item.games].sort() }]));
await writeFile(join(output, 'tag-candidates.json'), JSON.stringify(result, null, 2) + '\n');
console.log(`Total: ${tags.size} unique tags`);
