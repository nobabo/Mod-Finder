import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { root, games, fetchJson, pause, atomicJson, selectNewCandidates, translateCandidates } from '../lib/translation-expansion.mjs';

const targets = ['lethal-company', 'valheim', 'risk-of-rain-2'];
const site = 'https://thunderstore.io';
const requestedGame = process.argv.find(arg => arg.startsWith('--game='))?.slice(7);
const requestedKind = process.argv.find(arg => arg.startsWith('--kind='))?.slice(7);
const collectOnly = process.argv.includes('--collect-only');
const fromCandidates = process.argv.includes('--from-candidates');

export function reusableThunderstoreArtifact(previous, gameId, kind, candidates) {
  if (previous.gameId !== gameId || previous.kind !== kind || previous.source !== 'thunderstore' ||
      previous.complete !== true || previous.count !== 1000 || !Array.isArray(previous.rows) || previous.rows.length !== 1000) return false;
  const snapshot = new Map(candidates.map(item => [item.key, item]));
  const keys = new Set();
  for (const row of previous.rows) {
    if (!Array.isArray(row) || row.length !== 4 || keys.has(row[3])) return false;
    const item = snapshot.get(row[3]);
    if (!item || row[0] !== item.title || typeof item.summary !== 'string' || typeof row[2] !== 'string' || !row[2].trim()) return false;
    const original = item.summary.slice(0, 1800).replace(/<[^>]*>/g, '').replace(/\[\/?[a-z][^\]]*\]/gi, '').trim();
    if (row[1] !== original) return false;
    keys.add(row[3]);
  }
  return true;
}

// This is a user-requested translation export. No automatic application cache,
// policy flag, shared index, or raw upstream response dump is created here.
export async function collectThunderstoreCandidates(game, kind, target = 1000) {
  const scope = game.sources.thunderstore.scope;
  const filtersUrl = `${site}/api/cyberstorm/community/${encodeURIComponent(scope)}/filters/`;
  const filters = await fetchJson(filtersUrl);
  if (!Array.isArray(filters.package_categories)) throw new Error('Missing official Thunderstore categories');
  const slug = kind === 'modpack' ? 'modpacks' : 'mods';
  const matches = filters.package_categories.filter(category => category.slug === slug);
  if (matches.length !== 1 || !/^\d+$/.test(matches[0].id)) throw new Error(`${scope}: missing or ambiguous ${slug} category`);
  const category = matches[0];
  const packCategory = filters.package_categories.find(value => value.slug === 'modpacks');
  if (!packCategory || !/^\d+$/.test(packCategory.id)) throw new Error(`${scope}: missing modpack category`);
  const items = new Map();
  let reportedTotal = null;
  let lastReportedTotal = null;
  let exhausted = false;
  let pages = 0;
  let duplicateCount = 0;
  let unsupportedIdentityCount = 0;
  let unavailableMetricCount = 0;
  let candidates = [];
  const fetchedAt = new Date().toISOString();
  for (let page = 1; page <= 5000; page++) {
    const params = new URLSearchParams({ q: '', page: String(page), ordering: 'most-downloaded', deprecated: 'false', nsfw: 'false', included_categories: category.id });
    if (kind === 'mod') params.set('excluded_categories', packCategory.id);
    // Reconstruct our own request. Never follow a provider-controlled next URL.
    const data = await fetchJson(`${site}/api/cyberstorm/listing/${encodeURIComponent(scope)}/?${params}`);
    if (!Array.isArray(data.results) || data.results.length > 20 || !Number.isInteger(data.count) || data.count < 0 ||
        (data.next !== null && typeof data.next !== 'string')) throw new Error(`${scope}/${kind}: invalid page ${page}`);
    reportedTotal ??= data.count;
    lastReportedTotal = data.count;
    pages++;
    for (const item of data.results) {
      if (item.community_identifier !== scope || typeof item.description !== 'string' ||
          !Array.isArray(item.categories) || !item.categories.some(value => value.id === category.id && value.slug === slug) ||
          (kind === 'mod' && item.categories.some(value => value.slug === 'modpacks')) ||
          item.is_deprecated || item.is_nsfw) {
        throw new Error(`${scope}/${kind}: mismatched category, identity, or listing on page ${page}`);
      }
      // The app deliberately cannot address malformed package identities. Omit
      // those entries and report the exclusion instead of inventing a valid ID.
      if (typeof item.namespace !== 'string' || typeof item.name !== 'string' ||
          !/^[A-Za-z0-9_-]{1,128}$/.test(item.namespace) || !/^[A-Za-z0-9_]{1,128}$/.test(item.name)) {
        unsupportedIdentityCount++; continue;
      }
      if (!Number.isFinite(item.download_count) || item.download_count < 0) { unavailableMetricCount++; continue; }
      const key = `thunderstore:${scope}:${item.namespace}-${item.name}`;
      if (items.has(key)) { duplicateCount++; continue; }
      items.set(key, { key, title: item.name, summary: item.description, metric: item.download_count,
        url: `${site}/c/${scope}/p/${item.namespace}/${item.name}/` });
    }
    if (page % 10 === 0 || !data.next) {
      candidates = await selectNewCandidates(game.id, [...items.values()]);
      console.log(`${game.id} ${kind} collect: ${items.size} unique, ${candidates.length} new, provider ${data.count}`);
    }
    if (!data.next) { exhausted = true; break; }
    if (data.results.length !== 20) throw new Error(`${scope}/${kind}: incomplete intermediate page ${page}`);
    if (candidates.length >= target + 100) break;
    await pause(300);
  }
  candidates = await selectNewCandidates(game.id, [...items.values()]);
  candidates.sort((left, right) => right.metric - left.metric || left.key.localeCompare(right.key));
  return { candidates, metadata: { fetchedAt, filtersUrl, category, reportedTotal, lastReportedTotal, pages,
    excludedCategory: kind === 'mod' ? packCategory : null,
    exhausted, duplicateCount, unsupportedIdentityCount, unavailableMetricCount, uniqueFetched: items.size,
    selection: 'Nondeprecated, non-NSFW official category, download order; existing source identities and legacy catalog titles excluded',
    modpackDefinition: 'https://wiki.thunderstore.io/sharing-your-mods/modpacks-and-profiles' } };
}

