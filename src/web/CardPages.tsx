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

export function CardPages({ children }: { children: ReactNode }) {
  const mobile = useMobileLayout();
  const [page, setPage] = useState(0);
  if (!mobile) return children;
  const cards = flattenCards(children);
  const lastPage = Math.max(0, Math.ceil(cards.length / 4) - 1);
  const current = Math.min(page, lastPage);
  return <>
    <div className={`picker-grid ${cards.length <= 2 ? 'picker-grid-single-row' : ''}`}>{cards.slice(current * 4, current * 4 + 4)}</div>
    {lastPage > 0 && <div className="picker-pagination">
      <button type="button" aria-label={t('이전 페이지')} disabled={current === 0} onClick={() => setPage(current - 1)}><ArrowLeft size={22}/></button>
      <button type="button" aria-label={t('다음 페이지')} disabled={current === lastPage} onClick={() => setPage(current + 1)}><ArrowRight size={22}/></button>
    </div>}
  </>;
}
