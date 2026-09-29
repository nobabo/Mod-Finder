import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, Download, RefreshCw, Search } from 'lucide-react';
import { getGame } from '../shared/games';
import { SOURCES, SOURCE_NAMES, type Listing, type Source } from '../shared/types';
import snapshot from '../shared/data/community-ranking.json';
import { searchSource } from './lib/api';
import { locale, t } from './lib/i18n';

export function Rankings({ gameId, card, searchPack }: { gameId: string; card: (item: Listing) => ReactNode; searchPack: (name: string) => void }) {
  const game = getGame(gameId);
  const minecraft = gameId === 'minecraft-java';
  const [tab, setTab] = useState<'search' | 'downloads'>(minecraft ? 'search' : 'downloads');
  const sources = SOURCES.filter(source => game?.sources[source]);
  const [source, setSource] = useState<Source>(minecraft ? 'curseforge' : sources[0] ?? 'modrinth');
  const [items, setItems] = useState<Listing[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (tab !== 'downloads' || !game) return;
    const controller = new AbortController();
    setItems([]); setStatus('loading');
    void searchSource({ gameId, source, query: '', sort: 'downloads', filters: minecraft ? { kind: 'modpack' } : {} }, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      const metric = source === 'steam' ? '누적 구독자' : '다운로드';
      const value = (item: Listing) => item.metrics.find(item => item.label === metric)?.value;
      setItems(result.items.filter(item => value(item) !== undefined && (!minecraft || item.kind === 'modpack')).sort((a, b) => value(b)! - value(a)!).slice(0, 10));
      setStatus(['success', 'empty'].includes(result.status) ? 'ready' : 'error');
    }).catch(() => { if (!controller.signal.aborted) setStatus('error'); });
    return () => controller.abort();
  }, [gameId, source, tab, refresh]);
  return <section className="collection-panel ranking-panel">
    <div className="page-heading"><h1>TOP 10</h1></div>
    {!game ? <p className="empty-state">{t('게임을 선택하세요.')}</p> : <>
      <div className="ranking-tabs" role="group" aria-label={t('순위 종류')}>
        {minecraft && <button type="button" aria-pressed={tab === 'search'} onClick={() => setTab('search')}><Search size={18}/>{t('검색 순위')}</button>}
        <button type="button" aria-pressed={tab === 'downloads'} onClick={() => setTab('downloads')}><Download size={18}/>{t(source === 'steam' ? '구독 순위' : '다운로드 순위')}</button>
      </div>
      {tab === 'search' ? <>
        <div className="ranking-source"><a href={snapshot.sourceUrl} target="_blank" rel="noreferrer">{t('게시판 언급순 · 제목 1–15페이지')}</a><time dateTime={snapshot.fetchedAt}>{new Date(snapshot.fetchedAt).toLocaleDateString(locale)}</time></div>
        <ol className="ranking-list">{snapshot.entries.map((entry, index) => <li key={entry.id}><button type="button" onClick={() => searchPack(entry.name)}><span className="rank-number">{String(index + 1).padStart(2, '0')}</span><strong>{entry.name}</strong><span className="ranking-metric">{t('{count}회 언급', { count: entry.mentions })}</span><ArrowRight size={18}/></button></li>)}</ol>
      </> : <>
        <div className="ranking-source"><div className="ranking-providers" role="group" aria-label={t('출처')}>{sources.map(id => <button type="button" key={id} aria-pressed={source === id} onClick={() => setSource(id)}>{SOURCE_NAMES[id]}</button>)}</div><button type="button" className="icon-button" aria-label={t('새로고침')} onClick={() => setRefresh(value => value + 1)} disabled={status === 'loading'}><RefreshCw size={17}/></button></div>
        {status === 'loading' && <div className="results-loading" role="status" aria-label={t('검색 중')}><span className="results-spinner"/></div>}
        {status === 'error' && <div className="empty-state"><p>{t('순위를 불러오지 못했어요.')}</p><button className="secondary-button" onClick={() => setRefresh(value => value + 1)}>{t('다시 시도')}</button></div>}
        {status === 'ready' && !items.length && <p className="empty-state">{t('제공되는 순위가 없어요.')}</p>}
        {!!items.length && <ol className="mod-grid ranked-grid">{items.map((item, index) => <li key={item.key}><span className="rank-number">{String(index + 1).padStart(2, '0')}</span>{card(item)}</li>)}</ol>}
      </>}
    </>}
  </section>;
}
