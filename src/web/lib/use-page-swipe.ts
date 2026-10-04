import { useRef, type MouseEvent, type PointerEvent } from 'react';

/** Keep vertical scrolling native; claim only deliberate horizontal touch drags. */
export function usePageSwipe(enabled: boolean, turnPage: (direction: number) => void) {
  const gesture = useRef<{ id: number; x: number; y: number; horizontal: boolean } | null>(null);
  const suppressClick = useRef(false);
  const finish = (event: PointerEvent<HTMLDivElement>, cancelled = false) => {
    const drag = gesture.current;
    if (!drag || drag.id !== event.pointerId) return;
    gesture.current = null;
    if (!cancelled && drag.horizontal && Math.abs(event.clientX - drag.x) >= 48) {
      turnPage(event.clientX < drag.x ? 1 : -1);
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return {
    onPointerDown(event: PointerEvent<HTMLDivElement>) {
      suppressClick.current = false;
      if (!enabled || !event.isPrimary || event.pointerType === 'mouse') return;
      gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, horizontal: false };
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
        suppressClick.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      event.preventDefault();
    },
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => finish(event),
    onPointerCancel: (event: PointerEvent<HTMLDivElement>) => finish(event, true),
    onLostPointerCapture(event: PointerEvent<HTMLDivElement>) {
      if (event.target === event.currentTarget) gesture.current = null;
    },
    onClickCapture(event: MouseEvent<HTMLDivElement>) {
      if (suppressClick.current && event.detail !== 0) {
        event.preventDefault(); event.stopPropagation(); suppressClick.current = false;
      }
    },
  };
}
