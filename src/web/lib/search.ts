import { t } from './i18n';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getGame } from '../../shared/games';
import { externalSearch } from '../../shared/links';
import { appendStable, groupResults, orderSearchPage, sortResultGroups, prioritizeCategories } from '../../shared/ranking';
import { getCategory } from '../../shared/categories';
import { bucketKey, searchPlan, runSearchQueue, type SearchSpec } from '../../shared/search-plan';
import { runSearchWithCorrections } from '../../shared/search-corrections';
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
  const [searching, setSearching] = useState(false);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const forceFresh = useRef(false);
  const seenCursors = useRef(new Map<string, Set<string>>());
  const key = JSON.stringify(spec);
  const run = useCallback(async (request: SearchRequest, gen: number, signal: AbortSignal, fresh = false) => {
    const id = bucketKey(request);
    try {
      const received = await searchSource(request, signal, fresh);
      if (generation.current !== gen || signal.aborted) return;
      const seen = seenCursors.current.get(id) ?? new Set<string>();
      seenCursors.current.set(id, seen);
      // A search or explicit load-more action fetches one page per bucket.
      // Discard repeated cursors so a broken upstream cannot loop forever.
      const result = received.nextCursor && (received.nextCursor === request.cursor || seen.has(received.nextCursor)) ? { ...received, nextCursor: null } : received;
      if (result.status === 'success' && result.nextCursor) seen.add(result.nextCursor);
      if (request.cursor && !['success', 'empty'].includes(result.status)) {
        setBuckets(previous => ({ ...previous, [id]: { request, loading: false, result: { ...result, items: previous[id]?.result?.items ?? [], nextCursor: request.cursor! } } }));
        return { hasItems: false, empty: false };
      }
      if (result.status === 'error') throw new Error('search_failed');
      const empty = (result.status === 'empty' || result.status === 'success') && !result.nextCursor && result.items.length === 0;
      if (generation.current !== gen || signal.aborted) return;
      const items = result.items.map(item => ({ ...item, matchedCategories: [...new Set([
        ...(result.appliedFilters.category ? [result.appliedFilters.category] : []),
        ...(spec.categories ?? []).filter(id => {
          const category = getCategory(item.gameId, id);
          return category?.source === item.source && item.tags.some(tag => [category.value, category.en].some(value => value.toLowerCase() === tag.toLowerCase()));
        }),
      ])] }));
      setItems(previous => appendStable(previous, orderSearchPage(items, request.query, request.sort)));
      if (result.verifiedLinks?.length) setLinks(previous => [...previous, ...result.verifiedLinks!]);
      setBuckets(previous => ({ ...previous, [id]: { request, loading: false, result } }));
      return { hasItems: result.items.length > 0, empty };
    } catch {
      if (generation.current !== gen || signal.aborted) return;
      const link = externalSearch(getGame(request.gameId)!, request.source, request.query, request.filters);
      setBuckets(previous => ({ ...previous, [id]: { request, loading: false, result: { source: request.source, items: [], total: null, fetchedAt: new Date().toISOString(), cached: false, appliedFilters: {}, unsupportedFilters: [], externalUrl: link.url, queryForwarded: link.queryForwarded, ...previous[id]?.result, status: 'error', message: t('검색에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.'), nextCursor: request.cursor ?? null } } }));
    }
  }, [JSON.stringify(spec.categories)]);
  useEffect(() => {
    controller.current?.abort();
    const current = new AbortController(); controller.current = current;
    const gen = ++generation.current;
    seenCursors.current.clear();
    const fresh = forceFresh.current; forceFresh.current = false;
    const requests = enabled ? searchPlan(spec) : [];
    busy.current = requests.length > 0;
    setSearching(requests.length > 0);
    setItems([]); setLinks(verifiedProjects);
    setBuckets(Object.fromEntries(requests.map(request => [bucketKey(request), { request, loading: true }])));
    const timer = setTimeout(() => {
      if (!enabled) return;
      void runSearchWithCorrections(spec, request => run(request, gen, current.signal, fresh), current.signal, round => {
        if (generation.current !== gen || current.signal.aborted) return;
        setBuckets(previous => {
          const next = { ...previous };
          for (const request of round) next[bucketKey(request)] = { request, loading: true };
          return next;
        });
      }).finally(() => { if (generation.current === gen) { busy.current = false; setSearching(false); } });
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
    void runSearchQueue(requests, async request => { await run(request, gen, signal); }, signal)
      .finally(() => { if (generation.current === gen) busy.current = false; });
  };
  const groups = useMemo(() => {
    return prioritizeCategories(sortResultGroups(groupResults(items, spec.query, links), spec.sort, modpacksFirst), spec.categories);
  }, [items, spec.query, spec.selectedSource, spec.sort, spec.categories, modpacksFirst, links]);
  return { items, groups, buckets, loading: searching || Object.values(buckets).some(b => b.loading), hasMore: Object.values(buckets).some(b => b.result?.nextCursor), loadMore, retry: () => { forceFresh.current = true; setRefresh(n => n + 1); } };
}
