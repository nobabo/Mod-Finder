import { z } from 'zod';
import { getCategory } from '../shared/categories';
import { listingKey, type Game, type Listing, type SearchRequest } from '../shared/types';
import { UpstreamClient, UpstreamError } from './http';
const query = `query ModFinderSearch($filter: ModsFilter, $sort: [ModsSort!], $offset: Int, $count: Int) {
  mods(filter: $filter, sort: $sort, offset: $offset, count: $count) {
    totalCount nodes { modId name author summary description thumbnailUrl updatedAt downloads category game { domainName } }
  }
}`;
const nodeSchema = z.object({
  modId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), name: z.string().min(1),
  author: z.string().nullable(), summary: z.string(), description: z.string().max(1000000).optional(), thumbnailUrl: z.string().nullable(),
  updatedAt: z.string(), downloads: z.number().int().nonnegative().nullable(), category: z.string(),
  game: z.object({ domainName: z.string() }),
});
const responseSchema = z.object({ data: z.object({ mods: z.object({
  totalCount: z.number().int().nonnegative(), nodes: z.array(nodeSchema).max(20),
}) }) });

const httpsImage = (value: string | null) => {
  try { const url = new URL(value ?? ''); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
};
// Anonymous public search shared by web and native clients. Personal keys are never sent.
export async function searchNexusPage(game: Game, req: SearchRequest, offset: number, http: UpstreamClient) {
  const scope = game.sources.nexus!.scope;
  const category = getCategory(game.id, req.filters.category);
  const raw = await http.json('https://api.nexusmods.com/v2/graphql', {
    method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json', 'Application-Name': 'ModFinder', 'Application-Version': '0.1.0' },
    body: JSON.stringify({ query, variables: {
      filter: { op: 'AND', filter: [
        { gameDomainName: [{ value: scope, op: 'EQUALS' }] },
        ...(req.query.trim() ? [{ op: 'OR', filter: [{ nameStemmed: [{ value: req.query.trim(), op: 'MATCHES' }] }, { description: [{ value: req.query.trim(), op: 'MATCHES' }] }] }] : []),
        ...(category ? [{ categoryName: [{ value: category.value, op: 'EQUALS' }] }] : []),
      ] },
      // Resolve equal scores consistently so adjacent offset pages do not reshuffle ties.
      sort: [{ [(req.sort === 'popular' || req.sort === 'downloads') ? 'downloads' : req.sort === 'updated' ? 'updatedAt' : 'relevance']: { direction: 'DESC' } }, { name: { direction: 'ASC' } }, { createdAt: { direction: 'ASC' } }], offset, count: 20,
    } }),
  });
  if (raw && typeof raw === 'object' && 'errors' in raw) throw new UpstreamError('invalid');
  const page = responseSchema.parse(raw).data.mods;
  if (page.nodes.some(node => node.game.domainName !== scope)) throw new UpstreamError('invalid');
  const items: Listing[] = page.nodes.map((node, i) => ({
      key: listingKey('nexus', scope, String(node.modId)), source: 'nexus', scope, id: String(node.modId), gameId: game.id,
      title: node.name, author: node.author || null, summary: node.summary.slice(0, 1800).replace(/<[^>]*>/g, '').replace(/\[\/?[a-z][^\]]*\]/gi, ''),
      // Keep the matched-body signal without copying long HTML into client data.
      searchMatch: { query: req.query, description: !!req.query.trim() && (node.description ?? node.summary).replace(/<[^<>]*>/g,' ').replace(/\[[^\[\]]*\]/g,' ').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').includes(req.query.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim()) },
      url: `https://www.nexusmods.com/${scope}/mods/${node.modId}`, iconUrl: httpsImage(node.thumbnailUrl),
      updatedAt: Number.isFinite(Date.parse(node.updatedAt)) ? new Date(node.updatedAt).toISOString() : null,
      versions: null, loaders: null, kind: 'mod', tags: node.category ? [node.category] : [],
      metrics: node.downloads === null ? [] : [{ label: '다운로드', value: node.downloads }], rank: offset + i + 1, fetchedAt: new Date().toISOString(),
    }));

  return { items, total: page.totalCount };
}
