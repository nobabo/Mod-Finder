import { getGame } from '../../shared/games';
import { externalSearch, safeExternalUrl } from '../../shared/links';
import type { SearchRequest, SearchResult, Source } from '../../shared/types';

export interface RecoveryLink { gameId: string; source: Source; url: string }

export function searchRecoveryLinks(buckets: { request: SearchRequest; result?: SearchResult }[]): RecoveryLink[] {
  const links = new Map<string, RecoveryLink>();
  for (const { request, result } of buckets) {
    if (!result || ['success', 'empty'].includes(result.status)) continue;
    const game = getGame(request.gameId);
    if (!game) continue;
    const fallback = externalSearch(game, request.source, request.query, request.filters).url;
    const url = (result.externalUrl && safeExternalUrl(result.externalUrl)) || (fallback && safeExternalUrl(fallback));
    if (url) links.set(url, { gameId: game.id, source: request.source, url });
  }
  return [...links.values()];
}
