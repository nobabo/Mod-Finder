import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { APP_VERSION } from '../lib/version.mjs';
import { root, games, fetchJson, pause, atomicJson, translateCandidates } from '../lib/translation-expansion.mjs';

const output = join(root, 'output/translation-expansion');
const requested = process.argv.find(arg => arg.startsWith('--game='))?.slice(7);
const reuse = process.argv.includes('--reuse');
const collectOnly = process.argv.includes('--collect-only');
const query = `query ModFinderCollectionTranslationExpansion($filter: CollectionsSearchFilter, $sort: [CollectionsSearchSort!], $offset: Int, $count: Int) {
  collectionsV2(filter: $filter, sort: $sort, offset: $offset, count: $count) {
    totalCount nodes { id slug name summary totalDownloads game { domainName } }
  }
}`;
const clean = value => value.slice(0, 1800).replace(/<[^>]*>/g, '').replace(/\[\/?[a-z][^\]]*\]/gi, '').trim();

async function collect(game) {
  const path = join(output, `${game.id}.nexus-collection-candidates.json`);
  if (reuse) {
    try { return JSON.parse(await readFile(path, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const scope = game.sources.nexus.scope;
  const candidates = new Map();
  let total = null;
  let scanned = 0;
  let blankSummaries = 0;
  for (let offset = 0; offset < 10000; offset += 20) {
    const data = await fetchJson('https://api.nexusmods.com/v2/graphql', {
      method: 'POST', credentials: 'omit',
      headers: { 'Content-Type': 'application/json', 'Application-Name': 'ModFinder', 'Application-Version': APP_VERSION },
      body: JSON.stringify({ query, variables: {
        filter: { gameDomain: [{ value: scope, op: 'EQUALS' }] },
        sort: [{ downloads: { direction: 'DESC' } }, { createdAt: { direction: 'ASC' } }],
        offset, count: 20,
      } }),
    });
    if (data.errors || !Array.isArray(data.data?.collectionsV2?.nodes) || !Number.isInteger(data.data.collectionsV2.totalCount)) throw new Error('Invalid Nexus Collections response');
    const page = data.data.collectionsV2;
    if (page.nodes.length > 20) throw new Error('Oversized Nexus Collections page');
    total = page.totalCount;
    scanned += page.nodes.length;
    for (const item of page.nodes) {
      if (item.game?.domainName !== scope || !Number.isSafeInteger(item.id) || item.id <= 0 || typeof item.slug !== 'string' || !/^[a-zA-Z0-9-]+$/.test(item.slug) || typeof item.name !== 'string' || !item.name.trim() || typeof item.summary !== 'string' || !Number.isFinite(item.totalDownloads) || item.totalDownloads < 0) throw new Error('Invalid collection identity or game');
      const summary = clean(item.summary);
      if (!summary) { blankSummaries++; continue; }
      const key = `nexus:${scope}:collection-${item.slug}`;
      candidates.set(key, { key, title: item.name.trim(), summary, metric: item.totalDownloads,
        url: `https://www.nexusmods.com/games/${scope}/collections/${item.slug}` });
    }
    if (offset % 200 === 0 || candidates.size >= 1120 || offset + page.nodes.length >= total) console.log(`${game.id} collections: scanned ${scanned}/${total}, candidates ${candidates.size}`);
    if (candidates.size >= 1120 || !page.nodes.length || offset + page.nodes.length >= total) break;
    await pause(180);
  }
  const snapshot = { gameId: game.id, kind: 'modpack', source: 'nexus', fetchedAt: new Date().toISOString(), total, scanned, blankSummaries,
    classification: 'Official Nexus collectionsV2 content type, separate from mods; original collection slugs remain strings in source-scoped IDs.', candidates: [...candidates.values()] };
  await atomicJson(path, snapshot);
  return snapshot;
}

await mkdir(output, { recursive: true });
const queue = games.filter(game => game.sources.nexus && (!requested || game.id === requested));
if (!queue.length) throw new Error('No matching Nexus games');
let failed = false;
await Promise.all(Array.from({ length: Math.min(1, queue.length) }, async () => {
  while (queue.length) {
    const game = queue.shift();
    try {
      const snapshot = await collect(game);
      if (collectOnly) continue;
      if (reuse) {
        try {
          const previous = JSON.parse(await readFile(join(output, `${game.id}.modpack.nexus.json`), 'utf8'));
          const sameSnapshot = previous.metadata?.fetchedAt === snapshot.fetchedAt;
          const accountedFor = previous.metadata?.exhausted && previous.count + previous.failed.length >= previous.candidateCount;
          if (sameSnapshot && (previous.complete || accountedFor)) {
            console.log(`${game.id}: reusing completed collections artifact (${previous.count}/1000)`);
            continue;
          }
        } catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
      const result = await translateCandidates({ gameId: game.id, kind: 'modpack', source: 'nexus', candidates: snapshot.candidates, target: 1000,
        metadata: { total: snapshot.total, scanned: snapshot.scanned, blankSummaries: snapshot.blankSummaries, fetchedAt: snapshot.fetchedAt, classification: snapshot.classification, exhausted: snapshot.scanned >= snapshot.total } });
      if (!result.complete && snapshot.scanned < snapshot.total) throw new Error(`Incomplete collections translation (${result.count}/1000) while source not exhausted`);
      console.log(`${game.id}: collections translated ${result.count}/1000, provider total ${snapshot.total}`);
    } catch (error) { failed = true; console.error(`${game.id} collections: ${error.message}`); }
  }
}));
if (failed) process.exitCode = 1;
