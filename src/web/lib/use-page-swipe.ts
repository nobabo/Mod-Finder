import { useEffect, useRef, type RefObject, type MouseEvent, type PointerEvent } from 'react';

/** Keep vertical scrolling native; claim only deliberate horizontal touch drags. */
export function usePageSwipe(enabled: boolean, track: RefObject<HTMLDivElement | null>, page: number, turnPage: (direction: number) => void, canTurn: (direction: number) => boolean) {
  const gesture = useRef<{ id: number; x: number; y: number; width: number; initialOffset: number; lastX: number; time: number; velocity: number; horizontal: boolean } | null>(null);
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
    const delta = event.clientX - drag.x;
    const velocity = event.timeStamp - drag.time < 100 ? drag.velocity : 0;
    const projected = drag.initialOffset + delta + velocity * 150;
    const direction = projected < 0 ? 1 : -1;
    const advance = !cancelled && drag.horizontal && canTurn(direction) && (Math.abs(delta) >= 48 || (Math.abs(delta) >= 12 && Math.abs(velocity) > .35));
    if (track.current) {
      const remaining = Math.abs((advance ? -direction * drag.width : 0) - offset.current);
      const duration = Math.max(160, Math.min(340, remaining / (.65 + Math.abs(velocity))));
      track.current.style.transitionDuration = matchMedia('(prefers-reduced-motion: reduce)').matches ? '0ms' : `${duration}ms`;
    }
    reset();
    if (advance) turnPage(direction);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return {
    onPointerDown(event: PointerEvent<HTMLDivElement>) {
      suppressClick.current = false;
      if (!enabled || !event.isPrimary || event.pointerType === 'mouse') return;
      const width = event.currentTarget.clientWidth;
      const matrix = track.current ? new DOMMatrixReadOnly(getComputedStyle(track.current).transform) : null;
      const initialOffset = matrix ? matrix.m41 + page * width : 0;
      gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, width, initialOffset, lastX:event.clientX, time:event.timeStamp, velocity:0, horizontal: false };
      // Catch an in-flight transition at its visible position, not its target page.
      if (track.current && Math.abs(initialOffset) > 1) {
        track.current.classList.add('is-dragging');
        track.current.style.transform = `translate3d(${matrix!.m41}px,0,0)`;
      }
    },
    onPointerMove(event: PointerEvent<HTMLDivElement>) {
      const drag = gesture.current;
      if (!drag || drag.id !== event.pointerId) return;
      const x = Math.abs(event.clientX - drag.x);
      const y = Math.abs(event.clientY - drag.y);
      if (!drag.horizontal) {
        if (Math.max(x, y) < 10) return;
        if (x <= y * 1.2) { gesture.current = null; reset(); return; }
        drag.horizontal = true;
        track.current?.classList.add('is-dragging');
        suppressClick.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      const delta = event.clientX - drag.x;
      const elapsed = event.timeStamp - drag.time;
      if (elapsed > 0) drag.velocity = (event.clientX - drag.lastX) / elapsed;
      drag.lastX = event.clientX; drag.time = event.timeStamp;
      const position = drag.initialOffset + delta;
      offset.current = canTurn(position < 0 ? 1 : -1) ? Math.max(-drag.width, Math.min(drag.width, position)) : position * .18;
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
