import { t } from './i18n';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getGame } from '../../shared/games';
import { externalSearch } from '../../shared/links';
import { appendStable, groupResults, orderSearchPage, sortResultGroups } from '../../shared/ranking';
import { bucketKey, searchPlan, runSearchQueue, type SearchSpec } from '../../shared/search-plan';
import verifiedProjects from '../../shared/data/verified-projects.json';
import type { Listing, SearchRequest, SearchResult, VerifiedProjectLink } from '../../shared/types';
import { searchSource } from './api';
export type { SearchSpec } from '../../shared/search-plan';
export type Bucket = { request: SearchRequest; loading: boolean; result?: SearchResult };
export function useSearch(spec: SearchSpec, modpacksFirst = false, enabled = true) {
  const [items, setItems] = useState<Listing[]>([]);
  const [links, setLinks] = useState<VerifiedProjectLink[]>(verifiedProjects);
  const [buckets, setBuckets] = useState<Record<string, Bucket>>({});
  const [refresh, setRefresh] = useState(0);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const key = JSON.stringify(spec);
  const run = useCallback(async (request: SearchRequest, gen: number, signal: AbortSignal) => {
    const id = bucketKey(request);
    try {
      const seen = new Set<string>();
      let nextRequest = request;
      let received = 0;
      for (let page = 0; page < 5; page++) {
      const result = await searchSource(nextRequest, signal);
      received += result.items.length;
      const more = !!result.nextCursor && !seen.has(result.nextCursor) && result.status === 'success' && received < 100 && page < 4;
      if (generation.current !== gen || signal.aborted) return;
      setItems(previous => appendStable(previous, orderSearchPage(result.items, request.query, request.sort)));
      if (result.verifiedLinks?.length) setLinks(previous => [...previous, ...result.verifiedLinks!]);
      setBuckets(previous => ({ ...previous, [id]: { request, loading: more, result } }));
      if (!more) break;
      seen.add(result.nextCursor!);
      nextRequest = { ...request, cursor:result.nextCursor! };
      }
    } catch {
      if (generation.current !== gen || signal.aborted) return;
      const link = externalSearch(getGame(request.gameId)!, request.source, request.query, request.filters);
      setBuckets(previous => ({ ...previous, [id]: { request, loading: false, result: { source: request.source, status: 'error', message: t('검색에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.'), items: [], nextCursor: request.cursor ?? null, total: null, fetchedAt: new Date().toISOString(), cached: false, appliedFilters: {}, unsupportedFilters: [], externalUrl: link.url, queryForwarded: link.queryForwarded } } }));
    }
  }, []);
  useEffect(() => {
    controller.current?.abort();
    const current = new AbortController(); controller.current = current;
    const gen = ++generation.current;
    const requests = enabled ? searchPlan(spec) : [];
    busy.current = requests.length > 0;
    setItems([]); setLinks(verifiedProjects);
    setBuckets(Object.fromEntries(requests.map(request => [bucketKey(request), { request, loading: true }])));
    const timer = setTimeout(() => {
      void runSearchQueue(requests, request => run(request, gen, current.signal), current.signal)
        .finally(() => { if (generation.current === gen) busy.current = false; });
    }, 250);
    return () => { clearTimeout(timer); current.abort(); };
    // The serialized key contains the complete search specification.
  }, [key, refresh, run, enabled]);
  const loadMore = () => {
    if (busy.current || !controller.current || controller.current.signal.aborted) return;
    const requests = Object.values(buckets).filter(b => !b.loading && b.result?.nextCursor)
      .map(b => ({ ...b.request, cursor: b.result!.nextCursor! }));
    const gen = generation.current; const signal = controller.current.signal;
    busy.current = true;
    setBuckets(previous => {
      const next = { ...previous };
      for (const request of requests) next[bucketKey(request)] = { ...next[bucketKey(request)], loading: true };
      return next;
    });
    void runSearchQueue(requests, request => run(request, gen, signal), signal)
      .finally(() => { if (generation.current === gen) busy.current = false; });
  };
  const groups = useMemo(() => {
    return sortResultGroups(groupResults(items, spec.query, links), spec.sort, modpacksFirst);
  }, [items, spec.query, spec.selectedSource, spec.sort, modpacksFirst, links]);
  return { items, groups, buckets, loading: Object.values(buckets).some(b => b.loading), hasMore: Object.values(buckets).some(b => b.result?.nextCursor), loadMore, retry: () => setRefresh(n => n + 1) };
}
