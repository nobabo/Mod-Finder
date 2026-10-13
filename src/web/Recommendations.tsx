import type { ReactNode } from 'react';
import type { Listing } from '../shared/types';
import { useSearch } from './lib/search';
import { preferredGame, recommend, type Interest } from './lib/preferences';
import { t } from './lib/i18n';

export function Recommendations({ gameId, interests, card }: { gameId: string; interests: Interest[]; card: (item: Listing, alternatives: Listing[]) => ReactNode }) {
  const selected = gameId === 'all' ? preferredGame(interests) : gameId;
  const search = useSearch({ gameId: selected ?? 'all', query: '', filters: {}, sort: 'relevance', selectedSource: 'all' }, false, !!selected);
  if (!selected) return <p className="empty-state">{t('게임을 선택하세요.')}</p>;
  if (search.loading) return <div className="results-loading" role="status" aria-label={t('검색 중')}><span className="results-spinner"/></div>;
  if (!search.groups.length) return <div className="empty-state"><button className="secondary-button" onClick={search.retry}>{t('다시 시도')}</button></div>;
  return <div className="mod-grid ranked-grid">{recommend(search.groups, interests).slice(0, 10).map(group => <div key={group.id}>{card(group.listings[0], group.listings)}</div>)}</div>;
}
