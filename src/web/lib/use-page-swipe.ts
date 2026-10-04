import { useEffect, useRef, type RefObject, type MouseEvent, type PointerEvent } from 'react';

/** Keep vertical scrolling native; claim only deliberate horizontal touch drags. */
export function usePageSwipe(enabled: boolean, track: RefObject<HTMLDivElement | null>, page: number, turnPage: (direction: number) => void, canTurn: (direction: number) => boolean) {
  const gesture = useRef<{ id: number; x: number; y: number; width: number; horizontal: boolean } | null>(null);
  const suppressClick = useRef(false);
  const frame = useRef<number | null>(null);
  const offset = useRef(0);
  const reset = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    offset.current = 0;
    track.current?.classList.remove('is-dragging');
    if (track.current) track.current.style.transform = `translate3d(${-page * 100}%,0,0)`;
  };
  useEffect(() => {
    if (!enabled) { gesture.current = null; reset(); }
    return () => { if (frame.current !== null) cancelAnimationFrame(frame.current); };
  }, [enabled]);
  const finish = (event: PointerEvent<HTMLDivElement>, cancelled = false) => {
    const drag = gesture.current;
    if (!drag || drag.id !== event.pointerId) return;
    gesture.current = null;
    reset();
    if (!cancelled && drag.horizontal && Math.abs(event.clientX - drag.x) >= 48) {
      turnPage(event.clientX < drag.x ? 1 : -1);
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return {
    onPointerDown(event: PointerEvent<HTMLDivElement>) {
      suppressClick.current = false;
      if (!enabled || !event.isPrimary || event.pointerType === 'mouse') return;
      gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, width: event.currentTarget.clientWidth, horizontal: false };
    },
    onPointerMove(event: PointerEvent<HTMLDivElement>) {
      const drag = gesture.current;
      if (!drag || drag.id !== event.pointerId) return;
      const x = Math.abs(event.clientX - drag.x);
      const y = Math.abs(event.clientY - drag.y);
      if (!drag.horizontal) {
        if (Math.max(x, y) < 10) return;
        if (x <= y * 1.2) { gesture.current = null; return; }
        drag.horizontal = true;
        track.current?.classList.add('is-dragging');
        suppressClick.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      const delta = event.clientX - drag.x;
      offset.current = canTurn(delta < 0 ? 1 : -1) ? Math.max(-drag.width, Math.min(drag.width, delta)) : delta * .18;
      // Touch events can arrive faster than paint. Update only the transform,
      // once per display frame, without re-rendering the React card tree.
      if (frame.current === null) frame.current = requestAnimationFrame(() => {
        frame.current = null;
        if (track.current) track.current.style.transform = `translate3d(calc(${-page * 100}% + ${offset.current}px),0,0)`;
      });
      event.preventDefault();
    },
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => finish(event),
    onPointerCancel: (event: PointerEvent<HTMLDivElement>) => finish(event, true),
    onLostPointerCapture(event: PointerEvent<HTMLDivElement>) {
      if (event.target === event.currentTarget && gesture.current) { gesture.current = null; reset(); }
    },
    onClickCapture(event: MouseEvent<HTMLDivElement>) {
      if (suppressClick.current && event.detail !== 0) {
        event.preventDefault(); event.stopPropagation(); suppressClick.current = false;
      }
    },
  };
}