async function main() {
  if (requestedGame && !targets.includes(requestedGame)) throw new Error('Unsupported game');
  if (requestedKind && !['mod', 'modpack'].includes(requestedKind)) throw new Error('Unsupported kind');
  for (const gameId of targets.filter(id => !requestedGame || id === requestedGame)) {
    const game = games.find(value => value.id === gameId);
    for (const kind of ['mod', 'modpack'].filter(value => !requestedKind || value === requestedKind)) {
      const candidatePath = join(root, 'output/translation-expansion', `${gameId}.${kind}.thunderstore.candidates.json`);
      const snapshot = fromCandidates ? JSON.parse(await readFile(candidatePath, 'utf8')) : await collectThunderstoreCandidates(game, kind);
      if (fromCandidates && (snapshot.gameId !== gameId || snapshot.kind !== kind || snapshot.source !== 'thunderstore')) {
        throw new Error(`${gameId}/${kind}: candidate snapshot belongs to another bucket`);
      }
      const { candidates, metadata } = snapshot;
      if (!Array.isArray(candidates) || candidates.some(item => !item.key?.startsWith(`thunderstore:${game.sources.thunderstore.scope}:`))) {
        throw new Error(`${gameId}/${kind}: candidate source identity mismatch`);
      }
      if (collectOnly) {
        // A complete, validated selection for this translation bucket, atomically
        // replaced; no full API responses or automatic search cache are retained.
        await atomicJson(candidatePath, { gameId, kind, source: 'thunderstore', candidates, metadata });
        console.log(`${gameId} ${kind}: saved ${candidates.length} translation candidates`);
      } else {
        if (fromCandidates) {
          try {
            const previous = JSON.parse(await readFile(candidatePath.replace('.candidates.json', '.json'), 'utf8'));
            if (reusableThunderstoreArtifact(previous, gameId, kind, candidates)) {
              console.log(`${gameId} ${kind}: complete artifact preserved (including recorded reviews)`);
              continue;
            }
          } catch (error) { if (error.code !== 'ENOENT') throw error; }
        }
        await translateCandidates({ gameId, kind, source: 'thunderstore', candidates, target: 1000, metadata });
      }
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
