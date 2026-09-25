import { z } from 'zod';
import { findGames, GAMES, getGame } from '../shared/games';
import { SOURCES, type SearchRequest, type Source } from '../shared/types';
import { translate } from '../shared/translations';
import type { Locale } from '../shared/locale';
import type { Config } from './config';
import { createAdapters, readCursor } from './adapters';
import { UpstreamClient } from './http';

const querySchema = z.object({
  gameId: z.string().max(80), source: z.enum(SOURCES), query: z.string().trim().max(200).default(''),
  version: z.string().max(40).regex(/^[\w. +\-]*$/).optional(), loader: z.enum(['fabric', 'forge', 'neoforge', 'quilt']).optional(),
  kind: z.enum(['mod', 'modpack', 'resourcepack', 'shader']).optional(), sort: z.enum(['relevance', 'downloads', 'popular', 'updated']).default('relevance'), cursor: z.string().max(1500).optional(),
}).strict();
const gamesQuerySchema = z.object({ query: z.string().max(100).optional() }).strict();
export function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
// Fetch-based API shared by Workers and the optional local Node server.
export function createApi(config: Config, http = new UpstreamClient(config.UPSTREAM_USER_AGENT)) {
  const adapters = createAdapters(config, http);
  return async (request: Request, locale: Locale = 'ko'): Promise<Response> => {
    const url = new URL(request.url);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const response = jsonResponse({ error: 'method_not_allowed' }, 405);
      response.headers.set('Allow', 'GET, HEAD');
      return response;
    }
    if (url.pathname === '/health') return jsonResponse({ ok: true, version: '0.1.0' });
    if (url.pathname === '/v1/games') {
      const parsed = gamesQuerySchema.safeParse(Object.fromEntries(url.searchParams));
      return parsed.success ? jsonResponse({ games: findGames(parsed.data.query) }) : jsonResponse({ error: 'invalid_query' }, 400);
    }
    const sourcePath = url.pathname.match(/^\/v1\/games\/([^/]+)\/sources$/);
    if (sourcePath) {
      const game = getGame(sourcePath[1]);
      return game ? jsonResponse({ sources: SOURCES.map(source => {
        const caps = adapters[source].getCapabilities(game);
        return { ...caps, message: translate(locale, caps.message) };
      }) }) : jsonResponse({ error: 'game_not_found' }, 404);
    }
    if (url.pathname === '/v1/search') {
      const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
      if (!parsed.success) return jsonResponse({ error: 'invalid_search' }, 400);
      const { gameId, source, query, sort, cursor, version, loader, kind } = parsed.data;
      if (!getGame(gameId)) return jsonResponse({ error: 'game_not_found' }, 404);
      const search: SearchRequest = { gameId, source, query, sort, cursor, filters: { ...(version ? { version } : {}), ...(loader ? { loader } : {}), ...(kind ? { kind } : {}) } };
      try { readCursor(search); } catch { return jsonResponse({ error: 'invalid_cursor' }, 400); }
      const result = await adapters[source].search(search);
      return jsonResponse({ ...result, message: translate(locale, result.message), verifiedLinks: [] });
    }
    const detailPath = url.pathname.match(/^\/v1\/listings\/([^/]+)\/([^/]+)\/([^/]+)$/);
    if (detailPath) {
      const [, source, scope, id] = detailPath;
      if (!SOURCES.includes(source as Source) || id.length > 128 || scope.length > 128) return jsonResponse({ error: 'invalid_reference' }, 400);
      const key = source as Source;
      const game = GAMES.find(g => g.sources[key]?.scope === scope);
      if (!game) return jsonResponse({ error: 'game_not_found' }, 404);
      try {
        const listing = await adapters[key].getDetails(game, id);
        return listing ? jsonResponse({ listing }) : jsonResponse({ error: 'listing_unavailable' }, 404);
      } catch { return jsonResponse({ error: 'source_unavailable' }, 502); }
    }
    if (url.pathname === '/v1/service-status') return jsonResponse({ version: '0.1.0', sources: SOURCES.map(source => ({ source, status: adapters[source].getCapabilities(GAMES.find(g => g.sources[source])!).status })), checkedAt: new Date().toISOString() });
    return jsonResponse({ error: 'not_found' }, 404);
  };
}
