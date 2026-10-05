import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { navigationUrl, readNavigation, type NavigationState } from './navigation';

interface HistoryEntry { scrollY: number; detail: string | null }
const entry = (): HistoryEntry => {
  const value = window.history.state?.modFinder;
  return {
    scrollY: Number.isFinite(value?.scrollY) ? Math.max(0, value.scrollY) : 0,
    detail: typeof value?.detail === 'string' ? value.detail : null,
  };
};
const historyData = (value: HistoryEntry) => ({ ...window.history.state, modFinder: value });

export function useNavigation() {
  const [state, setState] = useState(() => readNavigation(new URL(location.href)));
  const current = useRef(state);
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [restoration, setRestoration] = useState(0);
  const [transition, setTransition] = useState(0);
  const scrollTarget = useRef<number | null>(entry().scrollY);

  const rememberScroll = useCallback(() => {
    window.history.replaceState(historyData({ ...entry(), scrollY: window.scrollY }), '', location.href);
  }, []);

  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    // Detail payloads stay in memory; never persist provider responses in history.
    window.history.replaceState(historyData({ ...entry(), detail: null }), '', location.href);
    const restore = () => {
      const next = readNavigation(new URL(location.href));
      current.current = next;
      scrollTarget.current = entry().scrollY;
      setState(next);
      setDetailKey(entry().detail);
      setRestoration(value => value + 1);
      setTransition(value => value + 1);
    };
    window.addEventListener('popstate', restore);
    window.addEventListener('pagehide', rememberScroll);
    window.addEventListener('beforeunload', rememberScroll);
    return () => {
      window.history.scrollRestoration = previous;
      window.removeEventListener('popstate', restore);
      window.removeEventListener('pagehide', rememberScroll);
      window.removeEventListener('beforeunload', rememberScroll);
    };
  }, [rememberScroll]);

  useLayoutEffect(() => {
    if (scrollTarget.current === null) return;
    const target = scrollTarget.current;
    let frame = 0;
    let stopped = false;
    const restore = () => {
      if (stopped) return;
      window.scrollTo({ top: target, behavior: 'instant' });
      if (Math.abs(window.scrollY - target) < 2) stop();
    };
    const observer = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(restore); });
    const stop = () => {
      stopped = true;
      scrollTarget.current = null;
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
    observer.observe(document.body);
    frame = requestAnimationFrame(restore);
    const timer = window.setTimeout(stop, 15000);
    // A deliberate user scroll takes priority over pending restoration.
    window.addEventListener('wheel', stop, { passive: true });
    window.addEventListener('touchstart', stop, { passive: true });
    return () => {
      stopped = true; observer.disconnect(); cancelAnimationFrame(frame); clearTimeout(timer);
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchstart', stop);
    };
  }, [transition]);

  const navigate = useCallback((update: Partial<NavigationState> | ((value: NavigationState) => NavigationState), replace = false) => {
    const next = typeof update === 'function' ? update(current.current) : { ...current.current, ...update };
    const url = navigationUrl(next, new URL(location.href));
    const sameUrl = url === location.pathname + location.search + location.hash;
    if (!sameUrl || entry().detail) {
      rememberScroll();
      window.history[replace ? 'replaceState' : 'pushState'](historyData({ scrollY: 0, detail: null }), '', url);
    }
    current.current = next;
    setState(next);
    setDetailKey(null);
    scrollTarget.current = sameUrl ? null : 0;
    setTransition(value => value + 1);
  }, [rememberScroll]);

  const openDetail = useCallback((key: string) => {
    rememberScroll();
    window.history.pushState(historyData({ scrollY: window.scrollY, detail: key }), '', location.href);
    setDetailKey(key);
  }, [rememberScroll]);
  const closeDetail = useCallback(() => {
    if (entry().detail) window.history.back();
    else setDetailKey(null);
  }, []);

  return { state, navigate, restoration, detailKey, openDetail, closeDetail };
}
