import { useEffect, useRef, useState } from 'react';
import { useOverlay } from './lib/overlay';
import { ArrowLeft, ArrowRight, Search, X, Boxes, Swords, Trees, Building2, Flag, Zap, Dices, Ghost, Layers, Check, Download, TrendingUp, ArrowDownWideNarrow, ArrowUpWideNarrow, Package, Hash, Cpu, Clock, Wrench, UsersRound, Palette, Gauge, SlidersHorizontal as SlidersIcon } from 'lucide-react';
import type { FilterSelections, Sort, SortDirection } from '../shared/types';
import { filterValues, MULTI_FILTER_KEYS, type MultiFilterKey } from '../shared/filter-selections';
import { groupCategories } from '../shared/category-groups';
import { categoryIcon } from './category-icons';
import { BrandLogo } from './BrandLogo';
import { findGames, GENRES } from '../shared/games';
import logos from '../shared/data/logos.json';
import { useRailAutoScroll } from './lib/use-rail-auto-scroll';
import { GAME_RAIL_MOTION } from './lib/deck-motion';
import { locale, t } from './lib/i18n';
import { CardPages } from './CardPages';
import { useMobileLayout } from './lib/use-mobile-layout';
import { useRailDrag } from './lib/use-rail-drag';
import { minecraftVersions } from './lib/api';

