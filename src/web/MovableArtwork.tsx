import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { artworkCoordinates, artworkPosition, readArtworkPosition, saveArtworkPosition, type ArtworkPosition, type ArtworkSize } from './lib/artwork-layout';
import { t } from './lib/i18n';

interface Drag { id: number; x: number; y: number; left: number; top: number; size: ArtworkSize; previous?: ArtworkPosition; moved: boolean }
const viewport = () => ({ width: document.documentElement.clientWidth, height: window.innerHeight });

export function MovableArtwork({ id, className, themeClass, label, width, height, paused, children }: { id: string; className: string; themeClass: string; label: string; width: number; height: number; paused: boolean; children: ReactNode }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const gesture = useRef<Drag | null>(null);
  const [position, setPosition] = useState(() => {
    try { return readArtworkPosition(localStorage, id); } catch { return undefined; }
  });
  const current = useRef(position); current.current = position;
  const [metrics, setMetrics] = useState({ width: 0, height: 0, artWidth: 0, rotation: 'none', viewport: viewport() });
  const [dragging, setDragging] = useState(false);
  const moved = !!position;
  const previousMoved = useRef(moved);
  useLayoutEffect(() => {
    const element = anchor.current!;
    const measure = () => {
      const box = element.getBoundingClientRect();
      const transform = new DOMMatrixReadOnly(getComputedStyle(element).transform);
      const rotation = `matrix(${transform.a},${transform.b},${transform.c},${transform.d},0,0)`;
      setMetrics({ width: box.width, height: box.height, artWidth: element.offsetWidth, rotation, viewport: viewport() });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener('resize', measure);
    measure();
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, []);
  useLayoutEffect(() => {
    if (previousMoved.current === moved) return;
    previousMoved.current = moved;
    // Switching to the free layer replaces the button, but capture stays on its stable anchor.
    if (gesture.current || document.activeElement === document.body) button.current?.focus({ preventScroll: true });
  }, [moved]);
  const finish = (cancelled: boolean) => {
    const drag = gesture.current;
    if (!drag) return;
    gesture.current = null;
    setDragging(false);
    if (cancelled) { current.current = drag.previous; setPosition(drag.previous); }
    else if (drag.moved) {
      try { saveArtworkPosition(localStorage, id, current.current); } catch { /* Storage is optional. */ }
    }
    if (anchor.current?.hasPointerCapture(drag.id)) anchor.current.releasePointerCapture(drag.id);
  };
  const cancel = useRef(() => finish(true)); cancel.current = () => finish(true);
  useEffect(() => {
    const blur = () => cancel.current();
    const visibility = () => { if (document.hidden) blur(); };
    const escape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape' && gesture.current) { event.preventDefault(); blur(); } };
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibility);
    document.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('keydown', escape);
      const drag = gesture.current;
      if (drag && anchor.current?.hasPointerCapture(drag.id)) anchor.current.releasePointerCapture(drag.id);
      gesture.current = null;
    };
  }, []);
  useEffect(() => { if (paused) cancel.current(); }, [paused]);
  const update = (next?: ArtworkPosition) => {
    current.current = next; setPosition(next);
    try { saveArtworkPosition(localStorage, id, next); } catch { /* Storage is optional. */ }
  };
  const down = (event: PointerEvent<HTMLSpanElement>) => {
    if (paused || !event.isPrimary || event.button !== 0 || gesture.current) return;
    const box = button.current!.getBoundingClientRect();
    button.current!.focus({ preventScroll: true });
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: box.left, top: box.top, size: box, previous: current.current, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault(); event.stopPropagation();
  };
  const move = (event: PointerEvent<HTMLSpanElement>) => {
    const drag = gesture.current;
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    drag.moved = true;
    setDragging(true);
    const next = artworkPosition(drag.left + dx, drag.top + dy, drag.size, viewport());
    current.current = next; setPosition(next);
    event.preventDefault(); event.stopPropagation();
  };
  const keyboard = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (paused || gesture.current) return;
    if (event.key === 'Home') { event.preventDefault(); update(); return; }
    const direction = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, number[]>)[event.key];
    if (!direction) return;
    event.preventDefault(); event.stopPropagation();
    const box = button.current!.getBoundingClientRect();
    const step = event.shiftKey ? 24 : 8;
    update(artworkPosition(box.left + direction[0] * step, box.top + direction[1] * step, box, viewport()));
  };
  const controls = (free: boolean) => <button ref={button} type="button" className={free ? `${className} movable-artwork is-positioned` : 'movable-artwork'} aria-label={t('이미지 이동: {name}', { name: label })} aria-description={t('방향키로 이동, Home 키로 원위치')} aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Home" disabled={paused}
    style={free ? { position: 'absolute', left: '50%', top: '50%', right: 'auto', bottom: 'auto', width: metrics.artWidth, aspectRatio: `${width}/${height}`, transform: `translate(-50%,-50%) ${metrics.rotation === 'none' ? '' : metrics.rotation}`, transformOrigin: '50% 50%' } : undefined}
    >{children}</button>;
  const coordinates = position && artworkCoordinates(position, metrics, metrics.viewport);
  const layer = anchor.current?.closest('.app-shell');
  return <span ref={anchor} className={`${className}${moved ? ' is-artwork-anchor' : ''}`} style={{ aspectRatio: `${width}/${height}` } as CSSProperties} data-artwork-id={id} onPointerDown={down} onPointerMove={move}
    onPointerUp={event => { if (gesture.current?.id === event.pointerId) finish(false); }} onPointerCancel={event => { if (gesture.current?.id === event.pointerId) finish(true); }}
    onLostPointerCapture={event => { if (event.target === anchor.current && gesture.current?.id === event.pointerId) finish(true); }} onKeyDown={keyboard}
    onClick={event => { event.preventDefault(); event.stopPropagation(); }} onDoubleClick={event => { event.preventDefault(); if (!paused) update(); }}>
    {position && layer ? createPortal(<div className={`game-artwork-layer ${themeClass}${dragging ? ' is-dragging' : ''}`}><div className="game-artwork-position" style={{ ...coordinates, width: metrics.width, height: metrics.height }} data-artwork-position={id}>{controls(true)}</div></div>, layer) : controls(false)}
  </span>;
}
