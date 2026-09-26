import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Search, X, Boxes, Swords, Trees, Building2, Flag, Zap, Dices, Ghost, Layers, Check, Download, TrendingUp, ArrowDownWideNarrow, Package } from 'lucide-react';
import type { Sort } from '../shared/types';
import { BrandLogo } from './BrandLogo';
import { findGames, GENRES } from '../shared/games';
import logos from '../shared/data/logos.json';
import { useRailAutoScroll } from './lib/use-rail-auto-scroll';
import { GAME_RAIL_MOTION } from './lib/deck-motion';
import { locale, t } from './lib/i18n';
import { useRailDrag } from './lib/use-rail-drag';

const logoCatalog: Record<string, { src: string }> = logos;
const categoryIcon = (name: string) => {
  if (/weapon|armou?r|equipment|gear|combat/i.test(name)) return Swords;
  if (/world|crop|farm|environment|tree|fishing/i.test(name)) return Trees;
  if (/build|settlement|interior|furniture|home|location|apartment/i.test(name)) return Building2;
  if (/quest|adventure|scenario|map|moon/i.test(name)) return Flag;
  if (/optim|performance|skill|magic|tech|perk/i.test(name)) return Zap;
  if (/dice|gameplay|mechanic|gamemode|tweak/i.test(name)) return Dices;
  if (/monster|enem|creature|hazard/i.test(name)) return Ghost;
  if (/item|storage|craft|prop|food/i.test(name)) return Boxes;
  return Layers;
};
export function GameDeck({ gameId, select, close, genreMode = false, children, sort = 'downloads', setSort, modpacksFirst = false, setModpacksFirst, categories }: { categories?: { id: string; ko: string; en: string }[]; sort?:Sort; setSort?:(sort:Sort) => void; modpacksFirst?: boolean; setModpacksFirst?: (value: boolean) => void; genreMode?:boolean; children?:ReactNode; gameId: string; select: (id: string, genre: string) => void; close: () => void }) {
  const [view,setView] = useState<'menu'|'genre'|'sort'>(genreMode ? 'menu' : 'genre');
  const title = genreMode ? view === 'menu' ? '검색 필터' : view === 'sort' ? '정렬 방법' : '장르' : '게임 선택';
  const [query, setQuery] = useState('');
  const genre = 'all';
  const drag = useRailDrag();
  const [picking, setPicking] = useState<string | null>(null);
  const genreIcons = [Boxes,Swords,Trees,Building2,Flag,Zap,Dices,Ghost];
  const games = genreMode ? (categories ?? GENRES).filter(g => [g.ko,g.en].some(name => name.toLowerCase().includes(query.toLowerCase()))).map(g => ({ id:g.id, name:g.en, koreanName:g.ko, color:'var(--accent)' })) : findGames(query, genre);
  const root = useRef<HTMLElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reduced = useRef(matchMedia('(prefers-reduced-motion: reduce)').matches);
  const busy = useRef(false);
  const autoSpeed = useRailAutoScroll(rail,drag.gesture,true,busy,genreMode ? undefined : GAME_RAIL_MOTION);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    root.current?.querySelector<HTMLInputElement>('input')?.focus();
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => { reduced.current = media.matches; };
    media.addEventListener('change', motion);
    return () => { clearTimeout(timer.current); media.removeEventListener('change', motion); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  useEffect(() => {
    if (rail.current) rail.current.scrollLeft = 0;
  }, [query, genre, view]);
  useEffect(() => { root.current?.querySelector<HTMLElement>('input,button')?.focus(); }, [view]);
  useEffect(() => {
    let frame = 0;
    const animate = () => {
      const el = rail.current;
      if (!el) return;
      const velocity = autoSpeed.current;
      const box = el.getBoundingClientRect();
      for (const card of el.querySelectorAll<HTMLElement>('.deck-card')) {
        const r = card.getBoundingClientRect();
        const offset = Math.max(-1, Math.min(1, (r.left + r.width / 2 - box.left - box.width / 2) / (box.width / 2)));
        card.style.setProperty('--card-turn', `${reduced.current ? 0 : offset * -15 + velocity / 180}deg`);
        card.style.setProperty('--card-drop', `${reduced.current ? 0 : Math.abs(offset) * 18}px`);
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);
  const choose = (id: string) => {
    if (busy.current) return;
    busy.current = true; setPicking(id);
    timer.current = setTimeout(() => select(id, genre), reduced.current ? 0 : 560);
  };
  const step = (direction: number) => rail.current?.scrollBy({ left: direction * 300, behavior: reduced.current ? 'instant' : 'smooth' });
  const keyboard = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); genreMode && view !== 'menu' ? setView('menu') : close(); }
    if (event.key === 'Tab') {
      const controls = [...root.current!.querySelectorAll<HTMLElement>('button:not(:disabled),input,select')];
      const first = controls[0]; const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  };
  return <section ref={root} className={`game-deck ${picking ? 'is-selecting' : ''}`} role="dialog" aria-modal="true" aria-label={t(title)} onKeyDown={keyboard} onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <header className="deck-header">{genreMode && view !== 'menu' && <button className="deck-close filter-back" aria-label={t('뒤로')} onClick={() => { setQuery(''); setView('menu'); }}><ArrowLeft size={24}/></button>}<h2>{t(title)}</h2><button className="deck-close" aria-label={t('닫기')} onClick={close}><X size={24} /></button></header>
    {view === 'genre' && <><div className="deck-tools"><label className="deck-search"><Search size={17} /><input aria-label={t(genreMode ? '장르' : '게임 찾기')} placeholder={t(genreMode ? '장르' : '게임 이름으로 찾기')} value={query} onChange={event => setQuery(event.target.value)} /></label></div>
    {children && <div className="genre-extra-controls">{children}</div>}
    </>}
    <div className="deck-stage">
      <div ref={rail} className={`deck-rail ${view !== 'genre' ? 'filter-menu-rail' : ''} ${drag.dragging ? 'is-dragging' : ''}`} {...drag.handlers} onWheel={event => { if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) rail.current!.scrollLeft += event.deltaY; }}>
        {view === 'menu' && <>
          {[{ id:'genre' as const, label:'장르', Icon:Layers }, { id:'sort' as const, label:'정렬 방법', Icon:ArrowDownWideNarrow }].map(({ id,label,Icon }) => <button key={id} className="deck-card" style={{ '--game-color':'var(--accent)' } as React.CSSProperties} onClick={() => setView(id)}><Icon size={100}/><span>{t(label)}</span></button>)}
          <button type="button" className={modpacksFirst ? 'deck-card is-current' : 'deck-card'} style={{ '--game-color':'var(--accent)' } as React.CSSProperties} aria-pressed={modpacksFirst} onClick={() => setModpacksFirst?.(!modpacksFirst)}>{modpacksFirst && <Check className="sort-selection" size={24}/>}<Package size={100}/><span>{t('모드팩')}</span></button>
        </>}
        {view === 'sort' && [{ id:'downloads' as const, label:'다운로드순', Icon:Download }, { id:'popular' as const, label:'인기도순', Icon:TrendingUp }].map(({ id,label,Icon }) => <button key={id} className={sort === id ? 'deck-card is-current' : 'deck-card'} style={{ '--game-color':'var(--accent)' } as React.CSSProperties} aria-pressed={sort === id} onClick={() => setSort?.(id)}>{sort === id && <Check className="sort-selection" size={24}/>}<Icon size={100}/><span>{t(label)}</span></button>)}
        {view === 'genre' && <>{!query && <button type="button" className={`deck-card ${gameId === 'all' ? 'is-current' : ''} ${picking === 'all' ? 'is-picking' : ''}`} style={{ '--game-color':'var(--accent)' } as React.CSSProperties} aria-pressed={gameId === 'all'} disabled={!!picking} onClick={() => choose('all')}>{genreMode ? <Layers size={100}/> : <BrandLogo size={100}/>}<span>{t(genreMode ? '전체 장르' : '전체 게임')}</span></button>}
        {games.map(game => <button type="button" key={game.id} className={`deck-card ${gameId === game.id ? 'is-current' : ''} ${picking === game.id ? 'is-picking' : ''}`} style={{ '--game-color': game.color } as React.CSSProperties} aria-label={locale === 'ko' ? game.koreanName : game.name} aria-pressed={gameId === game.id} disabled={!!picking} onClick={() => choose(game.id)} onFocus={event => { if (!busy.current && !drag.gesture.current) event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduced.current ? 'instant' : 'smooth' }); }}>
          {genreMode ? (() => { const Icon = categories ? categoryIcon(game.name) : genreIcons[GENRES.findIndex(g => g.id === game.id)] ?? Layers; return <Icon size={100}/>; })() : <img className={`logo-${game.id}`} src={logoCatalog[game.id]?.src} alt="" draggable={false} />}<span>{locale === 'ko' ? game.koreanName : game.name}</span>
        </button>)}</>}
      </div>
      {view === 'genre' && !games.length && <p className="deck-empty">{t('일치하는 게임이 없어요')}</p>}
    </div>
    {view === 'genre' && <div className="deck-navigation"><button aria-label={t('이전 게임')} onClick={() => step(-1)}><ArrowLeft size={22} /></button><button aria-label={t('다음 게임')} onClick={() => step(1)}><ArrowRight size={22} /></button></div>}
  </section>;
}
