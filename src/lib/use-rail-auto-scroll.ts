import { useEffect, useRef, type RefObject } from 'react';
import { advanceVelocity, edgeIntent } from './deck-motion';

export function useRailAutoScroll(rail:RefObject<HTMLDivElement | null>, gesture:RefObject<unknown>, enabled = true, blocked?:RefObject<boolean>) {
  const speed = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    let pointer:number | null = null; let frame=0; let last=0; let held=0; let direction=0; let remainder=0;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const move=(event:PointerEvent) => { if(event.pointerType==='mouse') pointer=event.clientX; };
    const stop=() => { pointer=null; speed.current=0; held=0; remainder=0; last=0; };
    const leave=(event:PointerEvent) => { if(!event.relatedTarget) stop(); };
    const visibility=() => { if(document.hidden) stop(); };
    const animate=(now:number) => {
      const dt=last?Math.min((now-last)/1000,.05):0;last=now;
      const el=rail.current;
      if(el){
        const intent=pointer===null || document.hidden || gesture.current || blocked?.current ? 0 : edgeIntent(pointer,innerWidth);
        const nextDirection=Math.sign(intent);
        held=nextDirection && nextDirection===direction ? held+dt : 0;direction=nextDirection;
        if(gesture.current || blocked?.current){speed.current=0;remainder=0;}
        else speed.current=advanceVelocity(speed.current,reduced.matches?intent*.3:intent,dt,held);
        const max=Math.max(0,el.scrollWidth-el.clientWidth);
        // Browser scroll offsets can round each tiny frame to zero. Preserve the
        // fraction so a gentle start still moves, including near an edge zone.
        const target=Math.max(0,Math.min(max,el.scrollLeft+remainder+speed.current*dt));
        if(Math.abs(speed.current)>.01){
          el.scrollLeft=target;
          remainder=target===0 || target===max ? 0 : target-el.scrollLeft;
        }
      }
      frame=requestAnimationFrame(animate);
    };
    window.addEventListener('pointermove',move,{capture:true,passive:true});
    window.addEventListener('pointerup',move,{capture:true,passive:true});
    window.addEventListener('blur',stop);document.addEventListener('pointerout',leave);
    document.addEventListener('visibilitychange',visibility);
    frame=requestAnimationFrame(animate);
    return()=>{cancelAnimationFrame(frame);speed.current=0;window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',move,true);window.removeEventListener('blur',stop);document.removeEventListener('pointerout',leave);document.removeEventListener('visibilitychange',visibility);};
  },[enabled,rail,gesture,blocked]);
  return speed;
}
