import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Listing, VerifiedProjectLink } from '../shared/types';
import { bucketKey, runSearchQueue, searchPlan } from '../shared/search-plan';
import { appendStable, groupResults } from '../shared/ranking';
import verifiedProjects from '../shared/data/verified-projects.json';
import { preferredGame, recommend, recommendationQueries, type Interest } from './lib/preferences';
import { searchSource } from './lib/api';
import { useModSummaries } from './lib/mod-summaries';
import { locale, t } from './lib/i18n';

export function Recommendations({ gameId, interests, card }: { gameId: string; interests: Interest[]; card: (item: Listing, alternatives: Listing[]) => ReactNode }) {
  const selected = gameId === 'all' ? preferredGame(interests) : gameId;
  const queries = JSON.stringify(selected ? ['', ...recommendationQueries(interests, selected)] : []);
  const [items, setItems] = useState<Listing[]>([]);
  const [links, setLinks] = useState<VerifiedProjectLink[]>(verifiedProjects);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useModSummaries(items.map(item => item.gameId), locale === 'ko');
  useEffect(() => {
    const controller = new AbortController();
    setItems([]); setLinks(verifiedProjects); setLoading(!!selected);
    if (!selected) return () => controller.abort();
    const plan = (JSON.parse(queries) as string[]).flatMap(query => searchPlan({ gameId: selected, query, filters: {}, sort: 'relevance', selectedSource: 'all' }));
    const requests = [...new Map(plan.map(request => [bucketKey(request), request])).values()];
    void runSearchQueue(requests, async request => {
      try {
        const result = await searchSource(request, controller.signal, refresh > 0);
        if (controller.signal.aborted || result.status !== 'success') return;
        setItems(previous => appendStable(previous, result.items));
        if (result.verifiedLinks?.length) setLinks(previous => [...previous, ...result.verifiedLinks!]);
      } catch { /* Other providers can still supply recommendations. */ }
    }, controller.signal).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [selected, queries, locale, refresh]);
  const groups = useMemo(() => recommend(groupResults(items, '', links), interests).slice(0, 10), [items, links, interests]);
  if (!selected) return <p className="empty-state">{t('게임을 선택하세요.')}</p>;
  if (loading) return <div className="results-loading" role="status" aria-label={t('검색 중')}><span className="results-spinner"/></div>;
  if (!groups.length) return <div className="empty-state"><button className="secondary-button" onClick={() => setRefresh(value => value + 1)}>{t('다시 시도')}</button></div>;
  return <ul className="mod-grid ranked-grid recommended-grid">{groups.map(group => <li key={group.id}>{card(group.listings[0], group.listings)}</li>)}</ul>;
}
