import { z } from 'zod';
import { APP_VERSION } from '../shared/version';
import { listingKey, type Game, type Listing, type SearchRequest } from '../shared/types';
import { UpstreamClient, UpstreamError } from './http';

const fields = 'slug name summary totalDownloads updatedAt game { domainName } user { name } tileImage { url }';
const nodeSchema = z.object({
  slug: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/), name: z.string().min(1), summary: z.string(),
  totalDownloads: z.number().int().nonnegative().nullable(), updatedAt: z.string().nullable(),
  game: z.object({ domainName: z.string() }), user: z.object({ name: z.string() }).nullable(),
  tileImage: z.object({ url: z.string() }).nullable(),
});
const headers = { 'Content-Type': 'application/json', 'Application-Name': 'ModFinder', 'Application-Version': APP_VERSION };
function mapCollection(raw: unknown, game: Game, rank: number): Listing {
  const node = nodeSchema.parse(raw), scope = game.sources.nexus!.scope;
  if (node.game.domainName !== scope) throw new UpstreamError('invalid');
  const id = `collection-${node.slug}`;
  let iconUrl: string | null = null;
  try { const image = new URL(node.tileImage?.url ?? ''); if (image.protocol === 'https:' && !image.username && !image.password) iconUrl = image.href; } catch { /* Optional image. */ }
  return {
    key: listingKey('nexus', scope, id), source: 'nexus', scope, id, gameId: game.id,
    title: node.name, author: node.user?.name || null,
    summary: node.summary.slice(0, 1800).replace(/<[^>]*>/g, '').replace(/\[\/?[a-z][^\]]*\]/gi, ''),
    url: `https://www.nexusmods.com/games/${scope}/collections/${node.slug}`, iconUrl,
    updatedAt: node.updatedAt && Number.isFinite(Date.parse(node.updatedAt)) ? new Date(node.updatedAt).toISOString() : null,
    versions: null, loaders: null, kind: 'modpack', tags: ['modpack'],
    metrics: node.totalDownloads === null ? [] : [{ label: '다운로드', value: node.totalDownloads }],
    rank, fetchedAt: new Date().toISOString(),
  };
}
export async function searchNexusCollections(game: Game, req: SearchRequest, offset: number, http: UpstreamClient) {
  const query = `query ModFinderCollections($filter: CollectionsSearchFilter, $sort: [CollectionsSearchSort!], $offset: Int, $count: Int) {
    collectionsV2(filter: $filter, sort: $sort, offset: $offset, count: $count) { totalCount nodes { ${fields} } }
  }`;
  const raw = await http.json('https://api.nexusmods.com/v2/graphql', {
    method: 'POST', credentials: 'omit', headers,
    body: JSON.stringify({ query, variables: {
      filter: { gameDomain: [{ value: game.sources.nexus!.scope, op: 'EQUALS' }],
        ...(req.query.trim() ? { generalSearch: [{ value: req.query.trim(), op: req.query.trim().length >= 2 ? 'WILDCARD' : 'EQUALS' }] } : {}) },
      sort: [{ [(req.sort === 'downloads' || req.sort === 'popular') ? 'downloads' : req.sort === 'updated' ? 'updatedAt' : 'relevance']: { direction: 'DESC' } }, { createdAt: { direction: 'ASC' } }],
      offset, count: 20,
    } }),
  });
  if (raw && typeof raw === 'object' && 'errors' in raw) throw new UpstreamError('invalid');
  const page = z.object({ data: z.object({ collectionsV2: z.object({ totalCount: z.number().int().nonnegative(), nodes: z.array(nodeSchema).max(20) }) }) }).parse(raw).data.collectionsV2;
  return { items: page.nodes.map((node, index) => mapCollection(node, game, offset + index + 1)), total: page.totalCount };
}
export async function getNexusCollection(game: Game, id: string, http: UpstreamClient): Promise<Listing | null> {
  const slug = id.match(/^collection-([a-zA-Z0-9_-]{1,128})$/)?.[1];
  if (!slug) return null;
  const raw = await http.json('https://api.nexusmods.com/v2/graphql', {
    method: 'POST', credentials: 'omit', headers,
    body: JSON.stringify({ query: `query ModFinderCollection($slug: String!, $domainName: String!) { collection(slug: $slug, domainName: $domainName) { ${fields} } }`, variables: { slug, domainName: game.sources.nexus!.scope } }),
  });
  if (raw && typeof raw === 'object' && 'errors' in raw) throw new UpstreamError('invalid');
  const node = z.object({ data: z.object({ collection: nodeSchema.nullable() }) }).parse(raw).data.collection;
  if (!node) return null;
  const item = mapCollection(node, game, 1);
  return item.id === id ? item : null;
}
