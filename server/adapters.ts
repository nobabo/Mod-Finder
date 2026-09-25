import { createHash } from 'node:crypto';
import { z } from 'zod';
import { getGame } from '../shared/games';
import { externalSearch, safeExternalUrl } from '../shared/links';
import { listingKey, SOURCES, type Capability, type Filters, type Game, type Listing, type SearchRequest, type SearchResult, type Source, type SourceAdapter } from '../shared/types';
import type { Config } from './config';
import { UpstreamClient, UpstreamError } from './http';
import { searchNexusPage } from './nexus';

const knownLoaders = ['fabric', 'forge', 'neoforge', 'quilt', 'liteloader', 'rift'];
const text = (v: unknown): string => typeof v === 'string' ? v : '';
const arr = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
const date = (v: unknown): string | null => { const s = typeof v === 'number' ? v * 1000 : text(v); return s && Number.isFinite(new Date(s).getTime()) ? new Date(s).toISOString() : null; };
const icon = (v: unknown): string | null => { try { const u = new URL(text(v)); return u.protocol === 'https:' ? u.href : null; } catch { return null; } };
// Bound work before regex stripping; long malformed markup must not monopolize Worker CPU.
const plain = (v: unknown) => text(v).slice(0, 1800).replace(/<[^>]*>/g, '').replace(/\[\/?[a-z][^\]]*\]/gi, '');
const record = z.record(z.string(), z.unknown());
const cursorSchema = z.object({ binding: z.string(), value: z.union([z.string().max(500), z.number().int().min(0).max(100000)]) });
const modrinthSearchSchema = z.object({ hits: z.array(record).max(20), total_hits: z.number().nonnegative() });
const curseforgeSearchSchema = z.object({ data: z.array(record).max(20), pagination: z.object({ totalCount: z.number().nonnegative() }) });
const steamSearchSchema = z.object({ response: z.object({ total: z.number().optional(), next_cursor: z.string().optional(), publishedfiledetails: z.array(record).max(20).optional(), result: z.number().optional() }) });
const thunderstorePackageSchema = z.object({
  namespace: z.string().min(1).max(128).regex(/^[A-Za-z0-9_]+$/), name: z.string().min(1).max(128).regex(/^[A-Za-z0-9_]+$/),
  community_identifier: z.string(), description: z.string(),
  categories: z.array(z.object({ name: z.string(), slug: z.string() })).max(100),
  icon_url: z.string().nullable().optional(), last_updated: z.string().nullable().optional(),
  download_count: z.number().finite().nonnegative().nullable().optional(),
});
const thunderstoreSearchSchema = z.object({ count: z.number().int().nonnegative(), next: z.string().max(2048).nullable(), results: z.array(thunderstorePackageSchema).max(20) });
const fingerprint = (req: SearchRequest) => createHash('sha256').update(JSON.stringify([req.gameId, req.source, req.query, req.sort, req.filters])).digest('hex').slice(0, 16);
export function cursorFor(req: SearchRequest, value: string | number) { return Buffer.from(JSON.stringify({ binding: fingerprint(req), value })).toString('base64url'); }
export function readCursor(req: SearchRequest): string | number | undefined {
  if (!req.cursor) return undefined;
  try {
    const payload = cursorSchema.parse(JSON.parse(Buffer.from(req.cursor, 'base64url').toString()));
    if (payload.binding !== fingerprint(req)) throw new Error();
    if (typeof payload.value !== (req.source === 'steam' ? 'string' : 'number')) throw new Error();
    if (req.source === 'thunderstore' && (Number(payload.value) < 1 || Number(payload.value) > 5000)) throw new Error();
    if (req.source === 'nexus' && Number(payload.value) > 10000) throw new Error();
    return payload.value;
  } catch { throw new Error('invalid_cursor'); }
}
export function emptyResult(game: Game, req: SearchRequest, capability: Capability): SearchResult {
  const link = externalSearch(game, req.source, req.query);
  return { source: req.source, status: capability.status, items: [], nextCursor: null, total: null, fetchedAt: new Date().toISOString(), cached: false,
    appliedFilters: Object.fromEntries(Object.entries(req.filters).filter(([key, value]) => value && capability.filters.includes(key as keyof Filters))),
    unsupportedFilters: Object.entries(req.filters).filter(([key, value]) => value && !capability.filters.includes(key as keyof Filters)).map(([key]) => key),
    ...{ externalUrl: link.url, queryForwarded: link.queryForwarded }, message: capability.message };
}
function base(source: Source, game: Game, id: string): Pick<Listing, 'key' | 'source' | 'scope' | 'id' | 'gameId' | 'fetchedAt'> {
  const scope = game.sources[source]!.scope;
  return { key: listingKey(source, scope, id), source, scope, id, gameId: game.id, fetchedAt: new Date().toISOString() };
}
export function mapModrinth(raw: Record<string, unknown>, game: Game, rank: number): Listing {
  const id = text(raw.project_id ?? raw.id); if (!id || !text(raw.title)) throw new UpstreamError('invalid');
  const kind = text(raw.project_type) || 'mod';
  const route = ['mod', 'modpack', 'resourcepack', 'shader', 'plugin', 'datapack'].includes(kind) ? kind : 'project';
  const categories = arr(raw.categories);
  return { ...base('modrinth', game, id), title: text(raw.title), author: text(raw.author) || null, summary: plain(raw.description),
    url: `https://modrinth.com/${route}/${encodeURIComponent(text(raw.slug) || id)}`, iconUrl: icon(raw.icon_url), updatedAt: date(raw.date_modified ?? raw.updated),
    versions: Array.isArray(raw.versions) ? arr(raw.versions) : Array.isArray(raw.game_versions) ? arr(raw.game_versions) : null,
    loaders: Array.isArray(raw.loaders) ? arr(raw.loaders) : categories.filter(c => knownLoaders.includes(c)), kind,
    metrics: typeof raw.downloads === 'number' ? [{ label: '다운로드', value: raw.downloads }] : [], tags: categories.filter(c => !knownLoaders.includes(c)), rank };
}
export function mapCurseforge(raw: Record<string, unknown>, game: Game, rank: number): Listing {
  const id = String(raw.id ?? ''); if (!id || !text(raw.name)) throw new UpstreamError('invalid');
  const links = (raw.links ?? {}) as Record<string, unknown>;
  const authors = Array.isArray(raw.authors) ? raw.authors as Record<string, unknown>[] : [];
  const indexes = Array.isArray(raw.latestFilesIndexes) ? raw.latestFilesIndexes as Record<string, unknown>[] : [];
  const loaderNames: Record<number, string> = { 1: 'forge', 4: 'fabric', 5: 'quilt', 6: 'neoforge' };
  const classes: Record<number, string> = { 6: 'mod', 4471: 'modpack', 12: 'resourcepack', 6552: 'shader' };
  const url = safeExternalUrl(text(links.websiteUrl)); if (!url) throw new UpstreamError('invalid');
  return { ...base('curseforge', game, id), title: text(raw.name), author: authors.map(a => text(a.name)).filter(Boolean).join(', ') || null, summary: plain(raw.summary), url,
    iconUrl: icon((raw.logo as Record<string, unknown> | null)?.thumbnailUrl), updatedAt: date(raw.dateModified),
    versions: indexes.length ? [...new Set(indexes.map(i => text(i.gameVersion)).filter(Boolean))] : null,
    loaders: indexes.length ? [...new Set(indexes.map(i => loaderNames[Number(i.modLoader)]).filter(Boolean))] : null,
    kind: classes[Number(raw.classId)] ?? null, metrics: typeof raw.downloadCount === 'number' ? [{ label: '다운로드', value: raw.downloadCount }] : [],
    tags: Array.isArray(raw.categories) ? raw.categories.map(c => text((c as Record<string, unknown>).name)).filter(Boolean) : [], rank };
}
export function mapSteam(raw: Record<string, unknown>, game: Game, rank: number): Listing {
  // Published file IDs are required to be strings to avoid lossy uint64 conversions.
  const id = text(raw.publishedfileid); if (!/^\d+$/.test(id) || !text(raw.title)) throw new UpstreamError('invalid');
  return { ...base('steam', game, id), title: text(raw.title), author: null, summary: plain(raw.short_description ?? raw.description),
    url: `https://steamcommunity.com/sharedfiles/filedetails/?id=${id}`, iconUrl: icon(raw.preview_url), updatedAt: date(raw.time_updated), versions: null, loaders: null, kind: 'workshop-item',
    metrics: typeof raw.subscriptions === 'number' ? [{ label: '구독자', value: raw.subscriptions }] : [],
    tags: Array.isArray(raw.tags) ? raw.tags.map(t => text((t as Record<string, unknown>).tag)).filter(Boolean) : [], rank };
}
export function mapThunderstore(raw: Record<string, unknown>, game: Game, rank: number): Listing {
  const item = thunderstorePackageSchema.parse(raw);
  if (item.community_identifier !== game.sources.thunderstore?.scope) throw new UpstreamError('invalid');
  const id = `${item.namespace}-${item.name}`;
  return { ...base('thunderstore', game, id), title: item.name, author: item.namespace, summary: plain(item.description),
    url: `https://thunderstore.io/c/${encodeURIComponent(item.community_identifier)}/p/${item.namespace}/${item.name}/`,
    iconUrl: icon(item.icon_url), updatedAt: date(item.last_updated), versions: null, loaders: null,
    kind: item.categories.some(c => c.slug === 'modpacks') ? 'modpack' : item.categories.some(c => c.slug === 'mods') ? 'mod' : null,
    metrics: typeof item.download_count === 'number' ? [{ label: '다운로드', value: item.download_count }] : [],
    tags: item.categories.map(c => c.name), rank };
}
export class Adapter implements SourceAdapter {
  constructor(public source: Source, private config: Config, private http: UpstreamClient) {}
  getCapabilities(game: Game): Capability {
    const link = externalSearch(game, this.source, '');
    const caps: Capability = { source: this.source, status: 'ready', filters: [], sorts: ['relevance', 'downloads', 'popular', 'updated'], message: '검색할 준비가 되었어요', externalUrl: link.url, queryForwarded: link.queryForwarded };
    if (!game.sources[this.source]) return { ...caps, status: 'unsupported', message: '이 게임을 지원하지 않는 출처예요' };
    if (this.config.disabledSources.has(this.source)) return { ...caps, status: 'disabled', message: '이 출처의 검색이 잠시 쉬고 있어요' };
    if (this.source === 'modrinth' || this.source === 'curseforge') caps.filters = ['version', 'loader', 'kind'];
    if (this.source === 'curseforge' && !this.config.CURSEFORGE_API_KEY) return { ...caps, status: 'external', message: '검색 연동 준비 중 · 원본 사이트에서 볼 수 있어요' };
    if (this.source === 'steam' && !this.config.STEAM_API_KEY) return { ...caps, status: 'external', message: '검색 연동 준비 중 · 창작마당에서 볼 수 있어요' };
    if (this.source === 'thunderstore') caps.sorts = ['downloads', 'popular', 'updated'];
    return caps;
  }
  async search(req: SearchRequest): Promise<SearchResult> {
    const game = getGame(req.gameId)!;
    const caps = this.getCapabilities(game);
    const result = emptyResult(game, req, caps);
    if (caps.status !== 'ready') return result;
    const rawCursor = readCursor(req);
    const offset = typeof rawCursor === 'number' ? rawCursor : 0;
    try {
      if (this.source === 'modrinth') {
        const url = new URL('https://api.modrinth.com/v2/search');
        const facets: string[][] = [];
        if (req.filters.version) facets.push([`versions:${req.filters.version}`]);
        if (req.filters.loader) facets.push([`categories:${req.filters.loader}`]);
        if (req.filters.kind) facets.push([`project_type:${req.filters.kind}`]);
        url.search = new URLSearchParams({ query: req.query, facets: JSON.stringify(facets), offset: String(offset), limit: '20', index: (req.sort === 'popular' || req.sort === 'downloads') ? 'downloads' : req.sort === 'updated' ? 'updated' : 'relevance' }).toString();
        const data = modrinthSearchSchema.parse(await this.http.json(url.href));
        result.items = data.hits.map((hit, i) => mapModrinth(hit, game, offset + i + 1)); result.total = data.total_hits;
        result.nextCursor = offset + data.hits.length < data.total_hits && data.hits.length > 0 ? cursorFor(req, offset + data.hits.length) : null;
      } else if (this.source === 'curseforge') {
        const loaderIds: Record<string, string> = { forge: '1', fabric: '4', quilt: '5', neoforge: '6' };
        const classIds: Record<string, string> = { mod: '6', modpack: '4471', resourcepack: '12', shader: '6552' };
        const params = new URLSearchParams({ gameId: game.sources.curseforge!.scope, searchFilter: req.query, index: String(offset), pageSize: '20', sortField: (req.sort === 'popular' || req.sort === 'downloads') ? '6' : req.sort === 'updated' ? '3' : '1', sortOrder: 'desc' });
        if (req.filters.version) params.set('gameVersion', req.filters.version);
        if (req.filters.loader) params.set('modLoaderType', loaderIds[req.filters.loader]);
        if (req.filters.kind) params.set('classId', classIds[req.filters.kind]);
        const data = curseforgeSearchSchema.parse(await this.http.json(`https://api.curseforge.com/v1/mods/search?${params}`, { headers: { 'x-api-key': this.config.CURSEFORGE_API_KEY } }));
        result.items = data.data.map((hit, i) => mapCurseforge(hit, game, offset + i + 1)); result.total = data.pagination.totalCount;
        result.nextCursor = data.data.length && offset + data.data.length < Math.min(data.pagination.totalCount, 10000) ? cursorFor(req, offset + data.data.length) : null;
      } else if (this.source === 'nexus') {
        const data = await searchNexusPage(game, req, offset, this.http);
        result.items = data.items; result.total = data.total;
        const next = offset + data.items.length;
        result.nextCursor = data.items.length && next < data.total && next <= 10000 ? cursorFor(req, next) : null;
      } else if (this.source === 'thunderstore') {
        const page = typeof rawCursor === 'number' ? rawCursor : 1;
        const params = new URLSearchParams({ q: req.query, page: String(page), ordering: (req.sort === 'popular' || req.sort === 'downloads') ? 'most-downloaded' : 'last-updated', deprecated: 'false', nsfw: 'false' });
        const data = thunderstoreSearchSchema.parse(await this.http.json(`https://thunderstore.io/api/cyberstorm/listing/${encodeURIComponent(game.sources.thunderstore!.scope)}/?${params}`));
        result.items = data.results.map((hit, i) => mapThunderstore(hit, game, (page - 1) * 20 + i + 1)); result.total = data.count;
        // Never follow provider-supplied URLs; reconstruct the next request on our fixed host.
        result.nextCursor = data.next && data.results.length === 20 && page * 20 < data.count && page < 5000 ? cursorFor(req, page + 1) : null;
      } else if (this.source === 'steam') {
        const input = { appid: Number(game.sources.steam!.scope), search_text: req.query, cursor: typeof rawCursor === 'string' ? rawCursor : '*', numperpage: 20,
          query_type: (req.sort === 'popular' || req.sort === 'downloads') ? 9 : req.sort === 'updated' ? 21 : req.query ? 12 : 9, return_tags: true, return_short_description: true, return_vote_data: true, filetype: 0 };
        const data = steamSearchSchema.parse(await this.http.json(`https://api.steampowered.com/IPublishedFileService/QueryFiles/v1/?input_json=${encodeURIComponent(JSON.stringify(input))}`, { headers: { 'x-webapi-key': this.config.STEAM_API_KEY } }));
        if (data.response.result && data.response.result !== 1) throw new UpstreamError('unavailable');
        result.items = (data.response.publishedfiledetails ?? []).filter(item => item.result === undefined || item.result === 1).map((hit, i) => mapSteam(hit, game, i + 1));
        result.total = data.response.total ?? null;
        const next = data.response.next_cursor;
        result.nextCursor = result.items.length && next && next !== rawCursor && next !== '*' ? cursorFor(req, next) : null;

      }
      return { ...result, status: result.items.length ? 'success' : 'empty', message: result.items.length ? '검색 완료' : '검색 결과가 없어요' };
    } catch (error) {
      const failure = error instanceof UpstreamError ? error : new UpstreamError('invalid');
      return { ...result, items: [], nextCursor: null, status: failure.code === 'rate_limited' ? 'rate_limited' : 'error',
        message: failure.code === 'rate_limited' ? '요청이 많아 잠시 쉬고 있어요' : failure.code === 'timeout' ? '응답이 늦어지고 있어요. 다시 시도해 주세요.' : failure.code === 'auth' ? '출처 연결을 확인하고 있어요. 원본 사이트를 이용해 주세요.' : '이 출처에 연결하지 못했어요',
        ...(failure.retryAfter ? { retryAfter: failure.retryAfter } : {}) };
    }
  }
  async getDetails(game: Game, id: string): Promise<Listing | null> {
    if (this.getCapabilities(game).status !== 'ready') return null;
    if (this.source === 'modrinth') {
      const raw = record.parse(await this.http.json(`https://api.modrinth.com/v2/project/${encodeURIComponent(id)}`));
      return mapModrinth({ ...raw, versions: raw.game_versions }, game, 1);
    }
    if (this.source === 'curseforge' && /^\d+$/.test(id)) {
      const result = z.object({ data: record }).parse(await this.http.json(`https://api.curseforge.com/v1/mods/${id}`, { headers: { 'x-api-key': this.config.CURSEFORGE_API_KEY } }));
      if (String(result.data.gameId) !== game.sources.curseforge!.scope) return null;
      return mapCurseforge(result.data, game, 1);
    }
    if (this.source === 'steam' && /^\d+$/.test(id)) {
      const raw = z.object({ response: z.object({ publishedfiledetails: z.array(record) }) }).parse(await this.http.json('https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ itemcount: '1', 'publishedfileids[0]': id }) }));
      const item = raw.response.publishedfiledetails[0];
      if (!item || item.result !== 1 || String(item.consumer_app_id) !== game.sources.steam!.scope) return null;
      return mapSteam(item, game, 1);
    }
    return null;
  }
}
export function createAdapters(config: Config, http: UpstreamClient) { return Object.fromEntries(SOURCES.map(source => [source, new Adapter(source, config, http)])) as Record<Source, Adapter>; }
