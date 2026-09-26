import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Search, X, Layers, Check, ArrowDownWideNarrow, Package, Hash, Cpu } from 'lucide-react';
import type { Filters, Sort } from '../shared/types';
import { BrandLogo } from './BrandLogo';
import { findGames, GENRES } from '../shared/games';
import logos from '../shared/data/logos.json';
import { useRailAutoScroll } from './lib/use-rail-auto-scroll';
import { GAME_RAIL_MOTION } from './lib/deck-motion';
import { locale, t } from './lib/i18n';
import { useRailDrag } from './lib/use-rail-drag';
import { minecraftVersions } from './lib/api';

const logoCatalog: Record<string, { src: string }> = logos;
const fallbackVersions = ['1.21.1', '1.20.1', '1.19.4', '1.18.2', '1.16.5'];
type FilterView = 'genre' | 'sort' | 'version' | 'loader' | 'kind';
export function GameDeck({ gameId, select, close, genreMode = false, sort = 'downloads', setSort, filters = {}, changeFilter, resetFilters, showMinecraftFilters = false, categories, steamSort = 'none' }: { categories?: { id: string; ko: string; en: string }[]; sort?:Sort; setSort?:(sort:Sort) => void; filters?: Filters; changeFilter?: (key: keyof Filters, value: string) => void; resetFilters?: () => void; showMinecraftFilters?: boolean; steamSort?: 'none' | 'only' | 'mixed'; genreMode?:boolean; gameId: string; select: (id: string, genre: string) => void; close: () => void }) {
  const [openFilter, setOpenFilter] = useState<FilterView | null>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const title = genreMode ? '검색 필터' : '게임 선택';
  const countSortLabel = steamSort === 'only' ? '누적 구독순' : steamSort === 'mixed' ? '다운로드·구독순' : '다운로드순';
  const [query, setQuery] = useState('');
  const [dropdownQuery, setDropdownQuery] = useState('');
  const [versions, setVersions] = useState(fallbackVersions);
  const genre = 'all';
  const drag = useRailDrag();
  const [picking, setPicking] = useState<string | null>(null);
  const games = findGames(query, genre);
  const root = useRef<HTMLElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reduced = useRef(matchMedia('(prefers-reduced-motion: reduce)').matches);
  const busy = useRef(false);
  const autoSpeed = useRailAutoScroll(rail,drag.gesture,!openFilter,busy,genreMode ? undefined : GAME_RAIL_MOTION);
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
  }, [query, genre]);
  useEffect(() => {
    if (openFilter !== 'version') return;
    const controller = new AbortController();
    void minecraftVersions(controller.signal).then(setVersions).catch(() => {});
    return () => controller.abort();
  }, [openFilter]);
  useEffect(() => { root.current?.querySelector<HTMLElement>('.filter-dropdown input,.filter-dropdown button')?.focus(); }, [openFilter]);
  useEffect(() => { const onResize = () => setOpenFilter(null); window.addEventListener('resize', onResize); return () => window.removeEventListener('resize', onResize); }, []);
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
  const openDropdown = (id: FilterView, button: HTMLButtonElement) => {
    if (openFilter === id) { setOpenFilter(null); return; }
    const rect = button.getBoundingClientRect();
    const width = Math.min(320, innerWidth - 24);
    const top = Math.min(rect.bottom + 10, Math.max(12, innerHeight - 240));
    setDropdownStyle({ width, left: Math.max(12, Math.min(innerWidth - width - 12, rect.left + rect.width / 2 - width / 2)), top, maxHeight: Math.max(120, innerHeight - top - 12) });
    setDropdownQuery(''); setOpenFilter(id);
  };
  const versionQuery = dropdownQuery.trim();
  const versionOptions = [...new Set([...( /^\d+\.[\w. +\-]{1,38}$/.test(versionQuery) ? [versionQuery] : []), ...(filters.version ? [filters.version] : []), ...versions])]
    .filter(version => version.toLowerCase().includes(versionQuery.toLowerCase()));
  const option = (id: string, label: string, selected: boolean, onClick: () => void) => <button type="button" key={id || 'all'} className={selected ? 'filter-option is-current' : 'filter-option'} aria-pressed={selected} onClick={() => { onClick(); setOpenFilter(null); }}><span>{label}</span>{selected && <Check size={18} />}</button>;
  const keyboard = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); openFilter ? setOpenFilter(null) : close(); }
    if (event.key === 'Tab') {
      const controls = [...root.current!.querySelectorAll<HTMLElement>('button:not(:disabled),input,select')];
      const first = controls[0]; const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  };
  return <section ref={root} className={`game-deck ${picking ? 'is-selecting' : ''}`} role="dialog" aria-modal="true" aria-label={t(title)} onKeyDown={keyboard} onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <header className="deck-header">{genreMode && <button className="text-button filter-reset" onClick={() => { resetFilters?.(); setOpenFilter(null); }}>{t('초기화')}</button>}<h2>{t(title)}</h2><button className="deck-close" aria-label={t('닫기')} onClick={close}><X size={24} /></button></header>
    {!genreMode && <div className="deck-tools"><label className="deck-search"><Search size={17} /><input aria-label={t('게임 찾기')} placeholder={t('게임 이름으로 찾기')} value={query} onChange={event => setQuery(event.target.value)} /></label></div>}
    <div className="deck-stage">
      <div ref={rail} className={`deck-rail ${genreMode ? 'filter-menu-rail' : ''} ${drag.dragging ? 'is-dragging' : ''}`} {...drag.handlers} onWheel={event => { if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) rail.current!.scrollLeft += event.deltaY; }}>
        {genreMode ? [{ id:'genre' as const, label:'장르', Icon:Layers }, { id:'sort' as const, label:'정렬 방법', Icon:ArrowDownWideNarrow }, ...(showMinecraftFilters ? [{ id:'version' as const, label:'게임 버전', Icon:Hash }, { id:'loader' as const, label:'모드 로더', Icon:Cpu }, { id:'kind' as const, label:'프로젝트 종류', Icon:Package }] : [])].map(({ id,label,Icon }) => <button key={id} className={openFilter === id ? 'deck-card is-current' : 'deck-card'} style={{ '--game-color':'var(--accent)' } as React.CSSProperties} aria-expanded={openFilter === id} onClick={event => openDropdown(id, event.currentTarget)}><Icon size={100}/><span>{t(label)}</span></button>) : <>
          {!query && <button type="button" className={`deck-card ${gameId === 'all' ? 'is-current' : ''} ${picking === 'all' ? 'is-picking' : ''}`} style={{ '--game-color':'var(--accent)' } as React.CSSProperties} aria-pressed={gameId === 'all'} disabled={!!picking} onClick={() => choose('all')}><BrandLogo size={100}/><span>{t('전체 게임')}</span></button>}
          {games.map(game => <button type="button" key={game.id} className={`deck-card ${gameId === game.id ? 'is-current' : ''} ${picking === game.id ? 'is-picking' : ''}`} style={{ '--game-color': game.color } as React.CSSProperties} aria-label={locale === 'ko' ? game.koreanName : game.name} aria-pressed={gameId === game.id} disabled={!!picking} onClick={() => choose(game.id)} onFocus={event => { if (!busy.current && !drag.gesture.current) event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduced.current ? 'instant' : 'smooth' }); }}><img className={`logo-${game.id}`} src={logoCatalog[game.id]?.src} alt="" draggable={false} /><span>{locale === 'ko' ? game.koreanName : game.name}</span></button>)}
        </>}
      </div>
      {!genreMode && !games.length && <p className="deck-empty">{t('일치하는 게임이 없어요')}</p>}
    </div>
    {!genreMode && <div className="deck-navigation"><button aria-label={t('이전 게임')} onClick={() => step(-1)}><ArrowLeft size={22} /></button><button aria-label={t('다음 게임')} onClick={() => step(1)}><ArrowRight size={22} /></button></div>}
    {genreMode && openFilter && <div className="filter-dropdown" style={dropdownStyle} role="group" aria-label={t(({ genre:'장르', sort:'정렬 방법', version:'게임 버전', loader:'모드 로더', kind:'프로젝트 종류' } as const)[openFilter])}>
      {(openFilter === 'genre' || openFilter === 'version') && <label className="filter-dropdown-search"><Search size={17}/><input aria-label={t(openFilter === 'genre' ? '장르' : '게임 버전')} placeholder={t(openFilter === 'genre' ? '장르' : '예: 1.21.1')} value={dropdownQuery} maxLength={openFilter === 'version' ? 40 : undefined} onChange={event => setDropdownQuery(event.target.value)} /></label>}
      <div className="filter-dropdown-options">
        {openFilter === 'genre' && <>{!dropdownQuery && option('all', t('전체 장르'), gameId === 'all', () => select('all', genre))}{(categories ?? GENRES).filter(item => [item.ko,item.en].some(name => name.toLowerCase().includes(dropdownQuery.toLowerCase()))).map(item => option(item.id, locale === 'ko' ? item.ko : item.en, gameId === item.id, () => select(item.id, genre)))}</>}
        {openFilter === 'sort' && ([['relevance', '관련도순'], ['downloads', countSortLabel], ['popular', '인기도순'], ['updated', '최근 업데이트순']] as const).map(([id,label]) => option(id, t(label), sort === id, () => setSort?.(id)))}
        {openFilter === 'version' && <>{!versionQuery && option('all', t('전체 버전'), !filters.version, () => changeFilter?.('version', ''))}{versionOptions.map(version => option(version, version, filters.version === version, () => changeFilter?.('version', version)))}</>}
        {openFilter === 'loader' && <>{option('all', t('전체 로더'), !filters.loader, () => changeFilter?.('loader', ''))}{[['fabric', 'Fabric'], ['forge', 'Forge'], ['neoforge', 'NeoForge'], ['quilt', 'Quilt']].map(([id,label]) => option(id, label, filters.loader === id, () => changeFilter?.('loader', id)))}</>}
        {openFilter === 'kind' && <>{option('all', t('전체 종류'), !filters.kind, () => changeFilter?.('kind', ''))}{[['mod', '모드'], ['modpack', '모드팩'], ['resourcepack', '리소스팩'], ['shader', '셰이더']].map(([id,label]) => option(id, t(label), filters.kind === id, () => changeFilter?.('kind', id)))}</>}
      </div>
    </div>}
  </section>;
}
