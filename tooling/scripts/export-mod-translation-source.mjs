import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import dotenv from 'dotenv';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: join(root, '.env'), quiet: true });
const games = JSON.parse(await readFile(join(root, 'src/shared/data/games.json'), 'utf8'));
const output = join(root, 'output/mod-translation-source');
const limit = 1000;
const probe = process.argv.includes('--probe');
const includeNexus = process.argv.includes('--include-nexus');
const nexusOnly = process.argv.includes('--nexus-only');
const requestedGame = process.argv.find(arg => arg.startsWith('--game='))?.slice(7);
const pause = ms => new Promise(resolvePause => setTimeout(resolvePause, ms));
const clean = value => String(value ?? '').slice(0, 1800).replace(/<[^>]*>/g, '').replace(/\[\/?[a-z][^\]]*\]/gi, '').trim();

async function getJson(url, options = {}) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
      if (response.ok) return response.json();
      if ((response.status === 429 || response.status >= 500) && attempt < 3) {
        const retryAfter = Number(response.headers.get('retry-after'));
        await response.body?.cancel();
        await pause(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 30000) : 1000 * 2 ** attempt);
        continue;
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

function entry(source, scope, id, title, summary, metric, url) {
  if (!id || !title || !Number.isFinite(metric) || metric < 0) return null;
  return { listingKey: `${source}:${scope}:${id}`, source, title: String(title).trim(), summary: clean(summary), metric, url };
}

async function modrinth(game) {
  const scope = game.sources.modrinth.scope;
  const entries = [];
  let total = null;
  for (let offset = 0; offset < limit; offset += 100) {
    const params = new URLSearchParams({ query: '', facets: '[]', index: 'downloads', offset: String(offset), limit: '100' });
    const data = await getJson(`https://api.modrinth.com/v2/search?${params}`, { headers: { 'User-Agent': process.env.UPSTREAM_USER_AGENT || 'ModFinder/0.1.0' } });
    if (!Array.isArray(data.hits) || !Number.isInteger(data.total_hits)) throw new Error('Invalid Modrinth response');
    total = data.total_hits;
    if (probe) return { count: data.hits.length, total };
    for (const item of data.hits) {
      const value = entry('modrinth', scope, String(item.project_id ?? item.id ?? ''), item.title, item.description, item.downloads, `https://modrinth.com/${item.project_type || 'mod'}/${item.slug || item.project_id}`);
      if (value) entries.push(value);
    }
    console.log(`${game.id} modrinth ${entries.length}/${Math.min(total, limit)}`);
    if (!data.hits.length || offset + data.hits.length >= total) break;
    await pause(200);
  }
  return { entries, total, metric: 'downloads' };
}

async function thunderstore(game) {
  const scope = game.sources.thunderstore.scope;
  const entries = [];
  let total = null;
  // Extra rows cover packages pinned above their download rank by the provider.
  for (let page = 1; page <= 55; page++) {
    const params = new URLSearchParams({ q: '', page: String(page), ordering: 'most-downloaded', deprecated: 'false', nsfw: 'false' });
    const data = await getJson(`https://thunderstore.io/api/cyberstorm/listing/${encodeURIComponent(scope)}/?${params}`);
    if (!Array.isArray(data.results) || !Number.isInteger(data.count)) throw new Error('Invalid Thunderstore response');
    total = data.count;
    if (probe) return { count: data.results.length, total };
    for (const item of data.results) {
      if (item.community_identifier !== scope) throw new Error('Thunderstore game mismatch');
      const id = `${item.namespace}-${item.name}`;
      const value = entry('thunderstore', scope, id, item.name, item.description, item.download_count, `https://thunderstore.io/c/${scope}/p/${item.namespace}/${item.name}/`);
      if (value) entries.push(value);
    }
    console.log(`${game.id} thunderstore ${entries.length}/${Math.min(total, 1100)}`);
    if (!data.next || !data.results.length || entries.length >= 1100) break;
    await pause(350);
  }
  return { entries, total, metric: 'downloads' };
}

async function steam(game) {
  const scope = game.sources.steam.scope;
  const entries = [];
  let total = null;
  let cursor = '*';
  const seenCursors = new Set();
  while (entries.length < limit) {
    if (seenCursors.has(cursor)) throw new Error('Repeated Steam cursor');
    seenCursors.add(cursor);
    const input = { appid: Number(scope), search_text: '', cursor, numperpage: 100, query_type: 9, return_tags: true, return_short_description: true, return_vote_data: true, filetype: 0 };
    const url = `https://api.steampowered.com/IPublishedFileService/QueryFiles/v1/?input_json=${encodeURIComponent(JSON.stringify(input))}`;
    const data = await getJson(url, { headers: { 'x-webapi-key': process.env.STEAM_API_KEY } });
    const result = data.response;
    if ((result?.result !== undefined && result.result !== 1) || !Array.isArray(result?.publishedfiledetails)) {
      throw new Error(`Invalid Steam response (result=${result?.result ?? 'missing'}, keys=${Object.keys(data).join(',')}, responseKeys=${Object.keys(result ?? {}).join(',')})`);
    }
    total = result.total ?? null;
    if (probe) return { count: result.publishedfiledetails.length, total, firstHasSubscriptions: typeof result.publishedfiledetails[0]?.subscriptions === 'number' };
    for (const item of result.publishedfiledetails) {
      if (item.result !== undefined && item.result !== 1) continue;
      if (item.consumer_app_id !== undefined && String(item.consumer_app_id) !== scope) throw new Error('Steam game mismatch');
      const id = String(item.publishedfileid ?? '');
      if (!/^\d+$/.test(id)) continue;
      const value = entry('steam', scope, id, item.title, item.short_description ?? item.description, item.subscriptions, `https://steamcommunity.com/sharedfiles/filedetails/?id=${id}`);
      if (value) entries.push(value);
    }
    console.log(`${game.id} steam ${entries.length}/${Math.min(total ?? limit, limit)}`);
    if (!result.next_cursor || !result.publishedfiledetails.length || !total || entries.length >= total) break;
    cursor = result.next_cursor;
    await pause(250);
  }
  return { entries, total, metric: 'subscriptions' };
}

