import { t, locale, languagePreference, changeLanguage } from './lib/i18n';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Bookmark, Check, ChevronDown, Compass, GitCompareArrows, History, LoaderCircle, Search, Settings2, SlidersHorizontal, X } from 'lucide-react';
import { categoriesForGame, getCategory } from '../shared/categories';
import { GENRES, gamesInScope, getGame } from '../shared/games';
import { SOURCE_NAMES, type Filters, type Listing, type Sort } from '../shared/types';
import { dateLabel, GameLogo, ModCard, ModIcon, Modal, Sheet, SourceMark } from './components';
import { useSearch } from './lib/search';
import { canPersistListing, emptyLocalData, loadLocalData, saveLocalData, type LocalData } from './lib/storage';
import { openExternal } from './lib/platform';
import { Atmosphere } from './Atmosphere';
import { BrandLogo } from './BrandLogo';
import { ResultPanelOutline } from './ResultPanelOutline';
import { GameDeck } from './GameDeck';
import { THEMES as PALETTES, applyTheme } from './lib/themes';
import { SettingsMenu } from './SettingsMenu';
import { LANGUAGES } from '../shared/locale';
import { listingText } from '../shared/content';
import { useModSummaries } from './lib/mod-summaries';

type Page = 'discover' | 'favorites' | 'recent';
const FILTER_NAMES: Record<string, string> = { version: t("게임 버전"), loader: t("로더"), kind: t("종류"), category: t("장르") };
const THEMES = PALETTES.map(theme => ({ ...theme, name:locale === 'ko' ? theme.ko : theme.en }));
export default function App() {
  const [page, setPage] = useState<Page>('discover');
  const [gameId, setGameId] = useState('minecraft-java');
  const [genre, setGenre] = useState('all');
  const [input, setInput] = useState(''); const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [filters, setFilters] = useState<Filters>({}); const [filterOpen, setFilterOpen] = useState(false);
  const [sort, setSort] = useState<Sort>('downloads');
  const [local, setLocal] = useState<LocalData>(emptyLocalData); const [hydrated, setHydrated] = useState(false);
  const compared = local.compared;
  const setCompared = (next: Listing[] | ((prev: Listing[]) => Listing[])) => setLocal(prev => ({ ...prev, compared: typeof next === 'function' ? next(prev.compared) : next })); const [compareOpen, setCompareOpen] = useState(false);
  const [detail, setDetail] = useState<Listing | null>(null);
  const [gamePicker, setGamePicker] = useState(false); const [menuOpen, setMenuOpen] = useState(false);
  const [accent, setAccent] = useState(() => {
    try { const saved = localStorage.getItem('modfinder-accent'); if (THEMES.some(theme => theme.id === saved)) return saved!; } catch { /* Optional storage. */ }
    return 'magenta';
  });
  const [toast, setToast] = useState('');
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const searchRowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = searchRowRef.current;
    if (!row) return;
    const sync = () => {
      const rect = row.getBoundingClientRect();
      document.documentElement.style.setProperty('--search-center-y', (rect.top + rect.height / 2) + 'px');
    };
    const observer = new ResizeObserver(sync);
    observer.observe(row); observer.observe(document.body);
    window.addEventListener('resize',sync); window.addEventListener('scroll',sync,{ passive:true }); sync();
    return () => { observer.disconnect(); window.removeEventListener('resize',sync); window.removeEventListener('scroll',sync); };
  }, [page, query]);
  const inputRef = useRef<HTMLInputElement>(null);
  const game = getGame(gameId);
  const gameName = (id: string) => { const g = getGame(id); return g ? (locale === 'ko' ? g.koreanName : g.name) : t('전체 게임'); };
  const scopeGames = gamesInScope(gameId, genre);
  useModSummaries([...scopeGames.map(game => game.id), ...local.favorites.map(item => item.gameId), ...compared.map(item => item.gameId)], true);
  const themeControls = <div className="theme-options">{THEMES.map(theme => <button type="button" key={theme.id} aria-pressed={accent === theme.id} onClick={() => setAccent(theme.id)}><i style={{ background: theme.grad }} />{theme.name}{accent === theme.id && <Check size={14} />}</button>)}</div>;
  const hasSearch = submitted || !!filters.category;
  const search = useSearch({ gameId, genre, query, filters, selectedSource: 'all', sort }, false, hasSearch);
  useEffect(() => { let current = true; loadLocalData().then(data => { if (current) { setLocal(data); setHydrated(true); } }).catch(() => { if (current) setToast(t("저장된 정보를 읽지 못했어요. 저장 공간을 확인해 주세요.")); }); return () => { current = false; }; }, []);
  useEffect(() => { if (hydrated) void saveLocalData(local).catch(() => setToast(t("변경사항을 저장하지 못했어요. 저장 공간을 확인해 주세요."))); }, [local, hydrated]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4000); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => { applyTheme(accent); try { localStorage.setItem('modfinder-accent', accent); } catch { /* Theme persistence is optional. */ } }, [accent]);
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); if ((event.ctrlKey || event.metaKey) && event.key === 'k') { event.preventDefault(); setPage('discover'); inputRef.current?.focus(); } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, []);
  const chooseGame = (id: string, nextGenre = 'all') => { setGenre(nextGenre); setGameId(id); setFilters({}); setPage('discover'); setGamePicker(false); requestAnimationFrame(() => inputRef.current?.focus()); };
  const submit = (value = input, id = gameId, selectedGenre = genre, selectedCategory = id === gameId ? filters.category ?? '' : '') => {
    const next = value.trim().slice(0, 200); setInput(next); setQuery(next); setSubmitted(true); setPage('discover'); setMenuOpen(false);
    if (id !== gameId || selectedGenre !== genre) { setGenre(selectedGenre); setGameId(id); setFilters(selectedCategory ? { category: selectedCategory } : {}); }
    else if (selectedCategory !== (filters.category ?? '')) changeFilter('category', selectedCategory);
    if (next) setLocal(prev => ({ ...prev, history: [{ gameId: id, genre: selectedGenre, query: next, ...(selectedCategory ? { category: selectedCategory } : {}) }, ...prev.history.filter(item => item.query !== next || item.gameId !== id || (item.genre ?? 'all') !== selectedGenre || (item.category ?? '') !== selectedCategory)].slice(0, 20) }));
    if (next === query && id === gameId && selectedGenre === genre) search.retry();
  };
  const visit = async (url: string) => { try { await openExternal(url); } catch { setToast(t("링크를 열지 못했어요. 주소를 확인해 주세요.")); } };
  const save = (item: Listing) => { if (!hydrated || !canPersistListing(item)) return; setLocal(prev => ({ ...prev, favorites: prev.favorites.some(f => f.key === item.key) ? prev.favorites.filter(f => f.key !== item.key) : [item, ...prev.favorites] })); };
  const changeFilter = (key: keyof Filters, value: string) => setFilters(prev => { const next = { ...prev }; if (value) next[key] = value; else delete next[key]; return next; });
  const resetFilters = () => setFilters({});
  const go = (target: Page) => { setPage(target); setMenuOpen(false); };
  const heroSearch = page === 'discover' && !hasSearch;
  const visible = page === 'favorites' ? local.favorites : search.items;
  const groups = page === 'favorites' ? local.favorites.map(item => ({ id: item.key, listings: [item] })) : search.groups;

  const completed = Object.values(search.buckets).filter(b => b?.result && ['success', 'empty'].includes(b.result.status)).length;
  const unavailable = Object.values(search.buckets).filter(b => b?.result && !['success', 'empty'].includes(b.result.status));
  const sourceErrors = unavailable.some(b => ['error', 'rate_limited'].includes(b!.result!.status));
  const activeFilters = Object.values(filters).filter(Boolean).length;
  const card = (item: Listing) => <ModCard key={item.key} item={item} saved={local.favorites.some(f => f.key === item.key)} toggleSave={() => save(item)} open={() => void visit(item.url)} detail={() => setDetail(item)} />;
  const renderGroup = (group: { id: string; listings: Listing[] }) => card(group.listings[0]);
  return <div className={`app-shell ${page === 'discover' && hasSearch ? 'has-results' : ''} ${gamePicker || filterOpen ? 'is-choosing' : ''} ${menuOpen ? 'is-menu-open' : ''}`}><svg width="0" height="0" aria-hidden="true" style={{ position:'absolute',pointerEvents:'none' }}><defs><linearGradient id="theme-icon-gradient" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="24" y2="24"><stop stopColor="var(--accent)"/><stop offset="1" stopColor="var(--cyan)"/></linearGradient></defs></svg><Atmosphere gameIds={scopeGames.map(g => g.id)} theme={accent} motionEnabled={page === 'discover'} scrollParallax={page === 'discover' && hasSearch} />
    <div className="settings-fab-wrap">
      <button type="button" className="settings-fab" aria-label={t("설정 메뉴")} aria-expanded={menuOpen} title={t("설정 메뉴")} onClick={() => setMenuOpen(value => !value)}><Settings2 size={25} /></button>
      {menuOpen && <SettingsMenu close={() => setMenuOpen(false)} themeOptions={themeControls} languageOptions={<div className="language-options"><button type="button" aria-pressed={languagePreference === 'auto'} onClick={() => changeLanguage('auto')}>{t('자동 선택')}{languagePreference === 'auto' && <Check size={18}/>}</button>{LANGUAGES.map(language => <button type="button" key={language.id} lang={language.id} aria-pressed={languagePreference === language.id} onClick={() => changeLanguage(language.id)}>{language.name}{languagePreference === language.id && <Check size={18}/>}</button>)}</div>}>
        <button type="button" onClick={() => go('discover')}><Compass size={34} /><span>{t("모드 둘러보기")}</span></button>
        <button type="button" onClick={() => go('favorites')}><Bookmark size={34} /><span>{t("즐겨찾기")}</span></button>
        <button type="button" onClick={() => go('recent')}><History size={34} /><span>{t("최근 기록")}</span></button>
      </SettingsMenu>}
    </div>
    <main className="main">
      <div className="content">
      {page === 'discover' && hasSearch && <div className="results-brand" role="img" aria-label="Mod Finder"><BrandLogo size={96} /></div>}
      <div className={page === 'discover' && hasSearch ? 'results-section search-results-panel' : 'search-results-wrapper'}>
      {page === 'discover' && hasSearch && <ResultPanelOutline/>}
      <div className={`search-dock ${heroSearch ? 'hero' : 'compact'}`}><div ref={searchRowRef} className="search-row">{heroSearch && <div className="hero-brand" role="img" aria-label="Mod Finder"><BrandLogo size={160} /></div>}<form className="search-box" onSubmit={e => { e.preventDefault(); if (window.matchMedia("(pointer: coarse), (max-width: 650px)").matches) inputRef.current?.blur(); submit(); }}><button type="button" className="game-orb" style={{ '--game-color': game?.color ?? '#a78bfa' } as React.CSSProperties} aria-label={t("게임 바꾸기")} title={t("게임 바꾸기")} aria-expanded={gamePicker} onClick={() => setGamePicker(value => !value)}><GameLogo gameId={gameId} /></button><label className="sr-only" htmlFor="mod-query">{t("모드 검색어")}</label><input ref={inputRef} id="mod-query" enterKeyHint="search" value={input} maxLength={200} onChange={e => setInput(e.target.value)} placeholder={t('검색할 모드를 입력하세요.')} autoComplete="off" /><button ref={searchButtonRef} type="submit" className="search-submit" aria-label={t("모드 검색")}><ArrowRight size={18} aria-hidden="true" /></button></form><button type="button" className={`filter-orb ${filterOpen || activeFilters ? 'active' : ''}`} aria-label={t("검색 필터")} aria-expanded={filterOpen} onClick={() => setFilterOpen(value => !value)}><SlidersHorizontal size={18}/></button></div>

      </div>
      {page === 'discover' && hasSearch && <section className="results-content" key={`${gameId}:${query}`} aria-label={t("검색 결과")}>
        {Object.values(search.buckets).some(b => b?.result?.unsupportedFilters.length) && <p className="filter-warning">{t('일부 출처에는 {filters} 필터가 적용되지 않았어요.', { filters: Array.from(new Set(Object.values(search.buckets).flatMap(b => b?.result?.unsupportedFilters ?? []))).map(f => FILTER_NAMES[f]).join(', ') })}</p>}
        {groups.length > 0 && <div className="mod-grid">{groups.map(renderGroup)}</div>}
        {search.loading && !search.items.length && <div className="results-loading" role="status" aria-label={t("검색 중")}><span className="results-spinner" aria-hidden="true" /></div>}
        {!search.loading && !search.items.length && <div className="empty-state"><Search size={30} /><h3>{sourceErrors ? t("잠시 검색에 연결하지 못했어요") : unavailable.length && !completed ? t("원본 사이트에서 탐색을 이어가세요") : t("검색 결과가 없어요")}</h3><p>{sourceErrors ? t("다시 검색하거나 아래 원본 사이트에서 탐색을 이어갈 수 있어요.") : unavailable.length && !completed ? t("이 게임의 검색 연동을 준비하고 있어요. 아래 출처에서 모드를 찾아보세요.") : t("모드의 원래 이름으로 검색하거나 필터를 조금 줄여 보세요.")}</p>{completed > 0 && activeFilters > 0 && <button className="secondary-button" onClick={resetFilters}>{t("필터 초기화")}</button>}</div>}

        {search.hasMore && <div className="load-more"><button className="secondary-button" onClick={search.loadMore} disabled={search.loading}>{search.loading ? <LoaderCircle size={17} className="spin" /> : <ChevronDown size={17} />} {t("모드 더 보기")}</button></div>}
      </section>}
      </div>
      {page === 'favorites' && <><div className="page-heading"><h1>{t("즐겨찾기")}</h1></div>{visible.length ? <div className="mod-grid">{visible.map(card)}</div> : <div className="empty-state spacious icon-only" role="img" aria-label={t("아직 저장한 모드가 없어요")}><Bookmark size={35} aria-hidden="true" /></div>}</>}
      {page === 'recent' && <><div className="page-heading"><h1>{t("최근 검색")}</h1></div><div className="history-list">{local.history.length ? <><div className="list-heading"><span>{t('최근 {count}개 검색', { count: local.history.length })}</span><button className="text-button" onClick={() => setLocal(prev => ({ ...prev, history: [] }))}>{t("검색 기록 지우기")}</button></div>{local.history.map((h, i) => <button key={`${h.gameId}:${h.genre ?? 'all'}:${h.category ?? ''}:${h.query}`} onClick={() => submit(h.query, h.gameId, h.genre ?? 'all', h.category ?? '')}><span className="history-number">{String(i + 1).padStart(2, '0')}</span><Search size={18} /><strong>{h.query}</strong><span>{gameName(h.gameId)}{h.category ? ` · ${getCategory(h.gameId, h.category)?.[locale === 'ko' ? 'ko' : 'en'] ?? ''}` : ''}{h.genre && h.genre !== 'all' ? ` · ${GENRES.find(g => g.id === h.genre)?.[locale === 'ko' ? 'ko' : 'en'] ?? ''}` : ''}</span><ArrowUpRight size={18} /></button>)}</> : <div className="empty-state spacious icon-only" role="img" aria-label={t("새로운 발견을 시작해 보세요")}><History size={34} aria-hidden="true" /></div>}</div></>}
      </div>
    </main>
    <nav className="mobile-nav" aria-label={t("모바일 메뉴")}>{([{ id: 'discover', label: t("탐색"), icon: Compass }, { id: 'favorites', label: t("즐겨찾기"), icon: Bookmark }, { id: 'recent', label: t("최근 검색"), icon: History }, { id: 'settings', label: t("설정"), icon: Settings2 }] as const).map(n => <button key={n.id} className={n.id !== 'settings' && page === n.id ? 'active' : ''} onClick={() => n.id === 'settings' ? setMenuOpen(value => !value) : go(n.id)}><n.icon size={21} />{n.label}</button>)}</nav>
    {compared.length > 0 && <div className="compare-tray"><GitCompareArrows size={19} /><strong>{t('{count}개 모드 선택', { count: compared.length })}</strong><span className="tray-names">{compared.map(item => item.title).join(' · ')}</span><button className="primary-button" onClick={() => setCompareOpen(true)}>{t("비교하기")} <ArrowRight size={15} /></button><button className="icon-button" aria-label={t("비교 선택 초기화")} onClick={() => { setCompared([]); setCompareOpen(false); }}><X size={18} /></button></div>}
      {filterOpen && <GameDeck genreMode sort={sort} setSort={setSort} filters={filters} changeFilter={changeFilter} showMinecraftFilters={gameId === 'minecraft-java'} steamSort={gameId === 'all' ? 'mixed' : game?.sources.steam ? Object.keys(game.sources).length === 1 ? 'only' : 'mixed' : 'none'} categories={gameId === 'all' ? undefined : categoriesForGame(gameId)} gameId={gameId === 'all' ? genre : filters.category ?? 'all'} select={id => { setFilterOpen(false); if (gameId === 'all') { setGenre(id); } else { changeFilter('category', id === 'all' ? '' : id); setPage('discover'); } }} close={() => setFilterOpen(false)} />}
      {gamePicker && <GameDeck gameId={gameId} select={chooseGame} close={() => setGamePicker(false)} />}
    {compareOpen && <Modal title={t("모드 비교")} close={() => setCompareOpen(false)} wide><p className="modal-intro">{t("출처마다 제공하는 정보와 통계의 기준이 달라요. 호환 여부는 원본 페이지에서 확인해 주세요.")}</p><div className="comparison-scroll"><table className="comparison-table"><thead><tr><th>{t("비교 항목")}</th>{compared.map(item => <th key={item.key}><ModIcon item={item} />{listingText(item, locale).title}</th>)}</tr></thead><tbody>{([[t("게임"), (i: Listing) => getGame(i.gameId)?.name], [t("출처"), (i: Listing) => SOURCE_NAMES[i.source]], [t("제작자"), (i: Listing) => i.author ?? t("정보 없음")], [t("설명"), (i: Listing) => listingText(i, locale).summary || t("정보 없음")], [t("게임 버전"), (i: Listing) => i.versions?.join(', ') || t("정보 없음")], [t("로더"), (i: Listing) => i.loaders?.join(', ') || t("정보 없음")], [t("업데이트"), (i: Listing) => dateLabel(i.updatedAt)], [t("통계"), (i: Listing) => i.metrics.map(m => `${t(m.label)} ${m.value.toLocaleString(locale)}`).join(' · ') || t("정보 없음")]] as const).map(([label, format]) => <tr key={label}><th>{label}</th>{compared.map(item => <td key={item.key}><span className="cell-scroll">{format(item)}</span></td>)}</tr>)}<tr><th>{t("원본 링크")}</th>{compared.map(item => <td key={item.key}><button className="external-link" onClick={() => void visit(item.url)}>{t("사이트에서 보기")} <ArrowUpRight size={14} /></button></td>)}</tr></tbody></table></div></Modal>}
    {detail && <Sheet title={listingText(detail, locale).title} close={() => setDetail(null)}><div className="detail-cover" style={{ '--game-color': getGame(detail.gameId)?.color ?? '#6d5cff' } as React.CSSProperties}><ModIcon item={detail} /><div><span className="source-label"><SourceMark source={detail.source} />{SOURCE_NAMES[detail.source]}</span><p>by {detail.author ?? t("제작자 정보 없음")}</p></div></div><p className="detail-description">{listingText(detail, locale).summary || t("원본 사이트에서 자세한 설명을 확인해 주세요.")}</p>{listingText(detail, locale).translated && <details className="original-copy"><summary>{t('원문 보기')}</summary><strong>{detail.title}</strong><p>{detail.summary}</p></details>}<dl className="detail-info"><dt>{t("게임")}</dt><dd>{gameName(detail.gameId)}</dd><dt>{t("게임 버전")}</dt><dd><span className="cell-scroll">{detail.versions?.join(', ') || t("정보 없음")}</span></dd><dt>{t("로더")}</dt><dd>{detail.loaders?.join(', ') || t("정보 없음")}</dd><dt>{t("업데이트")}</dt><dd>{dateLabel(detail.updatedAt)}</dd><dt>{t("조회 시각")}</dt><dd>{new Date(detail.fetchedAt).toLocaleString(locale)}</dd></dl><p className="detail-note">{t("버전 정보가 표시되어도 다른 모드와의 호환성을 보장하지 않아요.")}</p><div className="modal-actions">{canPersistListing(detail) && <button className="secondary-button" onClick={() => save(detail)}><Bookmark size={16} />{local.favorites.some(f => f.key === detail.key) ? t("저장 해제") : t("즐겨찾기")}</button>}<button className="primary-button" onClick={() => void visit(detail.url)}>{t("원본 사이트에서 보기")} <ArrowUpRight size={16} /></button></div></Sheet>}
    {toast && <div className="toast" role="status"><Check size={17} />{toast}<button className="icon-button" onClick={() => setToast('')} aria-label={t("알림 닫기")}><X size={15} /></button></div>}
  </div>;
}
