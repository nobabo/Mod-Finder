import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGlassRenderer } from '../../src/web/lib/glass-renderer';

let dispose: (() => void) | undefined;
afterEach(() => { dispose?.(); dispose = undefined; vi.unstubAllGlobals(); });

function setup() {
  let mutation: MutationCallback | undefined;
  let intersection: IntersectionObserverCallback | undefined;
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
  vi.stubGlobal('MutationObserver', class { constructor(callback: MutationCallback) { mutation = callback; } observe() {} disconnect() {} });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('IntersectionObserver', class { constructor(callback: IntersectionObserverCallback) { intersection = callback; } observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  const renderer = createGlassRenderer(canvas as unknown as HTMLCanvasElement, vi.fn())!;
  dispose = renderer.dispose;
  const frame = (time: number) => {
    const pending = [...frames.values()]; frames.clear();
    for (const callback of pending) callback(time);
  };
  const uniform = (method: string, name: string) => gl[method].mock.calls.findLast((call: unknown[]) => call[0] === name)?.slice(1);
  const intersect = (target: unknown, isIntersecting: boolean) => intersection?.([{ target, isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver);
  return { renderer, gl, canvas, doc, win, viewport, frames, frame, uniform, intersect, setTop: (value: number) => { top = value; }, mutate: (added: Element[], removed: Element[]) => mutation?.([{ addedNodes: added, removedNodes: removed } as unknown as MutationRecord], {} as MutationObserver) };
}

describe('glass scroll stability', () => {
  it('uses the pastel photograph inside the same refraction renderer and falls back to the default palette', () => {
    const s = setup();
    s.renderer.setAppearance({ canvas: '#c6ddcf', primary: '#397455', secondary: '#7a6546', photoOpacity: .18 });
    s.frame(100);
    expect(s.uniform('uniform1f', 'uLightScene')).toEqual([1]);
    expect(s.uniform('uniform1f', 'uPhotoOpacity')).toEqual([.18]);
    expect(s.uniform('uniform3fv', 'uCanvas')).toEqual([[198 / 255, 221 / 255, 207 / 255]]);
    expect(s.uniform('uniform3fv', 'uColorA')).toEqual([[57 / 255, 116 / 255, 85 / 255]]);
    s.renderer.setAppearance(undefined);
    s.renderer.setTheme('crimson');
    s.frame(140);
    expect(s.uniform('uniform1f', 'uLightScene')).toEqual([0]);
    expect(s.uniform('uniform1f', 'uCanvasScene')).toEqual([0]);
    expect(s.uniform('uniform3fv', 'uColorA')).toEqual([[120 / 255, 136 / 255, 148 / 255]]);
  });

  it('uses the chosen dark canvas without applying the original aurora or light glass treatment', () => {
    const s = setup();
    s.renderer.setAppearance({ canvas: '#101820', primary: '#ef3e55', secondary: '#ff8145', photoOpacity: .18, light: false });
    s.frame(100);
    expect(s.uniform('uniform1f', 'uCanvasScene')).toEqual([1]);
    expect(s.uniform('uniform1f', 'uLightScene')).toEqual([0]);
    expect(s.uniform('uniform3fv', 'uCanvas')).toEqual([[16 / 255, 24 / 255, 32 / 255]]);
  });

  it('sends RGBA opacity to blend the photograph and selected color', () => {
    const s = setup();
    s.renderer.setAppearance({canvas:'#ffffff',alpha:.5,primary:'#92b3a2',secondary:'#b6aa99',photoOpacity:.18,light:false});
    s.frame(100);
    expect(s.uniform('uniform1f','uCanvasAlpha')).toEqual([.5]);
    s.renderer.setAppearance({canvas:'#ffffff',alpha:0,primary:'#92b3a2',secondary:'#b6aa99',photoOpacity:.18,light:false}); s.frame(120);
    expect(s.uniform('uniform1f','uCanvasAlpha')).toEqual([0]);
    s.renderer.setAppearance(undefined); s.frame(140);
    expect(s.uniform('uniform1f','uCanvasAlpha')).toEqual([1]);
  });

  it('restores background panels after removing a filter menu with no glass children', () => {
    const s = setup(); s.frame(100);
    class MenuElement { matches(selector: string) { return selector.includes('.game-deck'); } querySelector() { return null; } querySelectorAll() { return []; } }
    vi.stubGlobal('Element', MenuElement);
    const menu = new MenuElement();
    let open = true;
    s.doc.querySelector = () => open ? menu as never : null;
    s.mutate([menu as unknown as Element], []); s.frame(110);
    expect(s.uniform('uniform1i', 'uCount')).toEqual([0]);
    open = false;
    s.mutate([], [menu as unknown as Element]); s.frame(120);
    expect(s.uniform('uniform1i', 'uCount')).toEqual([1]);
  });
  it('updates scroll geometry at display cadence without rescanning panels or regenerating the scene', () => {
    const s = setup(); s.frame(100);
    const scans = s.doc.querySelectorAll.mock.calls.length;
    const scenePasses = s.gl.bindFramebuffer.mock.calls.length;
    const draws = s.gl.drawArrays.mock.calls.length;
    s.setTop(75);
    for (let i = 0; i < 5; i++) s.win.dispatchEvent(new Event('scroll'));
    expect(s.frames.size).toBe(1);
    s.frame(108); // Scroll responds at 120 Hz without starting a background clock.
    expect(s.uniform('uniform4fv', 'uPanels[0]')[0][1]).toBe(75);
    expect(s.gl.drawArrays.mock.calls.length).toBe(draws + 1);
    expect(s.gl.bindFramebuffer.mock.calls.length).toBe(scenePasses);
    expect(s.doc.querySelectorAll).toHaveBeenCalledTimes(scans);
    s.setTop(40); s.win.dispatchEvent(new Event('scroll')); s.frame(116);
    expect(s.uniform('uniform4fv', 'uPanels[0]')[0][1]).toBe(40);
    expect(s.gl.bindFramebuffer.mock.calls.length).toBe(scenePasses);
    s.frame(140);
    expect(s.gl.bindFramebuffer.mock.calls.length).toBe(scenePasses);
    expect(s.frames.size).toBe(0);
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
    expect(s.frames.size).toBe(0);
    s.renderer.dispose(); dispose = undefined;
    s.win.dispatchEvent(new Event('scroll')); s.viewport.dispatchEvent(new Event('resize'));
    expect(s.frames.size).toBe(0);
  });
});

function controlsSetup(positions: number[], failAtlas = false) {
  const s = setup();
  const visibleCount = positions.filter(left => left + 100 > 0 && left < 390).length;
  const controls = positions.map(left => ({
    isConnected: true, firstChild: null,
    rect: { left, top: 100, width: 100, height: 80, bottom: 180 },
    matches: (selector: string) => selector.includes('.deck-card'),
    insertBefore: vi.fn(),
    getBoundingClientRect() { return { ...this.rect }; },
  }));
  const surfaces: { width: number; height: number; className: string; context: { drawImage: ReturnType<typeof vi.fn> }; remove: ReturnType<typeof vi.fn> }[] = [];
  Object.assign(s.doc, {
    querySelectorAll: vi.fn(() => controls),
    createElement: () => {
      const context = { drawImage: vi.fn() };
      const unavailable = failAtlas && surfaces.length === visibleCount;
      const surface = { width: 300, height: 150, className: '', context, remove: vi.fn(), setAttribute: vi.fn(),
        getContext: () => unavailable ? null : context,
      };
      surfaces.push(surface);
      return surface;
    },
  });
  const gpuCopies = () => surfaces.flatMap(surface => surface.context.drawImage.mock.calls).filter(call => call[0] === s.canvas);
  return { ...s, controls, surfaces, gpuCopies };
}

describe('glass card rendering budget', () => {
  it('sleeps while idle, animates photo transitions, and sleeps again after the final photo', () => {
    const s = controlsSetup([10, 130, 250]);
    const photo = { naturalWidth: 800, naturalHeight: 600 } as HTMLImageElement;
    s.renderer.setPhoto(photo); s.frame(100);
    const draws = s.gl.drawArrays.mock.calls.length;
    expect(s.frames.size).toBe(0);
    s.frame(1000);
    expect(s.gl.drawArrays).toHaveBeenCalledTimes(draws);
    s.renderer.setPhoto(photo); s.frame(2000);
    expect(s.frames.size).toBe(1);
    s.frame(2008);
    expect(s.uniform('uniform1f', 'uMix')![0]).toBeGreaterThan(0);
    for (let time = 2100; time <= 4700; time += 100) s.frame(time);
    expect(s.frames.size).toBe(0);
    const finished = s.gl.drawArrays.mock.calls.length;
    s.frame(10000);
    expect(s.gl.drawArrays).toHaveBeenCalledTimes(finished);
    s.renderer.setBackgroundOffset(3, 2); s.frame(10008);
    expect(s.gl.drawArrays.mock.calls.length).toBeGreaterThan(finished);
    expect(s.frames.size).toBe(0);
  });

  it('renders only visible cards and takes one GPU snapshot for the whole batch', () => {
    const s = controlsSetup([-120, 10, 130, 250, ...Array.from({ length: 60 }, (_, i) => 450 + i * 120)]);
    s.frame(100);
    const lenses = s.surfaces.filter(surface => surface.className === 'glass-control-surface');
    expect(lenses).toHaveLength(3);
    expect(s.gl.drawArrays).toHaveBeenCalledTimes(5); // Scene, three lenses, background.
    expect(s.gpuCopies()).toHaveLength(1);
    const atlas = s.surfaces.find(surface => !surface.className)!;
    expect([atlas.width, atlas.height]).toEqual([512, 128]);
    expect(s.gpuCopies()[0].slice(1)).toEqual([0, 0, 450, 120, 0, 0, 450, 120]);
    expect(lenses.map(lens => lens.context.drawImage.mock.calls[0].slice(1, 5))).toEqual([[0, 0, 150, 120], [150, 0, 150, 120], [300, 0, 150, 120]]);
    expect(lenses.every(lens => lens.context.drawImage.mock.calls[0][0] === atlas)).toBe(true);
    for (const control of s.controls.slice(1, 4)) control.rect.width++;
    s.win.dispatchEvent(new Event('scroll')); s.frame(140);
    expect([atlas.width, atlas.height]).toEqual([512, 128]);
    expect(s.surfaces.filter(surface => !surface.className)).toHaveLength(1);
  });

  it('releases scrolled-away pixels, redraws re-entering cards, and skips unchanged paused geometry', () => {
    const s = controlsSetup([10, 130, 250]);
    s.renderer.setPaused(true); s.frame(100);
    const lens = s.surfaces[0];
    const before = s.gpuCopies().length;
    s.win.dispatchEvent(new Event('scroll')); s.frame(108);
    expect(s.gpuCopies()).toHaveLength(before);
    s.controls[0].rect.left = -120;
    s.win.dispatchEvent(new Event('scroll')); s.frame(116);
    expect([lens.width, lens.height]).toEqual([0, 0]);
    expect(s.gpuCopies()).toHaveLength(before);
    s.controls[0].rect.left = 10;
    s.win.dispatchEvent(new Event('scroll')); s.frame(124);
    expect([lens.width, lens.height]).toEqual([150, 120]);
    expect(s.gpuCopies()).toHaveLength(before + 1);
    expect(lens.context.drawImage).toHaveBeenCalledTimes(2);
    expect(s.frames.size).toBe(0);
    s.renderer.dispose(); dispose = undefined;
    expect(s.surfaces.find(surface => !surface.className)!.width).toBe(0);
    expect(lens.remove).toHaveBeenCalledOnce();
  });

  it('continues drawing individual lenses if the shared 2D atlas is unavailable', () => {
    const s = controlsSetup([10, 130, 250], true);
    s.frame(100);
    expect(s.gpuCopies()).toHaveLength(3);
    expect(s.surfaces.filter(surface => surface.className).every(surface => surface.context.drawImage.mock.calls[0][0] === s.canvas)).toBe(true);
  });

  it('refreshes scrolling glass at display cadence and sleeps when geometry stops changing', () => {
    const s = controlsSetup([10, 130, 250]);
    s.renderer.setPaused(true); s.frame(100);
    for (const time of [108, 116, 124]) {
      s.controls[0].rect.left++;
      s.win.dispatchEvent(new Event('scroll')); s.frame(time);
      expect(s.gpuCopies()).toHaveLength(1 + (time - 100) / 8);
      expect(s.frames.size).toBe(0);
    }
    s.frame(140);
    expect(s.gpuCopies()).toHaveLength(4);
    expect(s.gl.uniform4f.mock.calls).toContainEqual(['uView', 13, 100, 100, 80]);
    expect(s.frames.size).toBe(0);
    // Appearance updates also render on the next display frame.
    s.renderer.setAppearance({ canvas: '#101820', primary: '#ef3e55', secondary: '#ff8145', photoOpacity: .18 });
    s.frame(148);
    expect(s.gpuCopies()).toHaveLength(5);
  });

  it('paints cards entering through CSS transforms and releases cards clipped by an ancestor', () => {
    const s = controlsSetup([10, 450]);
    s.renderer.setPaused(true); s.frame(100);
    expect(s.surfaces).toHaveLength(1);
    s.controls[1].rect.left = 250;
    s.intersect(s.controls[1], true); s.frame(108);
    expect(s.surfaces).toHaveLength(2);
    expect(s.surfaces[1].context.drawImage).toHaveBeenCalledOnce();
    // Its bounding box still intersects the viewport, but a rail clips it out.
    s.intersect(s.controls[1], false); s.frame(116);
    expect([s.surfaces[1].width, s.surfaces[1].height]).toEqual([0, 0]);
    expect(s.frames.size).toBe(0);
  });
});
