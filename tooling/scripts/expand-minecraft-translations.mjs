import dotenv from 'dotenv';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { root, games, fetchJson, pause, selectNewCandidates, translateCandidates, atomicJson } from '../lib/translation-expansion.mjs';

dotenv.config({ path: join(root, '.env'), quiet: true });
const game = games.find(game => game.id === 'minecraft-java');
const only = process.argv.find(arg => arg.startsWith('--source='))?.slice(9);
for (const source of ['modrinth', 'curseforge'].filter(source => !only || source === only)) {
  for (const kind of ['mod', 'modpack']) {
    const path = join(root, 'output/translation-expansion', `${game.id}.${kind}.${source}.candidates.json`);
    if (process.argv.includes('--reuse')) {
      try {
        const saved = JSON.parse(await readFile(path, 'utf8'));
        if (!process.argv.includes('--collect-only')) await translateCandidates({ gameId: game.id, kind, source, ...saved });
        continue;
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    const candidates = []; let total = null; let fetched = 0;
    for (let offset = 0; offset < 10000; offset += source === 'modrinth' ? 100 : 50) {
      if (source === 'modrinth') {
        const params = new URLSearchParams({ query: '', facets: JSON.stringify([[`project_type:${kind}`]]), index: 'downloads', offset: String(offset), limit: '100' });
        const data = await fetchJson(`https://api.modrinth.com/v2/search?${params}`, { headers: { 'User-Agent': 'ModFinder translation expansion' } });
        if (!Array.isArray(data.hits) || !Number.isInteger(data.total_hits)) throw new Error('Invalid Modrinth page');
        total = data.total_hits; fetched += data.hits.length;
        for (const item of data.hits) {
          if (item.project_type !== kind || typeof item.project_id !== 'string') throw new Error('Modrinth kind or ID mismatch');
          candidates.push({ key: `modrinth:minecraft:${item.project_id}`, title: item.title, summary: item.description, metric: item.downloads, url: `https://modrinth.com/${kind}/${item.slug}` });
        }
        if (!data.hits.length) break;
      } else {
        if (!process.env.CURSEFORGE_API_KEY) throw new Error('CURSEFORGE_API_KEY required');
        const classId = kind === 'mod' ? 6 : 4471;
        const params = new URLSearchParams({ gameId: '432', classId: String(classId), sortField: '6', sortOrder: 'desc', index: String(offset), pageSize: '50' });
        const data = await fetchJson(`https://api.curseforge.com/v1/mods/search?${params}`, { headers: { 'x-api-key': process.env.CURSEFORGE_API_KEY } });
        if (!Array.isArray(data.data) || data.pagination?.index !== offset) throw new Error('Invalid CurseForge page');
        total = data.pagination.totalCount; fetched += data.data.length;
        for (const item of data.data) {
          if (item.gameId !== 432 || item.classId !== classId || !Number.isSafeInteger(item.id)) throw new Error('CurseForge game, kind or ID mismatch');
          candidates.push({ key: `curseforge:432:${String(item.id)}`, title: item.name, summary: item.summary, metric: item.downloadCount, url: item.links?.websiteUrl });
        }
        if (!data.data.length) break;
      }
      const count = (await selectNewCandidates(game.id, candidates)).length;
      if (offset % 500 === 0) console.log(`${source} ${kind}: fetched=${fetched}, new=${count}`);
      if (count >= 1100 || fetched >= total) break;
      await pause(250);
    }
    candidates.sort((a, b) => b.metric - a.metric || a.key.localeCompare(b.key));
    const saved = { candidates, metadata: { total, fetched, order: 'downloads', category: kind } };
    await atomicJson(path, saved);
    if (!process.argv.includes('--collect-only')) await translateCandidates({ gameId: game.id, kind, source, ...saved });
  }
}
