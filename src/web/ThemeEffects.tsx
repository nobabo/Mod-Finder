import { useEffect, useRef, type CSSProperties } from 'react';
import { themeById } from './lib/themes';
import './theme-effects.css';

export function ThemeEffects({ theme, enabled = true }: { theme: string; enabled?: boolean }) {
  const layer = useRef<HTMLDivElement>(null);
  const effect = themeById(theme).effect;
  useEffect(() => {
    const sync = () => { if (layer.current) layer.current.dataset.paused = String(document.hidden); };
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, [effect, enabled]);
  if (!enabled || effect === 'none') return null;

  // Stable, staggered positions avoid a fresh burst on every React render.
  const particles = (kind: string, count: number) => Array.from({ length: count }, (_, i) => {
    const seed = (i * 37 + 11) % 101;
    return <span key={`${kind}-${i}`} className={`theme-particle ${kind}`} style={{
      '--x': `${(i * 61.8 + 7) % 100}%`,
      '--phase': -(i * 1.73 + .4),
      '--speed': .75 + seed / 180,
      '--size': .65 + seed / 125,
      '--drift': `${(seed - 50) * 2}px`,
      '--turn': `${seed * 3.6}deg`,
    } as CSSProperties}>
      {kind === 'petal' && <svg viewBox="0 0 20 24" focusable="false"><path d="M10 23C1 18-3 8 3 2Q6-1 10 4Q14-1 17 2C23 8 19 18 10 23Z" fill="currentColor"/><path d="M10 22Q7 12 10 5" fill="none" stroke="white" strokeOpacity=".3" strokeWidth=".6"/></svg>}
      {kind === 'bamboo' && <svg viewBox="0 0 180 600" preserveAspectRatio="none" focusable="false">
        <g className="bamboo-stem" fill="none" stroke="currentColor" strokeLinecap="round">
          <path d="M88 610Q94 480 89 390T92 190Q95 100 91 30" strokeWidth="5"/>
          <path d="M83 508L95 508M83 408L95 408M84 310L96 310M85 211L97 211M86 112L98 112" strokeWidth="3"/>
          <path d="M87 600L87 510M88 499L87 412M87 399L89 314M90 299L90 215M91 200L92 116M92 101L91 35" strokeWidth="1" stroke="white" strokeOpacity=".4"/>
        </g>
        {[408,310,211,112].map((y, node) => <g key={y} transform={`translate(91 ${y}) scale(${node % 2 ? -1 : 1} 1)`}>
          <g className={`bamboo-leaves ${node > 1 ? 'is-upper' : ''}`} fill="currentColor">
            <path d="M0 0Q27-22 65-34M0 0Q-19-14-42-17" fill="none" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M12-9Q5-31 15-54Q24-29 12-9ZM25-19Q33-44 53-54Q47-30 25-19ZM41-27Q65-46 83-42Q70-27 41-27ZM23-18Q48-19 58 1Q32-2 23-18ZM49-30Q69-25 77-10Q57-12 49-30ZM-10-7Q-12-31-28-42Q-31-19-10-7ZM-24-13Q-45-33-64-28Q-52-11-24-13ZM-25-13Q-35 4-52 8Q-47-12-25-13Z"/>
          </g>
        </g>)}
      </svg>}
    </span>;
  });
  return <div ref={layer} className={`theme-effects effect-${effect}`} aria-hidden="true" data-effect={effect}>
    {effect === 'petals' && particles('petal', 30)}
    {effect === 'rain' && particles('raindrop', 48)}
    {effect === 'fire' && <>{particles('flame', 14)}{particles('ember', 20)}</>}
    {effect === 'bamboo' && particles('bamboo', 8)}
  </div>;
}
