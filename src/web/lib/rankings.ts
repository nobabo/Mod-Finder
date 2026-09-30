import { getGame } from '../../shared/games';
import { groupResults, sortResultGroups } from '../../shared/ranking';
import { listingKey, SOURCES, type Listing, type SearchRequest, type SearchResult, type Source } from '../../shared/types';
import verifiedLinks from '../../shared/data/verified-projects.json';

export function rankingSources(gameId: string): Source[] {
  const game = getGame(gameId);
  // Steam exposes subscriptions. They cannot be ordered against Nexus download counts.
  return game?.sources.steam ? ['steam'] : SOURCES.filter(source => game?.sources[source]);
}

export async function downloadRanking(gameId: string, signal: AbortSignal, search: (request: SearchRequest, signal: AbortSignal) => Promise<SearchResult>) {
  const game = getGame(gameId);
  if (!game) return { items: [], status: 'error' as const, failedSources: [] };
  const sources = rankingSources(gameId);
  const batches = await Promise.allSettled(sources.map(async source => {
    const collected: Listing[] = [];
    let cursor: string | undefined;
    let available = false;
    let failed = false;
    const seen = new Set<string>();
    for (let batch = 0; batch < 3; batch++) {
      if (signal.aborted) throw new Error('Ranking cancelled');
      try {
        const result = await search({ gameId, source, query: '', sort: 'downloads', filters: gameId === 'minecraft-java' ? { kind: 'modpack' } : {}, cursor }, signal);
        if (result.source !== source || !['success', 'empty'].includes(result.status)) { failed = true; break; }
        available = true;
        collected.push(...result.items.filter(item => item.gameId === gameId && item.source === source && item.scope === game.sources[source]!.scope &&
          item.key === listingKey(source, item.scope, item.id) && (gameId !== 'minecraft-java' || item.kind === 'modpack') &&
          item.metrics.some(metric => metric.label === (source === 'steam' ? '누적 구독자' : '다운로드') && Number.isFinite(metric.value) && metric.value >= 0)));
        if (!result.nextCursor || seen.has(result.nextCursor)) break;
        cursor = result.nextCursor; seen.add(cursor);
      } catch {
        failed = true; break;
      }
    }
    return { collected, available, failed };
  }));
  const valid = batches.flatMap(batch => batch.status === 'fulfilled' ? [batch.value] : []);
  return {
    items: sortResultGroups(groupResults(valid.flatMap(batch => batch.collected), '', verifiedLinks), 'downloads').slice(0, 30),
    status: valid.some(batch => batch.available) ? 'ready' as const : 'error' as const,
    failedSources: sources.filter((_, index) => batches[index].status === 'rejected' || (batches[index].status === 'fulfilled' && batches[index].value.failed)),
  };
}
