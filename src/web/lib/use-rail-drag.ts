import { useRef, useState, type PointerEvent, type MouseEvent } from 'react';

/** Horizontal pointer capture keeps touch and mouse gestures identical. */
export function useRailDrag() {
  const gesture = useRef<{ id:number; x:number; scroll:number; moved:boolean } | null>(null);
  const suppressClick = useRef(false);
  const [dragging,setDragging] = useState(false);
  const finish = (event: PointerEvent<HTMLElement>) => {
    if (gesture.current?.id !== event.pointerId) return;
    gesture.current = null; setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return { gesture, dragging, handlers: {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (!event.isPrimary || event.button !== 0) return;
      suppressClick.current = false;
      gesture.current = { id:event.pointerId,x:event.clientX,scroll:event.currentTarget.scrollLeft,moved:false };
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const drag = gesture.current;
      if (!drag || drag.id !== event.pointerId) return;
      const delta = event.clientX - drag.x;
      if (!drag.moved && Math.abs(delta) < 6) return;
      if (!drag.moved) { drag.moved = true; setDragging(true); event.currentTarget.setPointerCapture(event.pointerId); }
      suppressClick.current = true;
      event.preventDefault(); event.currentTarget.scrollLeft = drag.scroll - delta;
    },
    onPointerUp:finish, onPointerCancel:finish,
    onLostPointerCapture(event: PointerEvent<HTMLElement>) {
      // Touch begins with implicit capture on the pressed card. Its bubbled
      // release during transfer to the rail must not cancel the active drag.
      if (event.target === event.currentTarget) { gesture.current = null; setDragging(false); }
    },
    onPointerLeave(event: PointerEvent<HTMLElement>) { if (!event.currentTarget.hasPointerCapture(event.pointerId)) finish(event); },
    onClickCapture(event: MouseEvent<HTMLElement>) { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } },
  } };
}
