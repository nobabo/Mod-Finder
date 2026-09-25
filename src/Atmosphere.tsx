import { useEffect, useMemo, useRef, useState } from 'react';
import { backgroundPlaylist } from '../shared/backgrounds';
import { createGlassRenderer } from './lib/glass-renderer';

export function Atmosphere({ gameIds, theme }: { gameIds: string[]; theme: string }) {
  const scope = gameIds.join('|');
  const photos = useMemo(() => backgroundPlaylist(gameIds), [scope]);
  const [position, setPosition] = useState({ scope, index: 0 });
  const index = position.scope === scope ? position.index % Math.max(1, photos.length) : 0;
  const photo = photos[index];
  const [current, setCurrent] = useState(photo);
  const [previous, setPrevious] = useState<typeof photo>();
  const [fading, setFading] = useState(false);
  const loadedScope = useRef(scope);
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [ready, setReady] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<ReturnType<typeof createGlassRenderer>>(null);
  const themeRef = useRef(theme); themeRef.current = theme;
  useEffect(() => {
    const element = canvas.current!;
    const engine = createGlassRenderer(element, () => setReady(false));
    renderer.current = engine;
    engine?.setTheme(themeRef.current);
    const restore = () => setEpoch(value => value + 1);
    element.addEventListener('webglcontextrestored', restore);
    return () => { element.removeEventListener('webglcontextrestored', restore); engine?.dispose(); renderer.current = null; };
  }, [epoch]);
  useEffect(() => { renderer.current?.setTheme(theme); }, [theme, epoch]);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    if (!photo) return;
    let active = true;
    const image = new Image(); image.decoding = 'async'; image.src = photo.src;
    void image.decode().then(() => {
      if (!active) return;
      const immediate = loadedScope.current !== scope;
      loadedScope.current = scope;
      try { setReady(renderer.current?.setPhoto(image,immediate) === true); } catch { setReady(false); }
      setPrevious(immediate || reduced ? undefined : current);
      setFading(!immediate && !reduced);
      setCurrent(photo);
    }).catch(() => { /* Preserve the last decoded photo if an asset is unavailable. */ });
    return () => { active = false; };
  }, [photo?.src, scope, epoch, reduced]);
  useEffect(() => {
    const next = photos[(index + 1) % photos.length];
    if (!next) return;
    const image = new Image(); image.src = next.src;
    void image.decode().catch(() => {});
  }, [photo?.src]);
  useEffect(() => {
    if (reduced || photos.length < 2) return;
    const timer = setInterval(() => {
      if (!document.hidden) setPosition(previous => ({ scope, index: previous.scope === scope ? (previous.index + 1) % photos.length : 1 }));
    }, 20000);
    return () => clearInterval(timer);
  }, [scope, photos.length, reduced]);
  useEffect(() => { document.documentElement.dataset.glass = ready ? 'webgl' : 'fallback'; }, [ready]);
  return <div className={`atmosphere ${ready ? 'is-ready' : ''}`} aria-hidden="true">
    {previous && <div className="atmosphere-fallback" style={{ backgroundImage:`url("${previous.src}")` }} />}
    <div key={current?.src} className={`atmosphere-fallback ${fading ? 'is-crossfading' : ''}`} onAnimationEnd={() => { setPrevious(undefined); setFading(false); }} style={{ backgroundImage: current ? `url("${current.src}")` : undefined }} />
    <div className="aurora-fallback" />
    <canvas ref={canvas} className="atmosphere-canvas" />
    <div className="atmosphere-grain" />
  </div>;
}
