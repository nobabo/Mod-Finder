import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Download, Globe2, Monitor, Palette, Smartphone, X } from 'lucide-react';
import { useRailDrag } from './lib/use-rail-drag';
import { useRailAutoScroll } from './lib/use-rail-auto-scroll';
import { t } from './lib/i18n';
import { isNative } from './lib/platform';
import { DOWNLOADS } from './lib/downloads';

type SettingsView = 'menu' | 'theme' | 'language' | 'downloads';

export function SettingsMenu({ children,themeOptions,languageOptions,close }: { children:ReactNode; themeOptions:ReactNode; languageOptions:ReactNode; close:() => void }) {
  const root = useRef<HTMLDivElement>(null);
  const drag = useRailDrag();
  const [view,setView] = useState<SettingsView>('menu');
  const isCardView = view === 'menu' || view === 'downloads';
  const rail = useRef<HTMLDivElement>(null);
  useRailAutoScroll(rail,drag.gesture,isCardView);
  useEffect(() => {
    const element = rail.current;
    if (!isCardView || !element) return;
    element.scrollLeft = (element.scrollWidth - element.clientWidth) / 2;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      const box = element.getBoundingClientRect();
      for (const card of element.querySelectorAll<HTMLElement>('nav button,nav a')) {
        const rect = card.getBoundingClientRect();
        const offset = Math.max(-1, Math.min(1, (rect.left + rect.width / 2 - box.left - box.width / 2) / (box.width / 2)));
        card.style.setProperty('--card-drop', (motion.matches ? 0 : Math.abs(offset) * 18) + 'px');
        card.style.setProperty('--card-turn', (motion.matches ? 0 : offset * -15) + 'deg');
      }
    };
    const observer = new ResizeObserver(() => { element.scrollLeft = (element.scrollWidth - element.clientWidth) / 2; update(); });
    observer.observe(element);
    element.addEventListener('scroll', update, { passive: true });
    motion.addEventListener('change', update);
    update();
    return () => {
      observer.disconnect();
      element.removeEventListener('scroll', update);
      motion.removeEventListener('change', update);
    };
  }, [view, isCardView]);
  const lastView = useRef<Exclude<SettingsView, 'menu'>>('theme');
  const open = (next:Exclude<SettingsView, 'menu'>) => { lastView.current = next; setView(next); };
  useEffect(() => {
    root.current?.querySelector<HTMLButtonElement>(view === 'menu' ? `[data-preference="${lastView.current}"]` : '.settings-back')?.focus({ preventScroll: true });
  }, [view]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    root.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return createPortal(<div ref={root} className="settings-menu" role="dialog" aria-modal="true" aria-label={t('설정 메뉴')} onClick={event => { if (event.target === event.currentTarget) close(); }} onKeyDown={event => {
    if (event.key === 'Escape') { event.stopPropagation(); view === 'menu' ? close() : setView('menu'); }
    if (event.key !== 'Tab') return;
    const items = [...root.current!.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],select')];
    if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
    else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); }
  }}>
    <header className="settings-deck-header">{view !== 'menu' && <button className="deck-close settings-back" aria-label={t('뒤로')} onClick={() => setView('menu')}><ArrowLeft size={24}/></button>}<h2>{t(view === 'theme' ? '테마' : view === 'language' ? '언어' : view === 'downloads' ? '웹 / 앱 다운로드' : '설정')}</h2><button className="deck-close" aria-label={t('닫기')} onClick={close}><X size={24}/></button></header>
    {isCardView ? <div ref={rail} className={`settings-rail ${drag.dragging ? 'is-dragging' : ''}`} {...drag.handlers} onWheel={event => { if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) event.currentTarget.scrollLeft += event.deltaY; }}><nav aria-label={t(view === 'downloads' ? '웹 / 앱 다운로드' : '주 메뉴')}>
      {view === 'downloads' ? <>
        <a href={DOWNLOADS.web} target="_blank" rel="noopener noreferrer"><Globe2/><span>{t('웹에서 열기')}</span></a>
        <a href={DOWNLOADS.windows}><Monitor/><span>Windows</span></a>
        <a href={DOWNLOADS.android}><Smartphone/><span>Android</span></a>
      </> : <>{children}<button type="button" data-preference="theme" onClick={() => open('theme')}><Palette/><span>{t('테마')}</span></button><button type="button" data-preference="language" onClick={() => open('language')}><Globe2/><span>{t('언어')}</span></button>{!isNative() && <button type="button" data-preference="downloads" onClick={() => open('downloads')}><Download/><span>{t('웹 / 앱 다운로드')}</span></button>}</>}
    </nav></div>
      : <div className={`preference-panel preference-${view}`}>{view === 'theme' ? themeOptions : languageOptions}</div>}
  </div>,document.body);
}
