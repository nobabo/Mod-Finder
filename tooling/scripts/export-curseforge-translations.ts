import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const output = resolve(root, 'output/mod-translation-source/curseforge');
export interface ExportMod { id: number; gameId: number; classId: number; name: string; summary: string; downloadCount: number; links: { websiteUrl: string; sourceUrl?: string | null } }

export function translationSnapshot(items: ExportMod[], classId: number, count = 1000) {
  if (items.length !== count || new Set(items.map(item => item.id)).size !== count) throw new Error('Incomplete or duplicate snapshot');
  const content: Record<string, string> = Object.create(null);
  const names = new Set(items.map(item => item.name));
  const manifest = items.map((item, index) => {
    if (!Number.isSafeInteger(item.id) || item.id <= 0 || item.gameId !== 432 || item.classId !== classId ||
        typeof item.name !== 'string' || !item.name.trim() || typeof item.summary !== 'string' ||
        !Number.isFinite(item.downloadCount) || item.downloadCount < 0 || (index > 0 && items[index - 1].downloadCount < item.downloadCount)) {
      throw new Error(`Invalid or unsorted CurseForge snapshot at rank ${index + 1} (id=${item.id}, game=${item.gameId}, class=${item.classId}, downloads=${item.downloadCount}, previous=${items[index - 1]?.downloadCount}, summaryType=${typeof item.summary})`);
    }
    let key = item.name;
    if (Object.hasOwn(content, key)) {
      key = `${item.name} [curseforge:432:${item.id}]`;
      while (names.has(key) || Object.hasOwn(content, key)) key += ' [duplicate]';
    }
    content[key] = item.summary;
    return { key, listingKey: `curseforge:432:${item.id}`, name: item.name, downloads: item.downloadCount, url: item.links.websiteUrl, sourceUrl: item.links.sourceUrl ?? null };
  });
  return { content, manifest };
}

export async function getJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
    if (response.ok) return response.json();
    await response.body?.cancel();
    if ((response.status !== 429 && response.status < 500) || attempt === 3) throw new Error(`Upstream HTTP ${response.status}`);
    await new Promise(done => setTimeout(done, 1000 * 2 ** attempt));
  }
}

export async function atomicJson(path: string, value: unknown) {
  await writeFile(`${path}.tmp`, JSON.stringify(value, null, 2) + '\n', 'utf8');
  await rename(`${path}.tmp`, path);
}

async function main() {
  dotenv.config({ path: resolve(root, '.env'), quiet: true });
  const key = process.env.CURSEFORGE_API_KEY;
  if (!key) throw new Error('CURSEFORGE_API_KEY is required');
  const snapshots = [];
  for (const [kind, classId] of [['mods', 6], ['modpacks', 4471]] as const) {
    const items: ExportMod[] = [];
    // The search index can lag behind live counters. Include a boundary margin,
    // then order by the actual returned downloadCount before taking 1,000.
    for (let index = 0; index < 1200; index += 50) {
      const params = new URLSearchParams({ gameId: '432', classId: String(classId), sortField: '6', sortOrder: 'desc', index: String(index), pageSize: '50' });
      const page = await getJson(`https://api.curseforge.com/v1/mods/search?${params}`, { 'x-api-key': key });
      if (!Array.isArray(page.data) || page.data.length !== 50 || page.pagination?.index !== index) throw new Error('Incomplete CurseForge page');
      items.push(...page.data);
      console.log(`${kind}: ${items.length}/1200`);
    }
    if (new Set(items.map(item => item.id)).size !== items.length) throw new Error('Duplicate IDs across pages; retry the export');
    items.sort((a, b) => b.downloadCount - a.downloadCount || a.id - b.id);
    snapshots.push({ kind, ...translationSnapshot(items.slice(0, 1000), classId) });
  }
  await mkdir(output, { recursive: true });
  for (const snapshot of snapshots) {
    await atomicJson(resolve(output, `minecraft-${snapshot.kind}.json`), snapshot.content);
    await atomicJson(resolve(output, `minecraft-${snapshot.kind}.manifest.json`), { fetchedAt: new Date().toISOString(), descriptionField: 'summary', selection: 'First 1200 API TotalDownloads results, sorted by returned downloadCount, top 1000', items: snapshot.manifest });
  }
  // Re-read final artifacts to verify JSON validity and exact entry counts.
  for (const { kind } of snapshots) {
    if (Object.keys(JSON.parse(await readFile(resolve(output, `minecraft-${kind}.json`), 'utf8'))).length !== 1000) throw new Error('Export verification failed');
  }
  console.log(`Verified 1000 mods and 1000 modpacks: ${output}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
