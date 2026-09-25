import { useEffect, useId, useRef, useState } from 'react';

export function ResultPanelOutline() {
  const ref = useRef<SVGSVGElement>(null);
  const gradient = useId();
  const [path, setPath] = useState('');
  useEffect(() => {
    const panel = ref.current?.parentElement;
    const search = panel?.querySelector<HTMLElement>('.search-dock');
    if (!panel || !search) return;
    const update = () => {
      const box = panel.getBoundingClientRect(), dock = search.getBoundingClientRect();
      const w = box.width, h = box.height - 20, r = Math.min(40, w / 16);
      const left = Math.max(r + 3, dock.left - box.left - 64);
      const right = Math.min(w - r - 3, dock.right - box.left + 64);
      const depth = dock.bottom - box.top + 12;
      const bend = Math.min(56, (right - left) / 6, Math.max(8, left - r), Math.max(8, w - r - right));
      setPath(`M ${r} 1 H ${left - bend} C ${left + bend * .25} 1 ${left - bend * .25} ${depth} ${left + bend} ${depth} H ${right - bend} C ${right + bend * .25} ${depth} ${right - bend * .25} 1 ${right + bend} 1 H ${w-r} Q ${w-1} 1 ${w-1} ${r} V ${h-r} Q ${w-1} ${h-1} ${w-r} ${h-1} H ${r} Q 1 ${h-1} 1 ${h-r} V ${r} Q 1 1 ${r} 1 Z`);
    };
    const observer = new ResizeObserver(update);
    observer.observe(panel); observer.observe(search); update();
    return () => observer.disconnect();
  }, []);
  return <svg ref={ref} className="result-panel-outline" aria-hidden="true"><defs><linearGradient id={gradient} x2="1" y2="1"><stop stopColor="var(--accent)"/><stop offset="1" stopColor="var(--cyan)"/></linearGradient></defs><path transform="translate(0 20)" d={path} fill="rgba(8,12,24,.24)" stroke={`url(#${gradient})`} strokeWidth="1.5"/></svg>;
}

