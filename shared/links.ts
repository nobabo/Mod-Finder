import { getCategory } from './categories';
import type { Filters, Game, Source } from './types';
const ALLOWED = new Set(['modrinth.com', 'www.modrinth.com', 'curseforge.com', 'www.curseforge.com', 'thunderstore.io', 'nexusmods.com', 'www.nexusmods.com', 'next.nexusmods.com', 'steamcommunity.com']);
export function safeExternalUrl(value: string): string | null {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443') && ALLOWED.has(url.hostname) ? url.href : null; } catch { return null; }
}
export function externalSearch(game: Game, source: Source, query: string, filters: Filters = {}): { url: string | null; queryForwarded: boolean } {
  const mapping = game.sources[source];
  if (!mapping) return { url: null, queryForwarded: false };
  const q = query.trim();
  const category = getCategory(game.id, filters.category);
  let url: URL;
  switch (source) {
    case 'modrinth': url = new URL('https://modrinth.com/mods'); url.searchParams.set('q', q); break;
    case 'curseforge': url = new URL(`https://www.curseforge.com/${mapping.slug}/search`); url.searchParams.set('search', q); url.searchParams.set('page', '1'); url.searchParams.set('pageSize', '20'); break;
    case 'thunderstore': url = new URL(`https://thunderstore.io/c/${mapping.scope}/`); url.searchParams.set('q', q); if (category?.source === 'thunderstore') url.searchParams.set('includedCategories', category.value); break;
    case 'steam': url = new URL('https://steamcommunity.com/workshop/browse/'); url.searchParams.set('appid', mapping.scope); url.searchParams.set('searchtext', q); if (category?.source === 'steam') url.searchParams.set('requiredtags[]', category.value); break;
    case 'nexus': return { url: `https://www.nexusmods.com/${mapping.scope}/mods/`, queryForwarded: false };
  }
  return { url: url.href, queryForwarded: true };
}
