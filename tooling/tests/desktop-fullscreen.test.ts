import { describe, expect, it, vi } from 'vitest';
import { createFullscreenController, fullscreenShortcut, type FullscreenPort } from '../../src/web/lib/desktop-fullscreen';

const event = (key: string, extra: Partial<KeyboardEvent> = {}) => ({ key, repeat:false, isComposing:false, keyCode:0, defaultPrevented:false, altKey:false, ctrlKey:false, metaKey:false, shiftKey:false, ...extra });
const context = { fullscreen:true, overlayOpen:false, editing:false };
const port = () => {
  let fullscreen = false;
  return { isFullscreen:vi.fn(async () => fullscreen), setFullscreen:vi.fn(async (value:boolean) => { fullscreen = value; }) };
};

describe('desktop fullscreen shortcuts', () => {
  it('toggles F11 from input controls and overlays, and exits with an unconsumed Escape', () => {
    expect(fullscreenShortcut(event('F11'), { ...context, overlayOpen:true, editing:true })).toBe('toggle');
    expect(fullscreenShortcut(event('Escape'), context)).toBe('exit');
    expect(fullscreenShortcut(event('Escape'), { ...context, fullscreen:false })).toBeNull();
  });
  it('leaves dialogs, search clearing, selection controls, artwork gestures and IME first use of Escape', () => {
    expect(fullscreenShortcut(event('Escape'), { ...context, overlayOpen:true })).toBeNull();
    expect(fullscreenShortcut(event('Escape'), { ...context, editing:true })).toBeNull();
    expect(fullscreenShortcut(event('Escape', { defaultPrevented:true }), context)).toBeNull();
    for (const key of ['Escape','F11']) {
      expect(fullscreenShortcut(event(key, { isComposing:true }), context)).toBeNull();
      expect(fullscreenShortcut(event(key, { keyCode:229 }), context)).toBeNull();
    }
  });
  it('ignores repeats, modified shortcuts and ordinary search/navigation keys', () => {
    for (const key of ['Escape','F11']) for (const extra of [{ repeat:true },{ altKey:true },{ ctrlKey:true },{ metaKey:true },{ shiftKey:true }]) {
      expect(fullscreenShortcut(event(key, extra), context)).toBeNull();
    }
    for (const key of ['Enter','Tab','ArrowLeft','k','F4']) expect(fullscreenShortcut(event(key), context)).toBeNull();
  });
});

describe('native fullscreen controller', () => {
  it('uses native fullscreen on the current window and returns through the same native API', async () => {
    const window = port();
    const controller = createFullscreenController(async () => window);
    await controller.refresh();
    expect(controller.state).toEqual({ fullscreen:false, ready:true, busy:false });
    await controller.change('toggle');
    expect(controller.state.fullscreen).toBe(true);
    await controller.change('exit');
    expect(controller.state.fullscreen).toBe(false);
    expect(window.setFullscreen.mock.calls).toEqual([[true],[false]]);
    // No hard-coded coordinates, monitor selection, decoration changes or
    // maximize/unmaximize calls overwrite Tauri's saved WINDOWPLACEMENT.
  });
  it('reads actual native state before toggling and synchronizes external changes', async () => {
    const window = port();
    const controller = createFullscreenController(async () => window);
    await window.setFullscreen(true);
    await controller.change('toggle');
    expect(controller.state.fullscreen).toBe(false);
    await window.setFullscreen(true);
    await controller.refresh();
    expect(controller.state.fullscreen).toBe(true);
  });
  it('does not enter fullscreen for Escape in a normal window', async () => {
    const window = port();
    const controller = createFullscreenController(async () => window);
    await controller.change('exit');
    expect(window.setFullscreen).not.toHaveBeenCalled();
  });
  it('ignores overlapping requests while a native transition is pending', async () => {
    const window = port();
    let resolve!: () => void;
    const pending = new Promise<void>(done => { resolve = done; });
    const nativeSet = window.setFullscreen;
    const blocked:FullscreenPort = { ...window, setFullscreen:async value => { await pending; await nativeSet(value); } };
    const controller = createFullscreenController(async () => blocked);
    const first = controller.change('toggle');
    expect(controller.state.busy).toBe(true);
    expect(await controller.change('toggle')).toBe(false);
    resolve(); await first;
    expect(window.setFullscreen).toHaveBeenCalledExactlyOnceWith(true);
    expect(controller.state).toEqual({ fullscreen:true, ready:true, busy:false });
  });
  it('releases the busy state after a permission/platform error and allows recovery', async () => {
    const window = port();
    const controller = createFullscreenController(async () => window);
    window.setFullscreen.mockRejectedValueOnce(Error('denied'));
    await expect(controller.change('toggle')).rejects.toThrow('denied');
    expect(controller.state.busy).toBe(false);
    await controller.change('toggle');
    expect(controller.state.fullscreen).toBe(true);
  });
  it('does not claim a transition succeeded if native state did not change', async () => {
    const controller = createFullscreenController(async () => ({ isFullscreen:async () => false, setFullscreen:async () => {} }));
    await expect(controller.change('toggle')).rejects.toThrow('did not change');
    expect(controller.state).toEqual({ fullscreen:false, ready:true, busy:false });
  });
  it('discards an older resize/focus response after a newer transition', async () => {
    const window = port();
    let resolve!: (value:boolean) => void;
    window.isFullscreen.mockImplementationOnce(() => new Promise<boolean>(done => { resolve = done; }));
    const controller = createFullscreenController(async () => window);
    const refresh = controller.refresh();
    await Promise.resolve();
    await controller.change('toggle');
    resolve(false); await refresh;
    expect(controller.state.fullscreen).toBe(true);
  });
});
