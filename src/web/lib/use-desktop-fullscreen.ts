import { useEffect, useRef, useState } from 'react';
import { createFullscreenController, fullscreenShortcut, type FullscreenState } from './desktop-fullscreen';
import { hasOpenOverlay } from './overlay';
import { isNative } from './platform';

export function useDesktopFullscreen(onError: () => void) {
  const [state, setState] = useState<FullscreenState>({ fullscreen: false, busy: false, ready: false });
  const controller = useRef<ReturnType<typeof createFullscreenController> | null>(null);
  const error = useRef(onError); error.current = onError;
  useEffect(() => {
    if (!isNative()) return;
    let active = true;
    const current = createFullscreenController(async () => (await import('@tauri-apps/api/window')).getCurrentWindow());
    controller.current = current;
    const unsubscribe = current.subscribe(next => { if (active) setState(next); });
    const report = () => { if (active) error.current(); };
    const refresh = () => { void current.refresh().catch(report); };
    const key = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      // Let text controls clear/cancel their own input before Escape exits.
      const editing = !!target?.closest('textarea,select,[contenteditable]:not([contenteditable="false"])')
        || (target instanceof HTMLInputElement && target.value !== '');
      const action = fullscreenShortcut(event, { fullscreen: current.state.fullscreen, overlayOpen: hasOpenOverlay(), editing });
      if (!action) return;
      event.preventDefault(); event.stopImmediatePropagation();
      void current.change(action).catch(report);
    };
    // F11 must precede WebView shortcuts; Escape bubbles after dialogs, IME,
    // search inputs and artwork gestures have had a chance to consume it.
    const f11 = (event: KeyboardEvent) => { if (event.key === 'F11') key(event); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') key(event); };
    window.addEventListener('keydown', f11, true);
    window.addEventListener('keydown', escape);
    window.addEventListener('focus', refresh);
    window.addEventListener('resize', refresh);
    refresh();
    return () => {
      active = false; unsubscribe(); controller.current = null;
      window.removeEventListener('keydown', f11, true);
      window.removeEventListener('keydown', escape);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('resize', refresh);
    };
  }, []);
  return isNative() ? { ...state, toggle: async () => {
    try { return await controller.current?.change('toggle') ?? false; }
    catch { error.current(); return false; }
  } } : undefined;
}
