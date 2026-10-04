import { useEffect, useRef } from 'react';
import { themeById } from './lib/themes';

/** One transparent layer and one cached sprite instead of 30 animated SVG trees. */
export function PetalCanvas({ theme, paused }: { theme: string; paused: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const elapsed = useRef(0);
  useEffect(() => {
    const surface = canvas.current!;
    const context = surface.getContext('2d');
    if (!context) return;
    const sprite = document.createElement('canvas'); sprite.width = 40; sprite.height = 48;
    const brush = sprite.getContext('2d')!;
    brush.scale(2, 2);
    const rgb = themeById(theme).rgb.map((c, i) => Math.round(c * .32 + [255,225,238][i] * .68));
    brush.fillStyle = `rgb(${rgb.join(',')})`;
    brush.fill(new Path2D('M10 23C1 18-3 8 3 2Q6-1 10 4Q14-1 17 2C23 8 19 18 10 23Z'));
    brush.strokeStyle = '#ffffff4d'; brush.lineWidth = .6;
    brush.stroke(new Path2D('M10 22Q7 12 10 5'));
    let width = 0, height = 0, ratio = 1, frame = 0, last = 0;
    const paint = () => {
      context.setTransform(ratio,0,0,ratio,0,0); context.clearRect(0,0,width,height);
      const step = width <= 650 ? 2 : 1;
      for (let i = 0; i < 30; i += step) {
        const seed = (i * 37 + 11) % 101;
        const progress = ((elapsed.current + (i * 1.73 + .4) * 1000) / (22000 * (.75 + seed / 180))) % 1;
        const size = .65 + seed / 125;
        const x = ((i * 61.8 + 7) % 100) / 100 * width + Math.sin(progress * Math.PI * 3 + i) * 35;
        const y = -30 + progress * (height + 80);
        const opacity = Math.min(progress / .12, 1, (1 - progress) / .2) * .28;
        context.save(); context.translate(x,y); context.rotate((seed * 3.6 + progress * 330) * Math.PI / 180);
        context.scale(Math.cos(progress * Math.PI * 2),1); context.globalAlpha = opacity;
        context.drawImage(sprite,-6.5 * size,-8.5 * size,13 * size,17 * size); context.restore();
      }
    };
    const resize = () => {
      width = innerWidth; height = innerHeight; ratio = Math.min(devicePixelRatio || 1,1.5);
      surface.width = Math.round(width * ratio); surface.height = Math.round(height * ratio); paint();
    };
    const tick = (now: number) => {
      if (paused || document.hidden) { frame = 0; last = 0; return; }
      if (last) elapsed.current += Math.min(100,now - last);
      last = now; paint(); frame = requestAnimationFrame(tick);
    };
    const visibility = () => {
      cancelAnimationFrame(frame); last = 0;
      if (!paused && !document.hidden) frame = requestAnimationFrame(tick);
    };
    resize(); visibility();
    window.addEventListener('resize',resize); document.addEventListener('visibilitychange',visibility);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize',resize); document.removeEventListener('visibilitychange',visibility); };
  }, [theme, paused]);
  return <canvas ref={canvas} className="petal-canvas" aria-hidden="true" />;
}
