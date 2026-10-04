import { Children, Fragment, isValidElement, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { t } from './lib/i18n';
import { useMobileLayout } from './lib/use-mobile-layout';
import { usePageSwipe } from './lib/use-page-swipe';

// Fragments and conditional children must not count as cards of their own.
export function flattenCards(children: ReactNode): ReactNode[] {
  return Children.toArray(children).flatMap(child =>
    isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment
      ? flattenCards(child.props.children) : [child]);
}

export function CardPages({ children, columns = 2, rows = 2, swipe = false }: { children: ReactNode; columns?: 2 | 3; rows?: 2 | 3; swipe?: boolean }) {
  const mobile = useMobileLayout();
  const [page, setPage] = useState(0);
  const cards = flattenCards(children);
  const pageSize = columns * rows;
  const lastPage = Math.max(0, Math.ceil(cards.length / pageSize) - 1);
  const current = Math.min(page, lastPage);
  const swipeState = usePageSwipe(mobile && swipe && lastPage > 0, direction => setPage(Math.max(0, Math.min(lastPage, current + direction))), direction => current + direction >= 0 && current + direction <= lastPage);
  if (!mobile) return children;
  const gridClass = `picker-grid picker-grid-${columns}-columns picker-grid-${rows}-rows ${cards.length <= columns ? 'picker-grid-single-row' : ''}`;
  return <>
    {swipe ? <div {...swipeState.handlers} className="picker-swipe-viewport">
      <div className={`picker-swipe-track ${swipeState.dragging ? 'is-dragging' : ''}`} style={{ transform: `translate3d(calc(${-current * 100}% + ${swipeState.offset}px),0,0)` }}>
        {Array.from({ length: lastPage + 1 }, (_, index) => <div key={index} className={gridClass} inert={index !== current} aria-hidden={index !== current ? true : undefined}>{cards.slice(index * pageSize, (index + 1) * pageSize)}</div>)}
      </div>
    </div> : <div className={gridClass}>{cards.slice(current * pageSize, current * pageSize + pageSize)}</div>}
    {lastPage > 0 && <div className="picker-pagination">
      <button type="button" aria-label={t('이전 페이지')} disabled={current === 0} onClick={() => setPage(current - 1)}><ArrowLeft size={22}/></button>
      <button type="button" aria-label={t('다음 페이지')} disabled={current === lastPage} onClick={() => setPage(current + 1)}><ArrowRight size={22}/></button>
    </div>}
  </>;
}
