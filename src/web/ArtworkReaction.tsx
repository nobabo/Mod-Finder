import { useEffect, useState, type ReactNode } from 'react';

export function ArtworkReaction({ children, className = '' }: { children: ReactNode; className?: string }) {
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => setPlaying(false), 800);
    return () => window.clearTimeout(timer);
  }, [playing]);
  const play = () => {
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) setPlaying(true);
  };
  return <span className={`artwork-reaction ${className}${playing ? ' is-reacting' : ''}`} aria-hidden="true"
    onPointerEnter={event => { if (event.pointerType === 'mouse') play(); }}
    onPointerDown={play}>
    <span className="artwork-ripple" />
    <span className="artwork-motion">{children}</span>
  </span>;
}
