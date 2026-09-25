import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Globe2, Palette, X } from 'lucide-react';
import { useRailDrag } from './lib/use-rail-drag';
import { useRailAutoScroll } from './lib/use-rail-auto-scroll';
import { t } from './lib/i18n';

export function SettingsMenu({ children,themeOptions,languageOptions,close }: { children:ReactNode; themeOptions:ReactNode; languageOptions:ReactNode; close:() => void }) {
  const root = useRef<HTMLDivElement>(null);
  const drag = useRailDrag();
  const [view,setView] = useState<'menu'|'theme'|'language'>('menu');
  const rail = useRef<HTMLDivElement>(null);
  useRailAutoScroll(rail,drag.gesture,view === 'menu');
  const lastView = useRef<'theme'|'language'>('theme');
  const open = (next:'theme'|'language') => { lastView.current = next; setView(next); };
  useEffect(() => {
    root.current?.querySelector<HTMLButtonElement>(view === 'menu' ? `[data-preference="${lastView.current}"]` : '.settings-back')?.focus();
  }, [view]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    root.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return createPortal(<div ref={root} className="settings-menu" role="dialog" aria-modal="true" aria-label={t('설정 메뉴')} onKeyDown={event => {
    if (event.key === 'Escape') { event.stopPropagation(); view === 'menu' ? close() : setView('menu'); }
    if (event.key !== 'Tab') return;
    const items = [...root.current!.querySelectorAll<HTMLElement>('button,select')];
    if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
    else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); }
  }}>
    <header className="settings-deck-header">{view !== 'menu' && <button className="deck-close settings-back" aria-label={t('뒤로')} onClick={() => setView('menu')}><ArrowLeft size={24}/></button>}<h2>{t(view === 'theme' ? '테마' : view === 'language' ? '언어' : '설정')}</h2><button className="deck-close" aria-label={t('닫기')} onClick={close}><X size={24}/></button></header>
    {view === 'menu' ? <div ref={rail} className={`settings-rail ${drag.dragging ? 'is-dragging' : ''}`} {...drag.handlers} onWheel={event => { if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) event.currentTarget.scrollLeft += event.deltaY; }}><nav aria-label={t('주 메뉴')}>{children}<button type="button" data-preference="theme" onClick={() => open('theme')}><Palette/><span>{t('테마')}</span></button><button type="button" data-preference="language" onClick={() => open('language')}><Globe2/><span>{t('언어')}</span></button></nav></div>
      : <div className={`preference-panel preference-${view}`}>{view === 'theme' ? themeOptions : languageOptions}</div>}
  </div>,document.body);
}
