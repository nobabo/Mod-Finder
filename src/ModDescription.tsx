import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type Side = 'left' | 'right' | 'top' | 'bottom';
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));
function bubblePath(width: number, height: number, side: Side, arrow: number) {
  const l = 12, t = 12, r = width - 12, b = height - 12, radius = 18;
  return `M ${l + radius} ${t}
    ${side === 'top' ? `H ${arrow - 9} Q ${arrow - 4} ${t} ${arrow} 1 Q ${arrow + 4} ${t} ${arrow + 9} ${t}` : ''}
    H ${r - radius} Q ${r} ${t} ${r} ${t + radius}
    ${side === 'right' ? `V ${arrow - 9} Q ${r} ${arrow - 4} ${width - 1} ${arrow} Q ${r} ${arrow + 4} ${r} ${arrow + 9}` : ''}
    V ${b - radius} Q ${r} ${b} ${r - radius} ${b}
    ${side === 'bottom' ? `H ${arrow + 9} Q ${arrow + 4} ${b} ${arrow} ${height - 1} Q ${arrow - 4} ${b} ${arrow - 9} ${b}` : ''}
    H ${l + radius} Q ${l} ${b} ${l} ${b - radius}
    ${side === 'left' ? `V ${arrow + 9} Q ${l} ${arrow + 4} 1 ${arrow} Q ${l} ${arrow - 4} ${l} ${arrow - 9}` : ''}
    V ${t + radius} Q ${l} ${t} ${l + radius} ${t} Z`;
}

export function ModDescription({ summary, children }: { summary: string; children: ReactNode }) {
  const id = useId();
  const card = useRef<HTMLElement>(null);
  const tooltip = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 344, path: '' });
  const cancelHide = () => clearTimeout(timer.current);
  const show = () => { cancelHide(); setVisible(true); };
  const hide = () => {
    cancelHide();
    timer.current = setTimeout(() => {
      if (!card.current?.contains(document.activeElement)) setVisible(false);
    }, 120);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  useLayoutEffect(() => {
    if (!visible || !summary.trim()) return;
    let frame = 0;
    const update = () => {
      if (!card.current || !tooltip.current) return;
      const anchor = (card.current.querySelector('.mod-logo-link') ?? card.current).getBoundingClientRect();
      const rightSpace = window.innerWidth - anchor.right - 16;
      const leftSpace = anchor.left - 16;
      const side: Side = rightSpace >= 240 ? 'left' : leftSpace >= 240 ? 'right' : 'top';
      const width = Math.min(344, side === 'left' ? rightSpace : side === 'right' ? leftSpace : window.innerWidth - 24);
      tooltip.current.style.width = `${width}px`;
      const box = tooltip.current.getBoundingClientRect();
      const centerX = anchor.left + anchor.width / 2;
      const centerY = anchor.top + anchor.height / 2;
      const verticalSide: Side = anchor.bottom + box.height + 16 <= window.innerHeight ? 'top' : 'bottom';
      const tail = side === 'top' ? verticalSide : side;
      const left = clamp(side === 'left' ? anchor.right + 4 : side === 'right' ? anchor.left - width - 4 : centerX - width / 2, 12, window.innerWidth - width - 12);
      const top = clamp(side === 'top' ? (tail === 'top' ? anchor.bottom + 4 : anchor.top - box.height - 4) : centerY - box.height / 2, 12, window.innerHeight - box.height - 12);
      const arrow = tail === 'left' || tail === 'right' ? clamp(centerY - top, 40, box.height - 40) : clamp(centerX - left, 40, width - 40);
      const path = bubblePath(width, box.height, tail, arrow);
      setPosition(previous => previous.left === left && previous.top === top && previous.width === width && previous.path === path ? previous : { left, top, width, path });
      frame = requestAnimationFrame(update);
    };
    const dismiss = (event: KeyboardEvent) => { if (event.key === 'Escape') setVisible(false); };
    update();
    window.addEventListener('keydown', dismiss);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', dismiss);
    };
  }, [visible, summary]);
  return <>
    <article ref={card} className="mod-card" aria-describedby={visible && summary.trim() ? id : undefined}
      onMouseEnter={show} onMouseLeave={hide} onFocus={show}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) hide(); }}
      onClick={() => setVisible(false)}>
      {children}
    </article>
    {visible && summary.trim() && createPortal(<div ref={tooltip} id={id} role="tooltip"
      className="mod-description-tooltip" style={{ left: position.left, top: position.top, width: position.width, '--bubble-shape': `path('${position.path.replace(/\s+/g, ' ')}')`, visibility: position.path ? 'visible' : 'hidden' } as CSSProperties} onMouseEnter={cancelHide} onMouseLeave={hide}>
      <svg className="mod-description-outline" aria-hidden="true"><path d={position.path} /></svg>
      <div className="mod-description-copy">{summary}</div>
    </div>, document.body)}
  </>;
}
