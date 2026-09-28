import { createApi, jsonResponse } from '../server/api';
import { readConfig } from '../server/config';
import { isLocale, resolveLocale } from '../shared/locale';
import { translate } from '../shared/translations';
import { SECURITY_HEADERS } from './security';

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    // Country is trusted Cloudflare metadata, never a client-supplied header.
    const requestedLanguage = request.headers.get('Accept-Language');
    const locale = url.pathname.startsWith('/v1/') && isLocale(requestedLanguage) ? requestedLanguage : resolveLocale(request.cf?.country, request.headers.get('Cookie'));
    const config = readConfig({ CURSEFORGE_API_KEY: env.CURSEFORGE_API_KEY, STEAM_API_KEY: env.STEAM_API_KEY, DISABLED_SOURCES: env.DISABLED_SOURCES, CORS_ORIGINS: env.CORS_ORIGINS, UPSTREAM_USER_AGENT: `ModFinder/0.1.0 (+${url.origin}/)` });
    const origin = request.headers.get('Origin');
    const allowedOrigin = origin && (origin === url.origin || config.origins.includes(origin)) ? origin : null;
    const isApi = url.pathname === '/health' || /^\/(v1|internal)(\/|$)/.test(url.pathname);
    const finish = (response: Response) => {
      const headers = new Headers(response.headers);
      for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
      headers.set('Content-Language', locale);
      if (isApi) {
        headers.set('Vary', 'Origin, Cookie, Accept-Language');
        if (allowedOrigin) headers.set('Access-Control-Allow-Origin', allowedOrigin);
      }
      return new Response(request.method === 'HEAD' ? null : response.body, { status: response.status, headers });
    };
    try {
      if (isApi) {
        if (request.method === 'OPTIONS') {
          if (!allowedOrigin) return finish(jsonResponse({ error: 'origin_not_allowed' }, 403));
          return finish(new Response(null, { status: 204, headers: { 'Access-Control-Allow-Methods': 'GET, HEAD', 'Access-Control-Allow-Headers': 'Accept, Accept-Language, Content-Type', 'Cache-Control': 'no-store' } }));
        }
        if (origin && !allowedOrigin) return finish(jsonResponse({ error: 'origin_not_allowed' }, 403));
        if (/^\/internal(\/|$)/.test(url.pathname)) return finish(jsonResponse({ error: 'not_found' }, 404));
        // Anonymous service: coarse per-IP protection. No IP is logged or persisted by the app.
        const { success } = await env.API_RATE_LIMITER.limit({ key: `api:${request.headers.get('CF-Connecting-IP') ?? 'local'}` });
        if (!success) {
          const response = jsonResponse({ error: 'rate_limited', message: translate(locale, '요청이 많아요. 잠시 후 다시 시도해 주세요.') }, 429);
          response.headers.set('Retry-After', '60');
          return finish(response);
        }
        // No fetch promises or credentials are shared between invocations.
        return finish(await createApi(config)(request, locale));
      }
      if (url.pathname === '/' || url.pathname === '/index.html') {
        if (request.method !== 'GET' && request.method !== 'HEAD') return finish(jsonResponse({ error: 'method_not_allowed' }, 405));
        const asset = await env.ASSETS.fetch(new Request(new URL('/', url), { method: 'GET' }));
        if (!asset.ok) return finish(asset);
        const response = new HTMLRewriter()
          .on('html', { element(element) { element.setAttribute('lang', locale); element.setAttribute('data-locale', locale); } })
          .on('title', { element(element) { element.setInnerContent('Mod Finder'); } })
          .on('meta[name="description"]', { element(element) { element.setAttribute('content', locale === 'ko' ? '여러 모드 사이트를 한곳에서 검색하고 비교하세요.' : 'Search, compare and save mods from multiple sources.'); } })
          .transform(asset);
        response.headers.set('Cache-Control', 'private, no-store');
        response.headers.delete('ETag');
        response.headers.set('Vary', 'Cookie');
        return finish(response);
      }
      return env.ASSETS.fetch(request);
    } catch {
      // Do not log URLs, queries, credentials or personal data.
      console.error(JSON.stringify({ event: 'request_failed', route: isApi ? 'api' : 'assets' }));
      return finish(jsonResponse({ error: 'internal_error', message: translate(locale, '요청을 처리하지 못했어요.') }, 500));
    }
  },
} satisfies ExportedHandler<Env>;
