import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Download, RefreshCw, Search } from 'lucide-react';
import { getGame } from '../shared/games';
import { SOURCES, type Listing, type ResultGroup } from '../shared/types';
import koreanNames from '../shared/data/community-pack-names.ko.json';
import { groupResults, sortResultGroups } from '../shared/ranking';
import verifiedLinks from '../shared/data/verified-projects.json';
import snapshot from '../shared/data/community-ranking.json';
import { searchSource } from './lib/api';
import { locale, t } from './lib/i18n';

export function Rankings({ gameId, card, searchPack }: { gameId: string; card: (item: Listing, alternatives: Listing[]) => ReactNode; searchPack: (name: string) => void }) {
  const game = getGame(gameId);
  const minecraft = gameId === 'minecraft-java';
  const [tab, setTab] = useState<'search' | 'downloads'>(minecraft ? 'search' : 'downloads');
  const sources = SOURCES.filter(source => game?.sources[source]);
  const [items, setItems] = useState<ResultGroup[]>([]);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (tab !== 'downloads' || !game) return;
    const controller = new AbortController();
    setItems([]); setPage(0); setStatus('loading');
    void Promise.all(sources.map(async source => {
      const collected: Listing[] = [];
      let cursor: string | undefined;
      const seen = new Set<string>();
      for (let batch = 0; batch < 3; batch++) {
        const result = await searchSource({ gameId, source, query: '', sort: 'downloads', filters: minecraft ? { kind: 'modpack' } : {}, cursor }, controller.signal);
        if (!['success', 'empty'].includes(result.status)) throw new Error('Ranking unavailable');
        collected.push(...result.items);
        if (!result.nextCursor || seen.has(result.nextCursor)) break;
        cursor = result.nextCursor; seen.add(cursor);
      }
      return collected.filter(item => item.metrics.some(metric => metric.label === (source === 'steam' ? '누적 구독자' : '다운로드') && metric.value !== null) && (!minecraft || item.kind === 'modpack'));
    })).then(results => {
      if (controller.signal.aborted) return;
      setItems(sortResultGroups(groupResults(results.flat(), '', verifiedLinks), 'downloads').slice(0, 30));
      setStatus('ready');
    }).catch(() => { if (!controller.signal.aborted) setStatus('error'); });
    return () => controller.abort();
  }, [gameId, tab, refresh]);
  return <section className="collection-panel ranking-panel">
    <div className="page-heading"><h1>TOP {tab === 'downloads' ? 30 : 10}</h1></div>
    {!game ? <p className="empty-state">{t('게임을 선택하세요.')}</p> : <>
      <div className="ranking-tabs" role="group" aria-label={t('순위 종류')}>
        {minecraft && <button type="button" aria-pressed={tab === 'search'} onClick={() => setTab('search')}><Search size={18}/>{t('검색 순위')}</button>}
        <button type="button" aria-pressed={tab === 'downloads'} onClick={() => setTab('downloads')}><Download size={18}/>{t(sources.length === 1 && sources[0] === 'steam' ? '구독 순위' : '다운로드 순위')}</button>
      </div>
      {tab === 'search' ? <>
        <ol className="ranking-list">{snapshot.entries.map((entry, index) => <li key={entry.id}><button type="button" onClick={() => searchPack(entry.name)}><span className="rank-number">{String(index + 1).padStart(2, '0')}</span><strong>{locale === 'ko' ? (koreanNames as Record<string, string>)[entry.id] ?? entry.name : entry.name}</strong><ArrowRight size={18}/></button></li>)}</ol>
      </> : <>
        <div className="ranking-source"><button type="button" className="icon-button" aria-label={t('새로고침')} onClick={() => setRefresh(value => value + 1)} disabled={status === 'loading'}><RefreshCw size={17}/></button></div>
        {status === 'loading' && <div className="results-loading" role="status" aria-label={t('검색 중')}><span className="results-spinner"/></div>}
        {status === 'error' && <div className="empty-state"><p>{t('순위를 불러오지 못했어요.')}</p><button className="secondary-button" onClick={() => setRefresh(value => value + 1)}>{t('다시 시도')}</button></div>}
        {status === 'ready' && !items.length && <p className="empty-state">{t('제공되는 순위가 없어요.')}</p>}
        {!!items.length && <>
          <ol className="mod-grid ranked-grid" start={page * 10 + 1}>{items.slice(page * 10, page * 10 + 10).map((group, index) => <li key={group.id}><span className="rank-number">{String(page * 10 + index + 1).padStart(2, '0')}</span>{card(group.listings[0], group.listings)}</li>)}</ol>
          <div className="ranking-pagination">
            <button className="secondary-button" aria-label={t('이전 페이지')} disabled={page === 0} onClick={() => setPage(value => value - 1)}><ChevronLeft size={18}/></button>
            <span aria-live="polite">{page + 1} / {Math.ceil(items.length / 10)}</span>
            <button className="secondary-button" aria-label={t('다음 페이지')} disabled={(page + 1) * 10 >= items.length} onClick={() => setPage(value => value + 1)}><ChevronRight size={18}/></button>
          </div>
        </>}
      </>}
    </>}
  </section>;
}
