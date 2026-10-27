import { useEffect, useState } from 'react';
import backgrounds from '../shared/data/game-theme-backgrounds.json';
import { useScenePaused } from './lib/use-scene-paused';

export function GameBackdrop({ gameId }: { gameId: string }) {
  const photos = backgrounds[gameId as keyof typeof backgrounds] ?? [];
  const [index, setIndex] = useState(0);
  const paused = useScenePaused();
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(media.matches);
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  useEffect(() => {
    if (paused || reduced || photos.length < 2) return;
    const timer = setInterval(() => {
      if (!document.hidden && !matchMedia('(prefers-reduced-motion: reduce)').matches) setIndex(value => (value + 1) % photos.length);
    }, 20000);
    return () => clearInterval(timer);
  }, [paused, reduced, photos.length]);
  return <div className="atmosphere game-atmosphere" aria-hidden="true">
    {photos.map((photo, position) => <img key={photo.src} className={`game-backdrop-photo ${position === index ? 'is-active' : ''}`} src={photo.src} width={photo.width} height={photo.height} alt="" decoding="async" />)}
  </div>;
}
