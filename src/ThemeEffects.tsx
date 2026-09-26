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
    </span>;
  });
  return <div ref={layer} className={`theme-effects effect-${effect}`} aria-hidden="true" data-effect={effect}>
    {effect === 'petals' && particles('petal', 30)}
    {effect === 'rain' && particles('raindrop', 48)}
    {effect === 'fire' && <>{particles('flame', 14)}{particles('ember', 20)}</>}
    {effect === 'moonlight' && <>{particles('moonbeam', 6)}{particles('moondust', 22)}</>}
  </div>;
}
