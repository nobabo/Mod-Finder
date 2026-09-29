import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type Side = 'left' | 'right' | 'top' | 'bottom';
const LONG_PRESS_MS = 300;
const FADE_MS = 220;
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
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const touchPress = useRef<{ id: number; x: number; y: number; shown: boolean } | null>(null);
  const touchInput = useRef(false);
  const touchPinned = useRef(false);
  const suppressClickUntil = useRef(0);
  const openWanted = useRef(false);
  const [rendered, setRendered] = useState(false);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 344, path: '' });
  const cancelHide = () => clearTimeout(hideTimer.current);
  const show = () => {
    if (!summary.trim()) return;
    cancelHide();
    clearTimeout(exitTimer.current);
    openWanted.current = true;
    if (!rendered) {
      setPosition(previous => ({ ...previous, path: '' }));
      setRendered(true);
    } else {
      setVisible(true);
    }
  };
  const close = () => {
    touchPinned.current = false;
    cancelHide();
    clearTimeout(exitTimer.current);
    openWanted.current = false;
    setVisible(false);
    exitTimer.current = setTimeout(() => setRendered(false), FADE_MS);
  };
  const hide = () => {
    cancelHide();
    if (touchPinned.current) return;
    hideTimer.current = setTimeout(() => {
      if (!touchPinned.current && !card.current?.contains(document.activeElement)) close();
    }, 120);
  };
  const endPress = (pointerId: number, cancelled = false) => {
    if (touchPress.current?.id !== pointerId) return;
    clearTimeout(pressTimer.current);
    if (touchPress.current.shown) {
      suppressClickUntil.current = Date.now() + 700;
      if (cancelled) close();
    }
    touchPress.current = null;
  };
  useEffect(() => () => {
    clearTimeout(hideTimer.current);
    clearTimeout(exitTimer.current);
    clearTimeout(pressTimer.current);
  }, []);
  useLayoutEffect(() => {
    if (!rendered || !summary.trim()) return;
    let frame = 0;
    const revealFrame = requestAnimationFrame(() => { if (openWanted.current) setVisible(true); });
    const update = () => {
      if (!card.current || !tooltip.current) return;
      const logo = card.current.querySelector('.mod-logo-link');
      const anchor = (logo?.getClientRects().length ? logo : card.current).getBoundingClientRect();
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
    const dismiss = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    const dismissOutside = (event: PointerEvent) => {
      if (touchPinned.current && !card.current?.contains(event.target as Node) && !tooltip.current?.contains(event.target as Node)) close();
    };
    update();
    window.addEventListener('keydown', dismiss);
    document.addEventListener('pointerdown', dismissOutside, true);
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(revealFrame);
      window.removeEventListener('keydown', dismiss);
      document.removeEventListener('pointerdown', dismissOutside, true);
    };
  }, [rendered, summary]);
  return <>
    <article ref={card} className="mod-card" aria-describedby={visible && summary.trim() ? id : undefined}
      onPointerEnter={event => { if (event.pointerType !== 'touch') show(); }}
      onPointerLeave={event => { if (event.pointerType !== 'touch') hide(); }}
      onPointerDown={event => {
        if (event.pointerType !== 'touch') { touchInput.current = false; return; }
        touchInput.current = true;
        if (!(event.target as Element).closest('.mod-logo-link')) return;
        suppressClickUntil.current = 0;
        clearTimeout(pressTimer.current);
        touchPress.current = { id: event.pointerId, x: event.clientX, y: event.clientY, shown: false };
        const pointerId = event.pointerId;
        pressTimer.current = setTimeout(() => {
          if (touchPress.current?.id !== pointerId) return;
          touchPress.current.shown = true;
          touchPinned.current = true;
          show();
        }, LONG_PRESS_MS);
      }}
      onPointerMove={event => {
        const press = touchPress.current;
        if (press?.id !== event.pointerId || Math.hypot(event.clientX - press.x, event.clientY - press.y) <= 12) return;
        endPress(event.pointerId, true);
      }}
      onPointerUp={event => endPress(event.pointerId)}
      onPointerCancel={event => endPress(event.pointerId, true)}
      onContextMenu={event => { if (touchInput.current && (event.target as Element).closest('.mod-logo-link')) event.preventDefault(); }}
      onClickCapture={event => {
        if (Date.now() < suppressClickUntil.current && (event.target as Element).closest('.mod-logo-link')) {
          event.preventDefault();
          event.stopPropagation();
          suppressClickUntil.current = 0;
        }
      }}
      onFocus={event => { if ((event.target as HTMLElement).matches(':focus-visible')) show(); }}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) hide(); }}
      onClick={close}>
      {children}
    </article>
    {rendered && summary.trim() && createPortal(<div ref={tooltip} id={id} role="tooltip" aria-hidden={!visible}
      className={`mod-description-tooltip${visible && position.path ? ' is-visible' : ''}`} style={{ left: position.left, top: position.top, width: position.width, '--bubble-shape': `path('${position.path.replace(/\s+/g, ' ')}')`, visibility: position.path ? 'visible' : 'hidden' } as CSSProperties} onPointerEnter={cancelHide} onPointerLeave={event => { if (event.pointerType !== 'touch') hide(); }}>
      <svg className="mod-description-outline" aria-hidden="true"><path d={position.path} /></svg>
      <div className="mod-description-copy">{summary}</div>
    </div>, document.body)}
  </>;
}
