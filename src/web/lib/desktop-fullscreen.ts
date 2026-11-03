export type FullscreenAction = 'toggle' | 'exit';
export type FullscreenState = { fullscreen: boolean; busy: boolean; ready: boolean };
export type FullscreenPort = { isFullscreen(): Promise<boolean>; setFullscreen(value: boolean): Promise<void> };

type ShortcutEvent = Pick<KeyboardEvent, 'key' | 'repeat' | 'isComposing' | 'keyCode' | 'defaultPrevented' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>;

export function fullscreenShortcut(event: ShortcutEvent, context: { fullscreen: boolean; overlayOpen: boolean; editing: boolean }): FullscreenAction | null {
  if (event.repeat || event.isComposing || event.keyCode === 229 || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  if (event.key === 'F11') return 'toggle';
  if (event.key === 'Escape' && context.fullscreen && !context.overlayOpen && !context.editing) return 'exit';
  return null;
}

// Tauri/Tao owns WINDOWPLACEMENT and current-monitor selection. Do not replace
// it with CSS fullscreen or manually move the window to the primary monitor.
export function createFullscreenController(getWindow: () => Promise<FullscreenPort>) {
  let state: FullscreenState = { fullscreen: false, busy: false, ready: false };
  let generation = 0;
  const listeners = new Set<(state: FullscreenState) => void>();
  const publish = (next: FullscreenState) => { state = next; for (const listener of listeners) listener(state); };
  return {
    get state() { return state; },
    subscribe(listener: (state: FullscreenState) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async refresh() {
      if (state.busy) return;
      const current = ++generation;
      const fullscreen = await (await getWindow()).isFullscreen();
      if (current === generation) publish({ ...state, fullscreen, ready: true });
    },
    async change(action: FullscreenAction) {
      if (state.busy) return false;
      ++generation;
      publish({ ...state, busy: true });
      try {
        const window = await getWindow();
        const before = await window.isFullscreen();
        const desired = action === 'exit' ? false : !before;
        if (before !== desired) await window.setFullscreen(desired);
        const fullscreen = await window.isFullscreen();
        publish({ ...state, fullscreen, ready: true });
        if (fullscreen !== desired) throw new Error('Native window did not change fullscreen state');
        return true;
      } finally { publish({ ...state, busy: false }); }
    },
  };
}
