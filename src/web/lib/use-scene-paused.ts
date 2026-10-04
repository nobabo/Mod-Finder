import { useLayoutEffect, useState } from 'react';

// Includes portals and dialogs owned by child components (folders, details, etc.).
export function useScenePaused() {
  const [paused, setPaused] = useState(false);
  useLayoutEffect(() => {
    const sync = () => setPaused(document.hidden || !!document.querySelector('[role="dialog"][aria-modal="true"]:not([hidden])'));
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['role', 'aria-modal', 'hidden'] });
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', sync); };
  }, []);
  return paused;
}
