import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Search, X, Boxes, Swords, Trees, Building2, Flag, Zap, Dices, Ghost, Layers, Check, Download, TrendingUp, ArrowDownWideNarrow, Package, Hash, Cpu, Clock } from 'lucide-react';
import type { Filters, Sort } from '../shared/types';
import { categoryIcon } from './category-icons';
import { BrandLogo } from './BrandLogo';
import { findGames, GENRES } from '../shared/games';
import logos from '../shared/data/logos.json';
import { useRailAutoScroll } from './lib/use-rail-auto-scroll';
import { GAME_RAIL_MOTION } from './lib/deck-motion';
import { locale, t } from './lib/i18n';
import { CardPages } from './CardPages';
import { useMobileLayout } from './lib/use-mobile-layout';
import { useMobileLayout as useMobileDevice } from './lib/mobile-layout';
import { useRailDrag } from './lib/use-rail-drag';
import { minecraftVersions } from './lib/api';

const logoCatalog: Record<string, { src: string }> = logos;
export function GameDeck({ gameId, select, close, genreMode = false, sort = 'downloads', setSort, filters = {}, changeFilter, showMinecraftFilters = false, categories, selectedCategories, steamSort = 'none' }: { selectedCategories?: string[]; categories?: { id: string; ko: string; en: string }[]; sort?:Sort; setSort?:(sort:Sort) => void; filters?: Filters; changeFilter?: (key: keyof Filters, value: string) => void; showMinecraftFilters?: boolean; steamSort?: 'none' | 'only' | 'mixed'; genreMode?:boolean; gameId: string; select: (id: string, genre: string) => void; close: () => void }) {
  const [openFilter, setOpenFilter] = useState<'version' | 'loader' | 'kind' | null>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [dropdownQuery, setDropdownQuery] = useState('');
  const [versions, setVersions] = useState(['1.21.1', '1.20.1', '1.19.4', '1.18.2', '1.16.5']);
  const [view,setView] = useState<'menu'|'genre'|'sort'>(genreMode ? 'menu' : 'genre');
  const title = genreMode ? view === 'menu' ? '검색 필터' : view === 'sort' ? '정렬 방법' : '장르' : '게임 선택';
  const countSortLabel = steamSort === 'only' ? '누적 구독순' : steamSort === 'mixed' ? '다운로드·구독순' : '다운로드순';
  const [query, setQuery] = useState('');
  const genre = 'all';
  const mobile = useMobileLayout();
  const touchLayout = useMobileDevice();
  const drag = useRailDrag();
  const [picking, setPicking] = useState<string | null>(null);
  const genreIcons = [Boxes,Swords,Trees,Building2,Flag,Zap,Dices,Ghost];
  const games = genreMode ? (categories ?? GENRES).filter(g => [g.ko,g.en].some(name => name.toLowerCase().includes(query.toLowerCase()))).map(g => ({ id:g.id, name:g.en, koreanName:g.ko, color:'var(--accent)' })) : findGames(query, genre);
  const root = useRef<HTMLElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const filterAnchor = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reduced = useRef(matchMedia('(prefers-reduced-motion: reduce)').matches);
  const busy = useRef(false);
  const autoSpeed = useRailAutoScroll(rail,drag.gesture,!mobile && !openFilter,busy,genreMode ? undefined : GAME_RAIL_MOTION);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    root.current?.querySelector<HTMLElement>(mobile ? 'button' : 'input')?.focus({ preventScroll: true });
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => { reduced.current = media.matches; };
    media.addEventListener('change', motion);
    return () => { clearTimeout(timer.current); media.removeEventListener('change', motion); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  useEffect(() => {
    if (rail.current) rail.current.scrollLeft = 0;
  }, [query, genre, view]);
  useEffect(() => { root.current?.querySelector<HTMLElement>(mobile ? 'button' : 'input,button')?.focus({ preventScroll: true }); }, [view, mobile]);
  useEffect(() => {
    if (openFilter !== 'version') return;
    const controller = new AbortController();
    void minecraftVersions(controller.signal).then(setVersions).catch(() => {});
    return () => controller.abort();
  }, [openFilter]);
  useEffect(() => { root.current?.querySelector<HTMLElement>(mobile ? '.filter-dropdown button' : '.filter-dropdown input,.filter-dropdown button')?.focus({ preventScroll: true }); }, [openFilter, mobile]);
  useEffect(() => {
    if (!openFilter) return;
    // Keyboard opening, browser chrome and rotation resize the viewport without dismissing the picker.
    const viewport = window.visualViewport;
    const position = () => {
      const rect = filterAnchor.current?.getBoundingClientRect();
      if (!rect) return;
      const leftEdge = viewport?.offsetLeft ?? 0;
      const topEdge = viewport?.offsetTop ?? 0;
      const height = viewport?.height ?? innerHeight;
      const width = Math.min(320, (viewport?.width ?? innerWidth) - 24);
      const top = Math.max(topEdge + 12, Math.min(rect.bottom + 10, topEdge + height - 240));
      const left = Math.max(leftEdge + 12, Math.min(leftEdge + (viewport?.width ?? innerWidth) - width - 12, rect.left + rect.width / 2 - width / 2));
      setDropdownStyle({ width, left, top, maxHeight: Math.max(0, topEdge + height - top - 12) });
    };
    position();
    window.addEventListener('resize', position);
    viewport?.addEventListener('resize', position);
    viewport?.addEventListener('scroll', position);
    return () => {
      window.removeEventListener('resize', position);
      viewport?.removeEventListener('resize', position);
      viewport?.removeEventListener('scroll', position);
    };
  }, [openFilter]);
  useEffect(() => {
    if (mobile) return;
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
  }, [mobile]);
  const animateFilterPick = (card: HTMLButtonElement) => {
    for (const animation of card.getAnimations()) {
      if (animation.id === 'filter-card-pick') animation.cancel();
    }
    if (mobile || (touchLayout && genreMode && view === 'genre') || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const resting = 'translateY(var(--card-drop,0px)) rotateY(var(--card-turn,0deg))';
    const lift = Math.min(55, card.offsetHeight * .18);
    const shadow = getComputedStyle(card).boxShadow;
    card.animate([
      { transform: resting, boxShadow: shadow, easing: 'cubic-bezier(.2,.75,.22,1)' },
      { transform: `translateY(calc(var(--card-drop,0px) - ${lift}px)) rotateY(var(--card-turn,0deg)) rotateZ(-4deg) scale(1.04)`, boxShadow: '0 30px 85px #0008,0 0 45px rgba(var(--tint-rgb),.65)', offset: .4, easing: 'cubic-bezier(.2,.75,.22,1)' },
      { transform: resting, boxShadow: shadow },
    ], { id: 'filter-card-pick', duration: 560 });
  };
  const choose = (id: string, card: HTMLButtonElement) => {
    if (selectedCategories) { animateFilterPick(card); select(id, genre); return; }
    if (busy.current) return;
    busy.current = true; setPicking(id);
    timer.current = setTimeout(() => select(id, genre), touchLayout && genreMode && id !== 'all' && !reduced.current ? 420 : mobile || reduced.current ? 0 : 560);
  };
  const step = (direction: number) => rail.current?.scrollBy({ left: direction * 300, behavior: reduced.current ? 'instant' : 'smooth' });
  const openDropdown = (id: 'version' | 'loader' | 'kind', button: HTMLButtonElement) => {
    if (openFilter === id) { setOpenFilter(null); return; }
    filterAnchor.current = button;
    setDropdownQuery(''); setOpenFilter(id);
  };
  const selected = (id: string) => selectedCategories ? id === 'all' ? !selectedCategories.length : selectedCategories.includes(id) : gameId === id;
  const versionQuery = dropdownQuery.trim();
  const versionOptions = [...new Set([...( /^\d+\.[\w. +\-]{1,38}$/.test(versionQuery) ? [versionQuery] : []), ...(filters.version ? [filters.version] : []), ...versions])]
    .filter(version => version.toLowerCase().includes(versionQuery.toLowerCase()));
  const option = (id: string, label: string, selected: boolean, onClick: () => void) => <button type="button" key={id || 'all'} className={selected ? 'filter-option is-current' : 'filter-option'} aria-pressed={selected} onClick={() => { onClick(); setOpenFilter(null); }}><span>{label}</span>{selected && <Check size={18} />}</button>;
  const keyboard = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); openFilter ? setOpenFilter(null) : genreMode && view !== 'menu' ? (setQuery(''), setView('menu')) : close(); }
    if (event.key === 'Tab') {
      const controls = [...root.current!.querySelectorAll<HTMLElement>('button:not(:disabled),input,select')].filter(control => !control.closest('[inert]'));
      const first = controls[0]; const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  };
  return <section ref={root} className={`game-deck ${touchLayout && genreMode && view === 'genre' ? 'mobile-genre-deck' : ''} ${picking ? 'is-selecting' : ''}`} role="dialog" aria-modal="true" aria-label={t(title)} onKeyDown={keyboard} onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <header className="deck-header">{genreMode && view !== 'menu' && <button className="deck-close filter-back" aria-label={t('뒤로')} onClick={() => { setQuery(''); setOpenFilter(null); setView('menu'); }}><ArrowLeft size={24}/></button>}<h2>{t(title)}</h2><button className="deck-close" aria-label={t('닫기')} onClick={close}><X size={24} /></button></header>
    {view === 'genre' && <><div className="deck-tools"><label className="deck-search"><Search size={17} /><input aria-label={t(genreMode ? '장르' : '게임 찾기')} placeholder={t(genreMode ? '장르' : '게임 이름으로 찾기')} value={query} onChange={event => setQuery(event.target.value)} /></label></div>
    </>}
    <div className="deck-stage">
      <div ref={rail} className={`deck-rail ${view !== 'genre' ? 'filter-menu-rail' : ''} ${drag.dragging ? 'is-dragging' : ''}`} {...(mobile ? {} : drag.handlers)} onWheel={event => { if (!mobile && Math.abs(event.deltaY) > Math.abs(event.deltaX)) rail.current!.scrollLeft += event.deltaY; }}>
        <CardPages key={`${view}:${query}`} swipe>
        {view === 'menu' && <>
          {[{ id:'genre' as const, label:'장르', Icon:Layers }, { id:'sort' as const, label:'정렬 방법', Icon:ArrowDownWideNarrow }].map(({ id,label,Icon }) => <button key={id} className="deck-card" style={{ '--game-color':'var(--accent)' } as React.CSSProperties} onClick={() => setView(id)}><Icon size={100}/><span>{t(label)}</span></button>)}
        </>}
        {view === 'sort' && [{ id:'relevance' as const, label:'관련도순', Icon:Search }, { id:'updated' as const, label:'최근 업데이트순', Icon:Clock }, { id:'downloads' as const, label:countSortLabel, Icon:Download }, { id:'popular' as const, label:'인기도순', Icon:TrendingUp }].map(({ id,label,Icon }) => <button key={id} className={sort === id ? 'deck-card is-current' : 'deck-card'} style={{ '--game-color':'var(--accent)' } as React.CSSProperties} aria-pressed={sort === id} onClick={event => { animateFilterPick(event.currentTarget); setSort?.(id); }}>{sort === id && <Check className="sort-selection" size={24}/>}<Icon size={100}/><span>{t(label)}</span></button>)}
        {view === 'genre' && <>{!query && <button type="button" className={`deck-card ${selected('all') ? 'is-current' : ''} ${picking === 'all' ? 'is-picking' : ''}`} style={{ '--game-color':'var(--accent)' } as React.CSSProperties} aria-pressed={selected('all')} disabled={!!picking} onClick={event => choose('all', event.currentTarget)}>{genreMode ? <Layers size={100}/> : <BrandLogo size={100}/>}<span>{t(genreMode ? '전체 장르' : '전체 게임')}</span></button>}{genreMode && showMinecraftFilters && [{ id:'version' as const, label:'게임 버전', Icon:Hash }, { id:'loader' as const, label:'모드 로더', Icon:Cpu }, { id:'kind' as const, label:'프로젝트 종류', Icon:Package }].map(({ id,label,Icon }) => <button key={id} className={openFilter === id ? 'deck-card is-current' : 'deck-card'} style={{ '--game-color':'var(--accent)' } as React.CSSProperties} aria-expanded={openFilter === id} onClick={event => openDropdown(id, event.currentTarget)}><Icon size={100}/><span>{t(label)}</span></button>)}
        {games.map(game => <button type="button" key={game.id} data-genre-id={genreMode ? game.id : undefined} className={`deck-card ${selected(game.id) ? 'is-current' : ''} ${picking === game.id ? 'is-picking' : ''}`} style={{ '--game-color': game.color } as React.CSSProperties} aria-label={locale === 'ko' ? game.koreanName : game.name} aria-pressed={selected(game.id)} disabled={!!picking} onClick={event => choose(game.id, event.currentTarget)} onFocus={event => { if (!mobile && !busy.current && !drag.gesture.current) event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduced.current ? 'instant' : 'smooth' }); }}>
          {!touchLayout && selectedCategories && selected(game.id) && <Check className="sort-selection" size={24}/>} {genreMode ? (() => { const Icon = categories ? categoryIcon(game.name) : genreIcons[GENRES.findIndex(g => g.id === game.id)] ?? Layers; return <Icon size={100}/>; })() : <img className={`logo-${game.id}`} src={logoCatalog[game.id]?.src} alt="" draggable={false} />}<span>{locale === 'ko' ? game.koreanName : game.name}</span>
        </button>)}</>}
        </CardPages>
      </div>
      {view === 'genre' && !games.length && <p className="deck-empty">{t('일치하는 게임이 없어요')}</p>}
    </div>
    {!mobile && view === 'genre' && <div className="deck-navigation"><button aria-label={t('이전 게임')} onClick={() => step(-1)}><ArrowLeft size={22} /></button><button aria-label={t('다음 게임')} onClick={() => step(1)}><ArrowRight size={22} /></button></div>}
    {genreMode && openFilter && <div className={`filter-dropdown ${touchLayout ? 'is-liquid-glass' : ''}`} style={dropdownStyle} role="group" aria-label={t(({ version:'게임 버전', loader:'모드 로더', kind:'프로젝트 종류' } as const)[openFilter])}>
      {openFilter === 'version' && <label className="filter-dropdown-search"><Search size={17}/><input aria-label={t('게임 버전')} placeholder={t('예: 1.21.1')} value={dropdownQuery} maxLength={40} onChange={event => setDropdownQuery(event.target.value)} /></label>}
      <div className="filter-dropdown-options">
        {openFilter === 'version' && <>{!versionQuery && option('all', t('전체 버전'), !filters.version, () => changeFilter?.('version', ''))}{versionOptions.map(version => option(version, version, filters.version === version, () => changeFilter?.('version', version)))}</>}
        {openFilter === 'loader' && <>{option('all', t('전체 로더'), !filters.loader, () => changeFilter?.('loader', ''))}{[['fabric', 'Fabric'], ['forge', 'Forge'], ['neoforge', 'NeoForge'], ['quilt', 'Quilt']].map(([id,label]) => option(id, label, filters.loader === id, () => changeFilter?.('loader', id)))}</>}
        {openFilter === 'kind' && <>{option('all', t('전체 종류'), !filters.kind, () => changeFilter?.('kind', ''))}{[['mod', '모드'], ['modpack', '모드팩'], ['resourcepack', '리소스팩'], ['shader', '셰이더']].map(([id,label]) => option(id, t(label), filters.kind === id, () => changeFilter?.('kind', id)))}</>}
      </div>
    </div>}
  </section>;
}
