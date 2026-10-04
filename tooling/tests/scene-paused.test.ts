import { afterEach, describe, expect, it, vi } from 'vitest';
import { useScenePaused } from '../../src/web/lib/use-scene-paused';

const state = vi.hoisted(() => ({ notify: vi.fn(), cleanup: undefined as undefined | (() => void) }));
vi.mock('react', () => ({
  useState: () => [false, state.notify],
  useLayoutEffect: (effect: () => (() => void)) => { state.cleanup = effect(); },
}));
afterEach(() => { state.cleanup?.(); state.notify.mockClear(); vi.unstubAllGlobals(); });

function setup() {
  let dialogs = 0;
  let changed = () => {};
  const events = new Map<string, () => void>();
  const disconnect = vi.fn();
  const doc = { hidden: false, body: {}, querySelector: () => dialogs ? {} : null,
    addEventListener: (name: string, fn: () => void) => events.set(name, fn),
    removeEventListener: (name: string) => events.delete(name),
  };
  vi.stubGlobal('document', doc);
  vi.stubGlobal('MutationObserver', class {
    constructor(callback: () => void) { changed = callback; }
    observe() {}
    disconnect = disconnect;
  });
  useScenePaused();
  return { doc, events, disconnect, setDialogs(count: number) { dialogs = count; changed(); } };
}

describe('background pause policy', () => {
  it('stays paused until the last nested or portaled dialog closes', () => {
    const s = setup();
    expect(state.notify).toHaveBeenLastCalledWith(false);
    s.setDialogs(2); expect(state.notify).toHaveBeenLastCalledWith(true);
    s.setDialogs(1); expect(state.notify).toHaveBeenLastCalledWith(true);
    s.setDialogs(0); expect(state.notify).toHaveBeenLastCalledWith(false);
  });
  it('does not resume behind a dialog when the tab becomes visible', () => {
    const s = setup();
    s.setDialogs(1);
    s.doc.hidden = true; s.events.get('visibilitychange')!();
    s.doc.hidden = false; s.events.get('visibilitychange')!();
    expect(state.notify).toHaveBeenLastCalledWith(true);
    s.setDialogs(0); expect(state.notify).toHaveBeenLastCalledWith(false);
  });
  it('disconnects observers and visibility listeners on unmount', () => {
    const s = setup();
    state.cleanup!(); state.cleanup = undefined;
    expect(s.disconnect).toHaveBeenCalledOnce();
    expect(s.events.size).toBe(0);
  });
});