const logoCatalog: Record<string, { src: string }> = logos;
export function GameDeck({ gameId, select, close, genreMode = false, sort = 'downloads', setSort, direction = 'desc', setDirection, filters = {}, changeFilter, showMinecraftFilters = false, categories, selectedCategories, steamSort = 'none' }: { selectedCategories?: string[]; categories?: { id: string; ko: string; en: string }[]; sort?:Sort; setSort?:(sort:Sort) => void; direction?:SortDirection; setDirection?:(direction:SortDirection) => void; filters?: FilterSelections; changeFilter?: (key: MultiFilterKey, value: string) => void; showMinecraftFilters?: boolean; steamSort?: 'none' | 'only' | 'mixed'; genreMode?:boolean; gameId: string; select: (id: string, genre: string) => void; close: () => void }) {
  const [versions, setVersions] = useState(['1.21.1', '1.20.1', '1.19.4', '1.18.2', '1.16.5']);
  const [view,setView] = useState<'genre'|'sort'|MultiFilterKey|`group:${string}`>('genre');
  const filterView = MULTI_FILTER_KEYS.find(key => key === view);
  const categoryGroups = categories ? groupCategories(categories) : [];
  const currentGroup = categoryGroups.find(group => `group:${group.id}` === view);
  const filterLabels = { version:'게임 버전', loader:'모드 로더', kind:'프로젝트 종류' };
  const title = !genreMode ? '게임 선택' : filterView ? filterLabels[filterView] : currentGroup ? (locale === 'ko' ? currentGroup.ko : currentGroup.en) : view === 'sort' ? '정렬 방법' : '장르';
  const countSortLabel = steamSort === 'only' ? '누적 구독순' : steamSort === 'mixed' ? '다운로드·구독순' : '다운로드순';
  const [query, setQuery] = useState('');
  const genre = 'all';
  const mobile = useMobileLayout();
  const drag = useRailDrag();
  const [picking, setPicking] = useState<string | null>(null);
  const genreIcons = [Boxes,Swords,Trees,Building2,Flag,Zap,Dices,Ghost];
  const games = genreMode ? (currentGroup?.categories ?? (categories ? [] : GENRES)).map(g => ({ id:g.id, name:g.en, koreanName:g.ko, color:'var(--accent)' })) : findGames(query, genre);
  const root = useRef<HTMLElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reduced = useRef(matchMedia('(prefers-reduced-motion: reduce)').matches);
  const busy = useRef(false);
  const autoSpeed = useRailAutoScroll(rail,drag.gesture,!mobile,busy,genreMode ? undefined : GAME_RAIL_MOTION);
  useEffect(() => {
    root.current?.querySelector<HTMLElement>(mobile ? 'button' : 'input,button')?.focus({ preventScroll: true });
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => {
      reduced.current = media.matches;
      if (media.matches) for (const animation of root.current?.getAnimations({ subtree:true }) ?? []) {
        if (animation.id === 'filter-card-pick') animation.cancel();
      }
    };
    media.addEventListener('change', motion);
    return () => { clearTimeout(timer.current); media.removeEventListener('change', motion); };
  }, []);
  useOverlay(root);
  useEffect(() => {
    if (rail.current) rail.current.scrollLeft = 0;
  }, [query, genre, view]);
  useEffect(() => { root.current?.querySelector<HTMLElement>(mobile ? 'button' : 'input,button')?.focus({ preventScroll: true }); }, [view, mobile]);
  useEffect(() => {
    if (view !== 'version') return;
    const controller = new AbortController();
    void minecraftVersions(controller.signal).then(setVersions).catch(() => {});
    return () => controller.abort();
  }, [view]);
  useEffect(() => {
    if (mobile) return;
    const el = rail.current;
    if (!el) return;
    let frame = 0;
    const animate = () => {
      frame = 0;
      const velocity = autoSpeed.current;
      const box = el.getBoundingClientRect();
      const positions = [...el.querySelectorAll<HTMLElement>('.deck-card')].map(card => {
        const r = card.getBoundingClientRect();
        const offset = Math.max(-1, Math.min(1, (r.left + r.width / 2 - box.left - box.width / 2) / (box.width / 2)));
        return { card, offset };
      });
      for (const { card, offset } of positions) {
        card.style.setProperty('--card-turn', `${reduced.current ? 0 : offset * -15 + velocity / 180}deg`);
        card.style.setProperty('--card-drop', `${reduced.current ? 0 : Math.abs(offset) * 18}px`);
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(animate); };
    const observer = new ResizeObserver(schedule);
    observer.observe(el);
    for (const card of el.querySelectorAll('.deck-card')) observer.observe(card);
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    el.addEventListener('scroll', schedule, { passive: true });
    media.addEventListener('change', schedule);
    schedule();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); el.removeEventListener('scroll', schedule); media.removeEventListener('change', schedule); };
  }, [mobile, view, query, locale]);
  const animateFilterPick = (card: HTMLButtonElement, nextSelected?: boolean) => {
    const style = getComputedStyle(card);
    const start = style.transform;
    for (const animation of card.getAnimations()) {
      if (animation.id === 'filter-card-pick') animation.cancel();
    }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (nextSelected !== undefined) {
      // Play on both toggle directions, ending at the new state's resting pose.
      // Opacity stays fixed so an option never inherits the game exit fade.
      card.animate([
        { transform:start, opacity:1, easing:'cubic-bezier(.2,.75,.22,1)' },
        { transform:style.getPropertyValue('--genre-card-draw'), opacity:1, offset:.45, easing:'cubic-bezier(.2,.75,.22,1)' },
        { transform:style.getPropertyValue(nextSelected ? '--genre-card-raised' : '--genre-card-rest'), opacity:1 },
      ], { id:'filter-card-pick', duration:420 });
      return;
    }
    if (mobile) return;
    const resting = 'translateY(var(--card-drop,0px)) rotateY(var(--card-turn,0deg))';
    const lift = Math.min(55, card.offsetHeight * .18);
    const shadow = getComputedStyle(card).boxShadow;
    card.animate([
      { transform: resting, boxShadow: shadow, easing: 'cubic-bezier(.2,.75,.22,1)' },
      { transform: `translateY(calc(var(--card-drop,0px) - ${lift}px)) rotateY(var(--card-turn,0deg)) rotateZ(-4deg) scale(1.04)`, boxShadow: '0 30px 85px #0008,0 0 45px rgba(var(--tint-rgb),.65)', offset: .4, easing: 'cubic-bezier(.2,.75,.22,1)' },
      { transform: resting, boxShadow: shadow },
    ], { id: 'filter-card-pick', duration: 560 });
  };
  const choose = (id: string) => {
    if (selectedCategories) { select(id, genre); return; }
    if (busy.current) return;
    busy.current = true; setPicking(id);
    const next = genreMode && gameId === id ? 'all' : id;
    timer.current = setTimeout(() => select(next, genre), genreMode ? !reduced.current ? 420 : 0 : mobile || reduced.current ? 0 : 560);
  };
  const step = (direction: number) => rail.current?.scrollBy({ left: direction * 300, behavior: reduced.current ? 'instant' : 'smooth' });
  const back = () => { setQuery(''); setView('genre'); };
  const selected = (id: string) => selectedCategories ? id === 'all' ? !selectedCategories.length : selectedCategories.includes(id) : gameId === id;
  const versionQuery = query.trim();
  const selectedFilters = { version:filterValues(filters.version), loader:filterValues(filters.loader), kind:filterValues(filters.kind) };
  const versionOptions = [...new Set([...( /^\d+\.[\w. +\-]{1,38}$/.test(versionQuery) ? [versionQuery] : []), ...versions, ...selectedFilters.version])]
    .filter(version => version.toLowerCase().includes(versionQuery.toLowerCase()));
  const filterOptions = filterView === 'version' ? versionOptions.map(version => [version, version]) : filterView === 'loader' ? [['fabric', 'Fabric'], ['forge', 'Forge'], ['neoforge', 'NeoForge'], ['quilt', 'Quilt']] : [['mod', t('모드')], ['modpack', t('모드팩')], ['resourcepack', t('리소스팩')], ['shader', t('셰이더')]];
  const FilterIcon = filterView === 'version' ? Hash : filterView === 'loader' ? Cpu : Package;
  const groupIcons = { content:Boxes, system:Gauge, world:Trees, characters:UsersRound, appearance:Palette, utility:Wrench, other:Layers };
  const keyboard = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); genreMode && view !== 'genre' ? back() : close(); }
    if (event.key === 'Tab') {
      const controls = [...root.current!.querySelectorAll<HTMLElement>('button:not(:disabled),input,select')].filter(control => !control.closest('[inert]'));
      const first = controls[0]; const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  };
  return <section ref={root} className={`game-deck ${genreMode && view !== 'sort' ? 'genre-deck' : ''} ${picking ? 'is-selecting' : ''}`} role="dialog" aria-modal="true" aria-label={t(title)} onKeyDown={keyboard} onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <header className="deck-header">{genreMode && view !== 'genre' && <button className="deck-close filter-back" aria-label={t('뒤로')} onClick={back}><ArrowLeft size={24}/></button>}<h2>{t(title)}</h2><button className="deck-close" aria-label={t('닫기')} onClick={close}><X size={24} /></button></header>
    {(!genreMode || view === 'version') && <div className="deck-tools"><label className="deck-search"><Search size={17} /><input aria-label={t(genreMode ? '게임 버전' : '게임 찾기')} placeholder={t(genreMode ? '예: 1.21.1' : '게임 이름으로 찾기')} value={query} maxLength={genreMode ? 40 : undefined} onChange={event => setQuery(event.target.value)} /></label></div>}
    {genreMode && view !== 'version' && <div className="deck-tools filter-sort-tools">
      <button type="button" className="filter-sort-orb" aria-label={t('정렬 방법')} title={t('정렬 방법')} aria-pressed={view === 'sort'} onClick={() => { setQuery(''); setView(view === 'sort' ? 'genre' : 'sort'); }}><SlidersIcon size={22}/></button>
      <button type="button" className="filter-sort-orb" aria-label={t(direction === 'asc' ? '오름차순' : '내림차순')} title={t(direction === 'asc' ? '오름차순' : '내림차순')} aria-pressed={direction === 'asc'} onClick={() => setDirection?.(direction === 'asc' ? 'desc' : 'asc')}>{direction === 'asc' ? <ArrowUpWideNarrow size={22}/> : <ArrowDownWideNarrow size={22}/>}</button>
    </div>}
    <div className="deck-stage">
      <div ref={rail} className={`deck-rail ${genreMode ? 'filter-menu-rail' : ''} ${drag.dragging ? 'is-dragging' : ''}`} {...(mobile ? {} : drag.handlers)} onWheel={event => { if (!mobile && Math.abs(event.deltaY) > Math.abs(event.deltaX)) rail.current!.scrollLeft += event.deltaY; }}>
        <CardPages key={`${view}:${query}`} swipe>
        {view === 'sort' && [{ id:'relevance' as const, label:'관련도순', Icon:Search }, { id:'updated' as const, label:'최근 업데이트순', Icon:Clock }, { id:'downloads' as const, label:countSortLabel, Icon:Download }, { id:'popular' as const, label:'인기도순', Icon:TrendingUp }].map(({ id,label,Icon }) => <button key={id} data-filter-id={`sort:${id}`} className={sort === id ? 'deck-card is-current' : 'deck-card'} style={{ '--game-color':'var(--accent)' } as React.CSSProperties} aria-pressed={sort === id} onClick={event => { animateFilterPick(event.currentTarget); setSort?.(id); }}>{sort === id && <Check className="sort-selection" size={24}/>}<Icon size={100}/><span>{t(label)}</span></button>)}
        {filterView && filterOptions.map(([id,label]) => <button type="button" key={id} data-filter-id={`${filterView}:${id}`} className={`deck-card ${selectedFilters[filterView].includes(id) ? 'is-current' : ''}`} aria-pressed={selectedFilters[filterView].includes(id)} onClick={event => { animateFilterPick(event.currentTarget, !selectedFilters[filterView].includes(id)); changeFilter?.(filterView, id); }}><FilterIcon size={100}/><span>{label}</span></button>)}
        {view === 'genre' && <>
          {!genreMode && !query && <button type="button" className={`deck-card ${selected('all') ? 'is-current' : ''} ${picking === 'all' ? 'is-picking' : ''}`} style={{ '--game-color':'var(--accent)' } as React.CSSProperties} aria-pressed={selected('all')} disabled={!!picking} onClick={() => choose('all')}><BrandLogo size={100}/><span>{t('전체 게임')}</span></button>}
          {genreMode && showMinecraftFilters && [{ id:'version' as const, label:'게임 버전', Icon:Hash }, { id:'loader' as const, label:'모드 로더', Icon:Cpu }, { id:'kind' as const, label:'프로젝트 종류', Icon:Package }].map(({ id,label,Icon }) => <button key={id} data-filter-id={id} className={selectedFilters[id].length ? 'deck-card is-current' : 'deck-card'} style={{ '--game-color':'var(--accent)' } as React.CSSProperties} aria-pressed={selectedFilters[id].length > 0} aria-haspopup="dialog" onClick={() => { setQuery(''); setView(id); }}><Icon size={100}/><span>{t(label)}</span></button>)}
          {genreMode && categoryGroups.map(group => { const Icon = groupIcons[group.id as keyof typeof groupIcons]; const active = group.categories.some(category => selectedCategories?.includes(category.id)); return <button type="button" key={group.id} data-filter-id={`group:${group.id}`} className={`deck-card ${active ? 'is-current' : ''}`} aria-pressed={active} aria-haspopup="dialog" onClick={() => setView(`group:${group.id}`)}><Icon size={100}/><span>{locale === 'ko' ? group.ko : group.en}</span></button>; })}
        </>}
        {(view === 'genre' || currentGroup) && games.map(game => <button type="button" key={game.id} data-genre-id={genreMode ? game.id : undefined} className={`deck-card ${selected(game.id) ? 'is-current' : ''} ${picking === game.id ? 'is-picking' : ''}`} style={{ '--game-color': game.color } as React.CSSProperties} aria-label={locale === 'ko' ? game.koreanName : game.name} aria-pressed={selected(game.id)} disabled={!!picking} onClick={event => { if (genreMode) animateFilterPick(event.currentTarget, !selected(game.id)); choose(game.id); }} onFocus={event => { if (!mobile && !busy.current && !drag.gesture.current) event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduced.current ? 'instant' : 'smooth' }); }}>
          {genreMode ? (() => { const Icon = categories ? categoryIcon(game.name) : genreIcons[GENRES.findIndex(g => g.id === game.id)] ?? Layers; return <Icon size={100}/>; })() : <img className={`logo-${game.id}`} src={logoCatalog[game.id]?.src} alt="" draggable={false} />}<span>{locale === 'ko' ? game.koreanName : game.name}</span>
        </button>)}
        </CardPages>
      </div>
      {!genreMode && !games.length && <p className="deck-empty">{t('일치하는 게임이 없어요')}</p>}
    </div>
    {!mobile && <div className="deck-navigation"><button aria-label={t(genreMode ? '이전 페이지' : '이전 게임')} onClick={() => step(-1)}><ArrowLeft size={22} /></button><button aria-label={t(genreMode ? '다음 페이지' : '다음 게임')} onClick={() => step(1)}><ArrowRight size={22} /></button></div>}
  </section>;
}
