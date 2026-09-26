import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function ModDescription({ summary, children }: { summary: string; children: ReactNode }) {
  const id = useId();
  const card = useRef<HTMLElement>(null);
  const tooltip = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
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
    const update = () => {
      if (!card.current || !tooltip.current) return;
      const anchor = card.current.getBoundingClientRect();
      const box = tooltip.current.getBoundingClientRect();
      const top = anchor.bottom + 8 + box.height <= window.innerHeight - 12
        ? anchor.bottom + 8 : anchor.top - box.height - 8;
      setPosition({
        left: Math.max(12, Math.min(anchor.left, window.innerWidth - box.width - 12)),
        top: Math.max(12, Math.min(top, window.innerHeight - box.height - 12)),
      });
    };
    const dismiss = (event: KeyboardEvent) => { if (event.key === 'Escape') setVisible(false); };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    window.addEventListener('keydown', dismiss);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
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
      className="mod-description-tooltip" style={position} onMouseEnter={cancelHide} onMouseLeave={hide}>
      {summary}
    </div>, document.body)}
  </>;
}
