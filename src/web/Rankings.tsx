import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Download, RefreshCw, Search } from 'lucide-react';
import { getGame } from '../shared/games';
import type { Listing, ResultGroup } from '../shared/types';
import koreanNames from '../shared/data/community-pack-names.ko.json';
import { communityRanking } from '../shared/community-snapshots';
import type { CommunityEntry } from '../shared/community-ranking';
import { searchSource } from './lib/api';
import { downloadRanking, rankingSources } from './lib/rankings';
import { locale, t } from './lib/i18n';

export function Rankings({ gameId, card, searchMod }: { gameId: string; card: (item: Listing, alternatives: Listing[]) => ReactNode; searchMod: (entry: CommunityEntry) => void }) {
  const game = getGame(gameId);
  const community = communityRanking(gameId);
  const [tab, setTab] = useState<'search' | 'downloads'>(community ? 'search' : 'downloads');
  const activeTab = community ? tab : 'downloads';
  const sources = rankingSources(gameId);
  const [items, setItems] = useState<ResultGroup[]>([]);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (activeTab !== 'downloads' || !game) return;
    const controller = new AbortController();
    setItems([]); setPage(0); setStatus('loading');
    void downloadRanking(gameId, controller.signal, (request, signal) => searchSource(request, signal, true)).then(result => {
      if (controller.signal.aborted) return;
      setItems(result.items);
      setStatus(result.status);
    }).catch(() => { if (!controller.signal.aborted) setStatus('error'); });
    return () => controller.abort();
  }, [gameId, activeTab, refresh]);
  return <section className="collection-panel ranking-panel">
    {!game ? <p className="empty-state">{t('게임을 선택하세요.')}</p> : <>
      <div className="ranking-tabs" role="group" aria-label={t('순위 종류')}>
        {community && <button type="button" aria-pressed={activeTab === 'search'} onClick={() => setTab('search')}><Search size={18}/>{t('검색 순위')}</button>}
        <button type="button" aria-pressed={activeTab === 'downloads'} onClick={() => setTab('downloads')}><Download size={18}/>{t(sources[0] === 'steam' ? '구독 순위' : '다운로드 순위')}</button>
      </div>
      {activeTab === 'search' && community ? <>
        {!community.entries.length && <p className="empty-state">{t('제공되는 순위가 없어요.')}</p>}
        <ol className="ranking-list">{community.entries.map((entry, index) => <li key={entry.id}><button type="button" onClick={() => searchMod(entry)}><span className="rank-number">{String(index + 1).padStart(2, '0')}</span><strong>{locale === 'ko' ? entry.koreanName ?? (gameId === 'minecraft-java' ? (koreanNames as Record<string, string>)[entry.id] : undefined) ?? entry.name : entry.name}</strong><ArrowRight size={18}/></button></li>)}</ol>
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
