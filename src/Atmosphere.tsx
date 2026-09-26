import { useEffect, useMemo, useRef, useState } from 'react';
import { backgroundPlaylist } from '../shared/backgrounds';
import { createGlassRenderer } from './lib/glass-renderer';
import { ThemeEffects } from './ThemeEffects';

export function Atmosphere({ gameIds, theme, motionEnabled = true, scrollParallax = false }: { gameIds: string[]; theme: string; motionEnabled?: boolean; scrollParallax?: boolean }) {
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
  const backdrop = useRef<HTMLDivElement>(null);
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
    const element = backdrop.current!;
    let frame = 0;
    let last = 0;
    let x = 0; let y = 0; let pointerX = 0; let pointerY = 0;
    const write = () => {
      element.style.setProperty('--background-x', `${x}px`);
      element.style.setProperty('--background-y', `${y}px`);
      renderer.current?.setBackgroundOffset(x, y);
    };
    write();
    if (reduced || !motionEnabled) return;
    const tick = (now: number) => {
      frame = 0;
      const amount = 1 - Math.exp(-Math.min(now - last, 64) / 140);
      last = now;
      const scroll = scrollParallax ? Math.min(Math.max(0, window.scrollY) * .06, Math.min(24, innerHeight * .025)) : 0;
      const targetY = pointerY - scroll;
      x += (pointerX - x) * amount; y += (targetY - y) * amount;
      if (Math.abs(pointerX - x) + Math.abs(targetY - y) < .02) { x = pointerX; y = targetY; }
      else frame = requestAnimationFrame(tick);
      write();
    };
    const schedule = () => {
      if (!frame && !document.hidden) { last = performance.now(); frame = requestAnimationFrame(tick); }
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      pointerX = Math.max(-1, Math.min(1, event.clientX / innerWidth * 2 - 1)) * 5;
      pointerY = Math.max(-1, Math.min(1, event.clientY / innerHeight * 2 - 1)) * 4;
      schedule();
    };
    const reset = () => { pointerX = 0; pointerY = 0; schedule(); };
    const leave = (event: PointerEvent) => { if (!event.relatedTarget) reset(); };
    const visibility = () => {
      if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
      else reset();
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerout', leave, { passive: true });
    window.addEventListener('blur', reset);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    document.addEventListener('visibilitychange', visibility);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerout', leave);
      window.removeEventListener('blur', reset);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('visibilitychange', visibility);
      x = 0; y = 0; write();
    };
  }, [reduced, motionEnabled, scrollParallax, epoch]);
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
  return <div ref={backdrop} className={`atmosphere ${ready ? 'is-ready' : ''}`} aria-hidden="true">
    {previous && <div className="atmosphere-fallback" style={{ backgroundImage:`url("${previous.src}")` }} />}
    <div key={current?.src} className={`atmosphere-fallback ${fading ? 'is-crossfading' : ''}`} onAnimationEnd={() => { setPrevious(undefined); setFading(false); }} style={{ backgroundImage: current ? `url("${current.src}")` : undefined }} />
    <div className="aurora-fallback" />
    <canvas ref={canvas} className="atmosphere-canvas" />
    <ThemeEffects theme={theme} enabled={!reduced && motionEnabled} />
    <div className="atmosphere-grain" />
  </div>;
}
