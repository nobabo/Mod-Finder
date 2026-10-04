import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGlassRenderer } from '../../src/web/lib/glass-renderer';

let dispose: (() => void) | undefined;
afterEach(() => { dispose?.(); dispose = undefined; vi.unstubAllGlobals(); });

function setup() {
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  const gl = new Proxy<Record<string, any>>({
    FRAMEBUFFER_COMPLETE: 1, COMPILE_STATUS: 2, LINK_STATUS: 3,
    getShaderParameter: () => true, getProgramParameter: () => true,
    checkFramebufferStatus: () => 1, isContextLost: () => false,
    getUniformLocation: (_: unknown, name: string) => name,
    createFramebuffer: () => ({}),
  }, { get(target, name: string) { return target[name] ??= vi.fn(); } });
  let top = 100;
  const panel = { isConnected: true, matches: () => false,
    getBoundingClientRect: vi.fn(() => ({ left: 20, top, width: 200, height: 100, bottom: top + 100 })),
  };
  const canvas = Object.assign(new EventTarget(), {
    width: 0, height: 0, clientWidth: 390, clientHeight: 844, getContext: () => gl,
  });
  const doc = Object.assign(new EventTarget(), {
    hidden: false, body: {}, querySelector: () => null, querySelectorAll: vi.fn(() => [panel]),
  });
  const viewport = new EventTarget();
  const win = Object.assign(new EventTarget(), { visualViewport: viewport });
  vi.stubGlobal('document', doc); vi.stubGlobal('window', win);
  vi.stubGlobal('innerWidth', 390); vi.stubGlobal('innerHeight', 844); vi.stubGlobal('devicePixelRatio', 3);
  vi.stubGlobal('getComputedStyle', () => ({ visibility: 'visible', borderTopLeftRadius: '20px' }));
  vi.stubGlobal('matchMedia', () => Object.assign(new EventTarget(), { matches: false }));
  vi.stubGlobal('MutationObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  const renderer = createGlassRenderer(canvas as unknown as HTMLCanvasElement, vi.fn())!;
  dispose = renderer.dispose;
  const frame = (time: number) => {
    const pending = [...frames.values()]; frames.clear();
    for (const callback of pending) callback(time);
  };
  const uniform = (method: string, name: string) => gl[method].mock.calls.findLast((call: unknown[]) => call[0] === name)?.slice(1);
  return { renderer, gl, canvas, doc, win, viewport, frames, frame, uniform, setTop: (value: number) => { top = value; } };
}

describe('glass scroll stability', () => {
  it('updates scroll geometry at display cadence without rescanning panels or regenerating the scene', () => {
    const s = setup(); s.frame(100);
    const scans = s.doc.querySelectorAll.mock.calls.length;
    const scenePasses = s.gl.bindFramebuffer.mock.calls.length;
    const draws = s.gl.drawArrays.mock.calls.length;
    s.setTop(75);
    for (let i = 0; i < 5; i++) s.win.dispatchEvent(new Event('scroll'));
    expect(s.frames.size).toBe(1);
    s.frame(108); // 120 Hz scroll, well before the next 30 Hz background frame.
    expect(s.uniform('uniform4fv', 'uPanels[0]')[0][1]).toBe(75);
    expect(s.gl.drawArrays.mock.calls.length).toBe(draws + 1);
    expect(s.gl.bindFramebuffer.mock.calls.length).toBe(scenePasses);
    expect(s.doc.querySelectorAll).toHaveBeenCalledTimes(scans);
    s.setTop(40); s.win.dispatchEvent(new Event('scroll')); s.frame(116);
    expect(s.uniform('uniform4fv', 'uPanels[0]')[0][1]).toBe(40);
    expect(s.gl.bindFramebuffer.mock.calls.length).toBe(scenePasses);
    s.frame(140);
    expect(s.gl.bindFramebuffer.mock.calls.length).toBeGreaterThan(scenePasses);
  });

  it('keeps the texture size/crop stable when browser chrome changes innerHeight, and resizes on rotation', () => {
    const s = setup(); s.frame(100);
    const uploads = s.gl.texImage2D.mock.calls.length;
    vi.stubGlobal('innerHeight', 620);
    s.win.dispatchEvent(new Event('resize')); s.viewport.dispatchEvent(new Event('resize')); s.frame(108);
    expect([s.canvas.width, s.canvas.height]).toEqual([585, 1266]);
    expect(s.uniform('uniform2f', 'uSize')).toEqual([390, 844]);
    expect(s.gl.texImage2D).toHaveBeenCalledTimes(uploads);
    s.canvas.clientWidth = 844; s.canvas.clientHeight = 390;
    s.win.dispatchEvent(new Event('resize')); s.frame(116);
    expect([s.canvas.width, s.canvas.height]).toEqual([1266, 585]);
    expect(s.uniform('uniform2f', 'uSize')).toEqual([844, 390]);
    expect(s.gl.texImage2D.mock.calls.length).toBeGreaterThan(uploads);
  });

  it('ignores touch movement for lighting while preserving mouse response', () => {
    const s = setup(); s.frame(100);
    s.win.dispatchEvent(Object.assign(new Event('pointermove'), { pointerType: 'touch', clientX: 390, clientY: 844 }));
    s.frame(140);
    expect(s.uniform('uniform2fv', 'uPointer')).toEqual([[0, 0]]);
    s.win.dispatchEvent(Object.assign(new Event('pointermove'), { pointerType: 'mouse', clientX: 390, clientY: 844 }));
    s.frame(180);
    expect(s.uniform('uniform2fv', 'uPointer')).toEqual([[1, 1]]);
  });

  it('repositions paused lenses without advancing scene time and resumes after visibility changes', () => {
    const s = setup(); s.frame(100); s.frame(140);
    const time = s.uniform('uniform1f', 'uTime');
    const scenePasses = s.gl.bindFramebuffer.mock.calls.length;
    s.renderer.setPaused(true); s.frame(148);
    s.setTop(35); s.win.dispatchEvent(new Event('scroll')); s.frame(156);
    expect(s.uniform('uniform4fv', 'uPanels[0]')[0][1]).toBe(35);
    expect(s.uniform('uniform1f', 'uTime')).toEqual(time);
    expect(s.gl.bindFramebuffer.mock.calls.length).toBe(scenePasses);
    expect(s.frames.size).toBe(0);
    s.renderer.setPaused(false); s.frame(164);
    s.doc.hidden = true; s.doc.dispatchEvent(new Event('visibilitychange'));
    expect(s.frames.size).toBe(0);
    s.doc.hidden = false; s.doc.dispatchEvent(new Event('visibilitychange')); s.frame(5000);
    expect(s.uniform('uniform1f', 'uTime')).toEqual(time);
    expect(s.frames.size).toBe(1);
    s.renderer.dispose(); dispose = undefined;
    s.win.dispatchEvent(new Event('scroll')); s.viewport.dispatchEvent(new Event('resize'));
    expect(s.frames.size).toBe(0);
  });
});
