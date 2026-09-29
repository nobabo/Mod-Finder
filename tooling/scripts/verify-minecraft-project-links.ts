import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicJson, getJson } from './export-curseforge-translations';
import type { VerifiedProjectLink } from '../../src/shared/types';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
interface Candidate { listingKey: string; name: string; url: string; sourceUrl?: string | null }
interface Project { id: string; title: string; body: string; project_type: string; source_url?: string | null }
const normalized = (text: string) => text.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
function curseforgePath(text: string) {
  try {
    const url = new URL(text);
    if (url.protocol !== 'https:' || !['www.curseforge.com', 'curseforge.com'].includes(url.hostname) || url.username || url.password) return null;
    return url.pathname.match(/^\/minecraft\/(?:mc-mods|modpacks)\/[^/]+/)?.[0] ?? null;
  } catch { return null; }
}

export function projectLinks(project: Project, candidates: Candidate[]): VerifiedProjectLink[] {
  // A body link alone may point at a dependency. Require the original title as well.
  const paths = new Set((project.body.match(/https:\/\/[^\s<>"'\)\]]+/g) ?? []).map(curseforgePath).filter(Boolean));
  const repository = (value?: string | null) => {
    try {
      const url = new URL(value ?? '');
      if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.username || url.password || url.search || url.hash) return null;
      const path = url.pathname.replace(/\/$/, '').replace(/\.git$/, '');
      return /^\/[^/]+\/[^/]+$/.test(path) ? path.toLowerCase() : null;
    } catch { return null; }
  };
  const repo = repository(project.source_url);
  const matches = candidates.filter(item => normalized(item.name) === normalized(project.title) &&
    (paths.has(curseforgePath(item.url)) || (repo !== null && repo === repository(item.sourceUrl))));
  if (matches.length !== 1) return [];
  return [{ projectId: `minecraft-${project.id}`, listingKeys: [`modrinth:minecraft:${project.id}`, matches[0].listingKey], evidenceUrl: `https://modrinth.com/${project.project_type}/${project.id}` }];
}

async function main() {
  const destination = resolve(root, 'src/shared/data/verified-projects.json');
  const existing: VerifiedProjectLink[] = JSON.parse(await readFile(destination, 'utf8'));
  const collected: VerifiedProjectLink[] = [];
  const headers = { 'User-Agent': 'ModFinder/0.1.0 (https://github.com/nobabo/Mod-Finder)' };
  for (const kind of ['mod', 'modpack']) {
    const candidates: Candidate[] = JSON.parse(await readFile(resolve(root, `output/mod-translation-source/curseforge/minecraft-${kind}s.manifest.json`), 'utf8')).items;
    for (let offset = 0; offset < 1000; offset += 100) {
      const params = new URLSearchParams({ facets: JSON.stringify([[`project_type:${kind}`]]), index: 'downloads', offset: String(offset), limit: '100' });
      const page = await getJson(`https://api.modrinth.com/v2/search?${params}`, headers);
      if (!Array.isArray(page.hits)) throw new Error('Invalid Modrinth search response');
      const ids = page.hits.map((item: { project_id: string }) => item.project_id);
      const projects: Project[] = await getJson(`https://api.modrinth.com/v2/projects?${new URLSearchParams({ ids: JSON.stringify(ids) })}`, headers);
      if (!Array.isArray(projects) || projects.length !== ids.length) throw new Error('Incomplete Modrinth project response');
      for (const project of projects) collected.push(...projectLinks(project, candidates));
      console.log(`${kind}: checked ${offset + projects.length}, found ${collected.length} explicit cross-site links`);
    }
  }
  // Reject ambiguous many-to-one mappings rather than collapsing ports or forks.
  const counts = new Map<string, number>();
  for (const link of collected) for (const key of link.listingKeys) counts.set(key, (counts.get(key) ?? 0) + 1);
  const used = new Set(existing.flatMap(link => link.listingKeys));
  const additions = collected.filter(link => link.listingKeys.every(key => counts.get(key) === 1 && !used.has(key)));
  await atomicJson(destination, [...existing, ...additions]);
  console.log(`Added ${additions.length} verified project links; total ${existing.length + additions.length}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
