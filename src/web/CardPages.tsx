import { Children, Fragment, isValidElement, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { t } from './lib/i18n';
import { useMobileLayout } from './lib/use-mobile-layout';

// Fragments and conditional children must not count as cards of their own.
export function flattenCards(children: ReactNode): ReactNode[] {
  return Children.toArray(children).flatMap(child =>
    isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment
      ? flattenCards(child.props.children) : [child]);
}

export function CardPages({ children, columns = 2, rows = 2 }: { children: ReactNode; columns?: 2 | 3; rows?: 2 | 3 }) {
  const mobile = useMobileLayout();
  const [page, setPage] = useState(0);
  if (!mobile) return children;
  const cards = flattenCards(children);
  const pageSize = columns * rows;
  const lastPage = Math.max(0, Math.ceil(cards.length / pageSize) - 1);
  const current = Math.min(page, lastPage);
  return <>
    <div className={`picker-grid picker-grid-${columns}-columns picker-grid-${rows}-rows ${cards.length <= columns ? 'picker-grid-single-row' : ''}`}>{cards.slice(current * pageSize, current * pageSize + pageSize)}</div>
    {lastPage > 0 && <div className="picker-pagination">
      <button type="button" aria-label={t('이전 페이지')} disabled={current === 0} onClick={() => setPage(current - 1)}><ArrowLeft size={22}/></button>
      <button type="button" aria-label={t('다음 페이지')} disabled={current === lastPage} onClick={() => setPage(current + 1)}><ArrowRight size={22}/></button>
    </div>}
  </>;
}
