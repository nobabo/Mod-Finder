import { useLayoutEffect, type RefObject } from 'react';

const overlays: { root: HTMLElement; previous: HTMLElement | null }[] = [];
let originalOverflow = '';
const controls = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),[tabindex="0"]')]
  .filter(element => !element.closest('[inert]') && element.getClientRects().length > 0);

export function mountOverlay(root: HTMLElement) {
  const entry = { root, previous: document.activeElement as HTMLElement | null };
  if (!overlays.length) { originalOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
  overlays.push(entry);
  const top = () => overlays.at(-1) === entry;
  const focus = () => (root.querySelector<HTMLElement>('[data-autofocus]') ?? controls(root)[0] ?? root).focus({ preventScroll: true });
  const keepFocus = (event: FocusEvent) => { if (top() && !root.contains(event.target as Node)) focus(); };
  const keyboard = (event: KeyboardEvent) => {
    if (!top() || event.key !== 'Tab') return;
    const items = controls(root), first = items[0], last = items.at(-1);
    if (!items.length || !root.contains(document.activeElement) || document.activeElement === root || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
      event.preventDefault(); event.stopPropagation();
      (event.shiftKey ? last ?? root : first ?? root).focus();
    }
  };
  root.tabIndex = -1;
  document.addEventListener('focusin', keepFocus);
  document.addEventListener('keydown', keyboard, true);
  focus();
  return () => {
    const wasTop = top();
    overlays.splice(overlays.indexOf(entry), 1);
    document.removeEventListener('focusin', keepFocus);
    document.removeEventListener('keydown', keyboard, true);
    if (!overlays.length) document.body.style.overflow = originalOverflow;
    if (wasTop) {
      const remaining = overlays.at(-1)?.root;
      const target = entry.previous?.isConnected && (!remaining || remaining.contains(entry.previous)) ? entry.previous : remaining;
      target?.focus({ preventScroll: true });
    }
  };
}

export function useOverlay(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => ref.current ? mountOverlay(ref.current) : undefined, [ref]);
}