async function nexus(game) {
  const scope = game.sources.nexus.scope;
  const entries = [];
  let total = null;
  const query = `query ModFinderTranslationSource($filter: ModsFilter, $sort: [ModsSort!], $offset: Int, $count: Int) {
    mods(filter: $filter, sort: $sort, offset: $offset, count: $count) {
      totalCount nodes { modId name summary downloads game { domainName } }
    }
  }`;
  for (let offset = 0; offset < 1200; offset += 20) {
    const data = await getJson('https://api.nexusmods.com/v2/graphql', {
      method: 'POST', credentials: 'omit',
      headers: { 'Content-Type': 'application/json', 'Application-Name': 'ModFinder', 'Application-Version': '0.1.0' },
      body: JSON.stringify({ query, variables: {
        filter: { gameDomainName: [{ value: scope, op: 'EQUALS' }] },
        sort: [{ downloads: { direction: 'DESC' } }, { name: { direction: 'ASC' } }, { createdAt: { direction: 'ASC' } }],
        offset, count: 20,
      } }),
    });
    if (data.errors || !Array.isArray(data.data?.mods?.nodes) || !Number.isInteger(data.data.mods.totalCount)) throw new Error('Invalid Nexus response');
    const page = data.data.mods;
    total = page.totalCount;
    if (probe) return { count: page.nodes.length, total };
    for (const item of page.nodes) {
      if (item.game?.domainName !== scope) throw new Error('Nexus game mismatch');
      const id = String(item.modId ?? '');
      if (!/^\d+$/.test(id) || !Number.isSafeInteger(item.modId)) throw new Error('Invalid Nexus mod ID');
      const value = entry('nexus', scope, id, item.name, item.summary, item.downloads, `https://www.nexusmods.com/${scope}/mods/${id}`);
      if (value) entries.push(value);
    }
    console.log(`${game.id} nexus ${entries.length}/${Math.min(total, limit)}`);
    if (!page.nodes.length || offset + page.nodes.length >= total || new Set(entries.map(item => item.listingKey)).size >= limit) break;
    await pause(350);
  }
  return { entries, total, metric: 'downloads' };
}

const providers = { modrinth, thunderstore, steam, nexus };
const selection = games.filter(game => (!requestedGame || game.id === requestedGame) && (!nexusOnly || Object.keys(game.sources).every(source => source === 'nexus')));
if (!selection.length) throw new Error('Unknown game');
if (!probe) await mkdir(output, { recursive: true });
let failed = false;
for (const game of selection) {
  const sources = Object.keys(game.sources).filter(source => source in providers && (source !== 'steam' || process.env.STEAM_API_KEY) && (source !== 'nexus' || includeNexus));
  if (!sources.length) {
    console.log(`${game.id}: external-only`);
    continue;
  }
  try {
    const results = [];
    for (const source of sources) results.push({ source, ...await providers[source](game) });
    if (probe) { console.log(JSON.stringify({ game: game.id, sources: results })); continue; }
    const all = results.flatMap(result => result.entries);
    const distinct = [...new Map(all.map(item => [item.listingKey, item])).values()];
    distinct.sort((a, b) => b.metric - a.metric || a.listingKey.localeCompare(b.listingKey));
    const selected = distinct.slice(0, limit);
    const titleCounts = new Map();
    const content = Object.create(null);
    for (const [rank, item] of selected.entries()) {
      const occurrence = titleCounts.get(item.title) ?? 0;
      titleCounts.set(item.title, occurrence + 1);
      const key = occurrence ? `${item.title} [${item.listingKey}]` : item.title;
      content[key] = item.summary;
    }
    const filename = `${game.id}.json`;
    const temporary = join(output, `${filename}.tmp`);
    await writeFile(temporary, JSON.stringify(content, null, 2) + '\n', 'utf8');
    await rename(temporary, join(output, filename));
    console.log(`${game.id}: wrote ${selected.length} entries, ${selected.filter(item => !item.summary).length} blank summaries, ${[...titleCounts.values()].filter(count => count > 1).reduce((sum, count) => sum + count - 1, 0)} duplicate titles`);
  } catch (error) {
    failed = true;
    console.error(`${game.id}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
if (failed) process.exitCode = 1;
