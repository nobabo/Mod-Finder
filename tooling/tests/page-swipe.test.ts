import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PointerEvent } from 'react';
import { usePageSwipe } from '../../src/web/lib/use-page-swipe';

const lifecycle = vi.hoisted(() => ({ cleanups: [] as (() => void)[] }));
vi.mock('react', () => ({
  useRef: (current: unknown) => ({ current }),
  useEffect: (effect: () => (() => void)) => { lifecycle.cleanups.push(effect()); },
}));
afterEach(() => { lifecycle.cleanups.splice(0).forEach(cleanup => cleanup()); vi.unstubAllGlobals(); });

function setup() {
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  vi.stubGlobal('getComputedStyle', () => ({ transform: 'none' }));
  vi.stubGlobal('DOMMatrixReadOnly', class { m41 = 0; });
  const frames = new Map<number, FrameRequestCallback>();
  let next = 0;
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { frames.set(++next, callback); return next; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)));
  const style = { transform: '' };
  const track = { current: { style, classList: { add: vi.fn(), remove: vi.fn() } } as unknown as HTMLDivElement };
  const width = vi.fn(() => 360);
  const target = { get clientWidth() { return width(); }, setPointerCapture: vi.fn(), hasPointerCapture: () => true, releasePointerCapture: vi.fn() };
  const event = (x: number, y = 100) => ({ pointerId: 1, isPrimary: true, pointerType: 'touch', clientX: x, clientY: y, currentTarget: target, preventDefault: vi.fn() }) as unknown as PointerEvent<HTMLDivElement>;
  const turn = vi.fn();
  const handlers = usePageSwipe(true, track, 0, turn, direction => direction > 0);
  return { frames, style, width, event, turn, handlers };
}

describe('swipe frame scheduling', () => {
  it('coalesces move events into one paint with the latest position and one width read', () => {
    const s = setup();
    s.handlers.onPointerDown(s.event(250));
    for (let x = 230; x >= 130; x -= 10) s.handlers.onPointerMove(s.event(x));
    expect(s.frames.size).toBe(1);
    expect(s.width).toHaveBeenCalledTimes(1);
    expect(s.style.transform).toBe('');
    s.frames.values().next().value!(0);
    expect(s.style.transform).toBe('translate3d(calc(0% + -120px),0,0)');
  });
  it('cancels a pending paint when the gesture ends so it cannot overwrite the snap', () => {
    const s = setup();
    s.handlers.onPointerDown(s.event(250));
    s.handlers.onPointerMove(s.event(150));
    s.handlers.onPointerUp(s.event(150));
    expect(s.frames.size).toBe(0);
    expect(s.style.transform).toBe('translate3d(0%,0,0)');
    expect(s.turn).toHaveBeenCalledWith(1);
  });
  it('leaves vertical scrolling alone and never turns a cancelled swipe', () => {
    const s = setup();
    s.handlers.onPointerDown(s.event(250));
    s.handlers.onPointerMove(s.event(245, 160));
    expect(s.frames.size).toBe(0);
    s.handlers.onPointerDown(s.event(250));
    s.handlers.onPointerMove(s.event(150));
    s.handlers.onPointerCancel(s.event(150));
    expect(s.frames.size).toBe(0);
    expect(s.turn).not.toHaveBeenCalled();
  });
  it('continues an interrupted transition from the displayed position', () => {
    const s = setup();
    vi.stubGlobal('DOMMatrixReadOnly', class { m41 = -100; });
    s.handlers.onPointerDown(s.event(250));
    s.handlers.onPointerMove(s.event(270));
    s.frames.values().next().value!(0);
    expect(s.style.transform).toBe('translate3d(calc(0% + -80px),0,0)');
  });
  it('recognizes a short fast flick without requiring a fixed frame count', () => {
    const s = setup();
    s.handlers.onPointerDown({ ...s.event(250), timeStamp: 0 });
    s.handlers.onPointerMove({ ...s.event(225), timeStamp: 20 });
    s.handlers.onPointerUp({ ...s.event(225), timeStamp: 25 });
    expect(s.turn).toHaveBeenCalledWith(1);
  });
});
