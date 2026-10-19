import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMobileLayout as useHeaderLayout } from '../../src/web/lib/mobile-layout';
import { useMobileLayout as usePickerLayout } from '../../src/web/lib/use-mobile-layout';

const lifecycle = vi.hoisted(() => ({ update: vi.fn(), cleanup: undefined as undefined | (() => void) }));
vi.mock('react', () => ({
  useState: (initial: () => boolean) => [initial(), lifecycle.update],
  useEffect: (effect: () => void | (() => void)) => { lifecycle.cleanup = effect() || undefined; },
}));
afterEach(() => { lifecycle.cleanup?.(); lifecycle.cleanup = undefined; lifecycle.update.mockClear(); vi.unstubAllGlobals(); });

function setup(native: boolean, matches: boolean) {
  let change = () => {};
  const media = {
    matches,
    addEventListener: vi.fn((_event: string, listener: () => void) => { change = listener; }),
    removeEventListener: vi.fn(),
  };
  const matchMedia = vi.fn(() => media);
  vi.stubGlobal('window', { matchMedia, ...(native ? { __TAURI_INTERNALS__: {} } : {}) });
  return { media, matchMedia, resize: (matches: boolean) => { media.matches = matches; change(); } };
}

describe('native and web responsive layouts', () => {
  it.each([useHeaderLayout, usePickerLayout])('keeps native windows on desktop without a resize listener', hook => {
    const state = setup(true, true);
    expect(hook()).toBe(false);
    expect(state.matchMedia).not.toHaveBeenCalled();
    expect(state.media.addEventListener).not.toHaveBeenCalled();
    expect(lifecycle.update).not.toHaveBeenCalled();
  });

  it.each([
    [useHeaderLayout, '(max-width: 1400px)'],
    [usePickerLayout, '(max-width: 850px)'],
  ] as const)('preserves web breakpoints and resize updates', (hook, query) => {
    const state = setup(false, true);
    expect(hook()).toBe(true);
    expect(state.matchMedia).toHaveBeenCalledWith(query);
    state.resize(false);
    expect(lifecycle.update).toHaveBeenLastCalledWith(false);
    state.resize(true);
    expect(lifecycle.update).toHaveBeenLastCalledWith(true);
    lifecycle.cleanup!();
    lifecycle.cleanup = undefined;
    expect(state.media.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });
});
