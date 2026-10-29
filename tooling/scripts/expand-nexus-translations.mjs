import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_VERSION } from '../lib/version.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const output = join(root, 'output/translation-expansion');
const games = JSON.parse(await readFile(join(root, 'src/shared/data/games.json'), 'utf8'));
const requested = process.argv.find(arg => arg.startsWith('--game='))?.slice(7);
const collectOnly = process.argv.includes('--collect-only');
const reuse = process.argv.includes('--reuse');
const pause = ms => new Promise(done => setTimeout(done, ms));
const clean = value => String(value ?? '').slice(0, 1800).replace(/<[^>]*>/g, '').replace(/\[\/?[a-z][^\]]*\]/gi, '').trim();
const query = `query ModFinderTranslationExpansion($filter: ModsFilter, $sort: [ModsSort!], $offset: Int, $count: Int) {
  mods(filter: $filter, sort: $sort, offset: $offset, count: $count) {
    totalCount nodes { modId name summary downloads category game { domainName } }
  }
}`;

async function getPage(scope, offset) {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch('https://api.nexusmods.com/v2/graphql', {
        method: 'POST', credentials: 'omit',
        headers: { 'Content-Type': 'application/json', 'Application-Name': 'ModFinder', 'Application-Version': APP_VERSION },
        body: JSON.stringify({ query, variables: {
          filter: { gameDomainName: [{ value: scope, op: 'EQUALS' }] },
          sort: [{ downloads: { direction: 'DESC' } }, { name: { direction: 'ASC' } }, { createdAt: { direction: 'ASC' } }],
          offset, count: 20,
        } }), signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) { await response.body?.cancel(); throw new Error(`Nexus HTTP ${response.status}`); }
      const data = await response.json();
      if (data.errors || !Array.isArray(data.data?.mods?.nodes) || !Number.isInteger(data.data.mods.totalCount)) throw new Error('Invalid Nexus page');
      const page = data.data.mods;
      if (page.nodes.length > 20) throw new Error('Oversized Nexus page');
      for (const item of page.nodes) {
        if (item.game?.domainName !== scope || !Number.isSafeInteger(item.modId) || item.modId <= 0 || typeof item.name !== 'string' || typeof item.summary !== 'string') throw new Error('Invalid Nexus identity or content');
      }
      return page;
    } catch (error) {
      if (attempt >= 4) throw error;
      await pause(1000 * 2 ** attempt);
    }
  }
}

async function atomicJson(path, value) {
  await writeFile(`${path}.tmp`, JSON.stringify(value, null, 2) + '\n');
  await rename(`${path}.tmp`, path);
}

async function collect(game) {
  const path = join(output, `${game.id}.nexus-candidates.json`);
  if (reuse) {
    try { return JSON.parse(await readFile(path, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const rows = JSON.parse(await readFile(join(root, `src/shared/locales/mod-summaries/${game.id}.json`), 'utf8'));
  // Legacy rows lack provider IDs: exclude their titles conservatively, without inferring or merging identities.
  const existingKeys = new Set(rows.map(row => row[3]).filter(Boolean));
  const legacyTitles = new Set(rows.filter(row => !row[3]).map(row => row[0].trim()));
  const scope = game.sources.nexus.scope;
  const candidates = new Map();
  const categories = new Set();
  let total = null;
  let scanned = 0;
  for (let offset = 0; offset < 10000; offset += 20) {
    const page = await getPage(scope, offset);
    total = page.totalCount;
    scanned += page.nodes.length;
    for (const item of page.nodes) {
      categories.add(item.category);
      const key = `nexus:${scope}:${String(item.modId)}`;
      if (existingKeys.has(key) || legacyTitles.has(item.name.trim()) || !clean(item.summary) || !Number.isFinite(item.downloads) || item.downloads < 0) continue;
      candidates.set(key, { key, title: item.name.trim(), summary: clean(item.summary), metric: item.downloads, url: `https://www.nexusmods.com/${scope}/mods/${item.modId}` });
    }
    if (offset % 200 === 0 || candidates.size >= 1150) console.log(`${game.id}: scanned ${scanned}, new candidates ${candidates.size}`);
    if (candidates.size >= 1150 || !page.nodes.length || offset + page.nodes.length >= total) break;
    await pause(180);
  }
  const snapshot = { gameId: game.id, source: 'nexus', kind: 'mod', fetchedAt: new Date().toISOString(), total, scanned,
    classification: 'Nexus GraphQL mods content type; Nexus Collections are a separate content type and are not classified as ordinary mods.',
    observedCategories: [...categories].filter(Boolean).sort(),
    candidates: [...candidates.values()].sort((a, b) => b.metric - a.metric || a.key.localeCompare(b.key)),
  };
  await atomicJson(path, snapshot);
  if (snapshot.candidates.length < 1000) throw new Error(`${game.id}: only ${snapshot.candidates.length} new mod candidates`);
  return snapshot;
}

await mkdir(output, { recursive: true });
const ownedGames = ['stardew-valley', 'skyrim-se', 'cyberpunk-2077', 'baldurs-gate-3', 'fallout-4'];
const selection = games.filter(game => ownedGames.includes(game.id) && (!requested || game.id === requested));
if (!selection.length) throw new Error('No matching Nexus games');
let failed = false;
// Bound provider traffic while collecting all five games independently.
const queue = [...selection];
await Promise.all(Array.from({ length: Math.min(1, queue.length) }, async () => {
  while (queue.length) {
    const game = queue.shift();
    try {
      const snapshot = await collect(game);
      if (!collectOnly) {
        if (reuse) {
          try {
            const previous = JSON.parse(await readFile(join(output, `${game.id}.mod.nexus.json`), 'utf8'));
            if (previous.complete && previous.metadata?.fetchedAt === snapshot.fetchedAt) {
              console.log(`${game.id}: reusing completed mod artifact (${previous.count}/1000)`);
              continue;
            }
          } catch (error) { if (error.code !== 'ENOENT') throw error; }
        }
        const { translateCandidates } = await import('../lib/translation-expansion.mjs');
        const result = await translateCandidates({ gameId: game.id, kind: 'mod', source: 'nexus', candidates: snapshot.candidates, target: 1000,
          metadata: { fetchedAt: snapshot.fetchedAt, scanned: snapshot.scanned, total: snapshot.total, classification: snapshot.classification, observedCategories: snapshot.observedCategories } });
        if (!result.complete) throw new Error(`${game.id}: incomplete translation (${result.count}/1000)`);
      }
      console.log(`${game.id}: ${collectOnly ? 'collection' : 'translation'} complete`);
    } catch (error) { failed = true; console.error(`${game.id}: ${error.message}`); }
  }
}));
if (failed) process.exitCode = 1;
