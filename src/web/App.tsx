import { recordInterest } from './lib/preferences';
import { t, locale, languagePreference, changeLanguage, useLocale } from './lib/i18n';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Bookmark, Check, ChevronDown, GitCompareArrows, History, LoaderCircle, RefreshCw, Search, Settings2, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { categoriesForGame, getCategory } from '../shared/categories';
import { GENRES, gamesInScope, getGame } from '../shared/games';
import { SOURCE_NAMES, type Filters, type Listing, type Sort } from '../shared/types';
import { dateLabel, GameLogo, ModCard, ModIcon, Modal, Sheet, SourceMark } from './components';
import { useSearch } from './lib/search';
import { canPersistListing, emptyLocalData, loadLocalData, saveLocalData, shortcutFavorites, toggleFavorite, refreshFavoriteReferences, mergeFavoriteReferences, validListing, type LocalData } from './lib/storage';
import { favoriteDetails } from './lib/api';
import { detailReference } from './lib/detail-reference';
import { FolderBar, MoveFavorite } from './Favorites';
import { Rankings } from './Rankings';
import { Recommendations } from './Recommendations';
import { openExternal } from './lib/platform';
import { Atmosphere } from './Atmosphere';
import { BrandLogo } from './BrandLogo';
import { ResultPanelOutline } from './ResultPanelOutline';
import { GameDeck } from './GameDeck';
import { THEMES as PALETTES, applyTheme } from './lib/themes';
import { CardPages } from './CardPages';
import { SettingsMenu } from './SettingsMenu';
import { LANGUAGES } from '../shared/locale';
import { listingText } from '../shared/content';
import { useModSummaries } from './lib/mod-summaries';
import { useMobileLayout } from './lib/mobile-layout';
import { useNavigation } from './lib/use-navigation';
import type { Page } from './lib/navigation';
import { searchRecoveryLinks } from './lib/search-recovery';

export default function App() {
  useLocale();
  const FILTER_NAMES: Record<string, string> = { version: t("게임 버전"), loader: t("로더"), kind: t("종류"), category: t("장르") };
  const THEMES = PALETTES.map(theme => ({ ...theme, name:locale === 'ko' ? theme.ko : theme.en }));
  const mobileLayout = useMobileLayout();
  const [headerScrolled, setHeaderScrolled] = useState(() => window.scrollY > 24);
  useEffect(() => {
    if (!mobileLayout) return;
    const sync = () => setHeaderScrolled(window.scrollY > 24);
    sync();
    window.addEventListener('scroll', sync, { passive: true });
    return () => window.removeEventListener('scroll', sync);
  }, [mobileLayout]);
  const { state: navigation, navigate, restoration, detailKey, openDetail, closeDetail, discardDetail } = useNavigation();
  const { page, gameId, genre, query, submitted, filters, categories: selectedCategories, sort, folder: selectedFolder } = navigation;
  const [input, setInput] = useState(query);
  useEffect(() => setInput(query), [query, restoration]);
  const [filterOpen, setFilterOpen] = useState(false);
  const setSelectedFolder = (folder: string) => navigate({ folder });
  const setSort = (value: Sort) => navigate({ sort: value, submitted: true, page: 'discover' });
  const [movingFavorite, setMovingFavorite] = useState<string | null>(null);
  const [local, setLocal] = useState<LocalData>(emptyLocalData); const [hydrated, setHydrated] = useState(false);
  const compared = local.compared;
  const setCompared = (next: Listing[] | ((prev: Listing[]) => Listing[])) => setLocal(prev => ({ ...prev, compared: typeof next === 'function' ? next(prev.compared) : next })); const [compareOpen, setCompareOpen] = useState(false);
  const interestGeneration = useRef(0);
  const viewedDetails = useRef(new Map<string, Listing>());
  const viewedAlternatives = useRef(new Map<string, Listing[]>());
  const [, refreshDetail] = useState(0);
  const detail = detailKey ? viewedDetails.current.get(detailKey) ?? null : null;
  const showDetail = (item: Listing, alternatives: Listing[] = [item]) => { viewedDetails.current.set(item.key, item); viewedAlternatives.current.set(item.key, alternatives); openDetail(item.key); };
  useEffect(() => {
    if (!detailKey || viewedDetails.current.has(detailKey)) return;
    const reference = detailReference(detailKey);
    if (!reference) { discardDetail(); return; }
    const controller = new AbortController();
    void favoriteDetails(reference, controller.signal).then(item => {
      if (controller.signal.aborted) return;
      if (!validListing(item) || item.key !== detailKey || item.gameId !== reference.gameId) { discardDetail(); return; }
      viewedDetails.current.set(item.key, item); refreshDetail(value => value + 1);
    }).catch(() => { if (!controller.signal.aborted) discardDetail(); });
    return () => controller.abort();
  }, [detailKey, discardDetail]);
  const [gamePicker, setGamePicker] = useState(false); const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { setMenuOpen(false); setFilterOpen(false); setGamePicker(false); setMovingFavorite(null); setCompareOpen(false); }, [restoration]);
  const [accent, setAccent] = useState(() => {
    try { const saved = localStorage.getItem('modfinder-accent'); if (THEMES.some(theme => theme.id === saved)) return saved!; } catch { /* Optional storage. */ }
    return 'magenta';
  });
  const [toast, setToast] = useState('');
  const returnHome = () => { navigate({ page: 'discover', query: '', submitted: false, filters: {}, categories: [] }); setInput(''); setMenuOpen(false); setFilterOpen(false); setGamePicker(false); };
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
  const themeControls = <div className="theme-options"><CardPages columns={3}>{THEMES.map(theme => <button type="button" key={theme.id} aria-pressed={accent === theme.id} onClick={() => setAccent(theme.id)}><i style={{ background: theme.grad }} />{theme.name}{accent === theme.id && <Check size={14} />}</button>)}</CardPages></div>;
  const hasSearch = submitted || selectedCategories.length > 0 || Object.values(filters).some(Boolean) || (gameId === 'all' && genre !== 'all');
  const search = useSearch({ gameId, genre, query, filters, categories: selectedCategories, selectedSource: 'all', sort }, false, hasSearch && page === 'discover');
  useModSummaries([...(gameId === 'all' ? search.items.map(item => item.gameId) : [gameId]), ...local.favorites.map(item => item.gameId), ...compared.map(item => item.gameId), ...(detail ? [detail.gameId] : [])], locale === 'ko');
  useEffect(() => {
    const controller = new AbortController();
    void loadLocalData().then(async data => {
      if (controller.signal.aborted) return;
      setLocal(data); setHydrated(true);
      const refreshed = await refreshFavoriteReferences(data, item => favoriteDetails(item, controller.signal));
      if (!controller.signal.aborted) setLocal(current => mergeFavoriteReferences(current, data, refreshed));
    }).catch(() => { if (!controller.signal.aborted) setToast(t("저장된 정보를 읽지 못했어요. 저장 공간을 확인해 주세요.")); });
    return () => controller.abort();
  }, []);
  useEffect(() => { if (hydrated) void saveLocalData(local).catch(() => setToast(t("변경사항을 저장하지 못했어요. 저장 공간을 확인해 주세요."))); }, [local, hydrated]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4000); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => { applyTheme(accent); try { localStorage.setItem('modfinder-accent', accent); } catch { /* Theme persistence is optional. */ } }, [accent]);
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); if ((event.ctrlKey || event.metaKey) && event.key === 'k') { event.preventDefault(); navigate({ page: 'discover' }); inputRef.current?.focus(); } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [navigate]);
  const chooseGame = (id: string, nextGenre = 'all') => { if (hydrated) setLocal(prev => prev.recommendationsEnabled ? { ...prev, interests: recordInterest(prev.interests, id) } : prev); navigate({ gameId: id, genre: nextGenre, filters: {}, categories: [], page: 'discover' }); setGamePicker(false); if (!matchMedia('(pointer: coarse), (max-width: 850px)').matches) requestAnimationFrame(() => inputRef.current?.focus()); };
  const submit = (value = input, id = gameId, selectedGenre = genre, categories = id === gameId ? selectedCategories : [], kind?: string, clearFilters = false) => {
    const next = value.trim().slice(0, 200); setInput(next); setMenuOpen(false);
    const nextFilters = kind ? { kind } : clearFilters || id !== gameId || selectedGenre !== genre ? {} : filters;
    navigate({ page: 'discover', gameId: id, genre: selectedGenre, query: next, submitted: true, categories, filters: nextFilters });
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (next && hydrated) setLocal(prev => ({ ...prev, interests: prev.recommendationsEnabled ? recordInterest(prev.interests, id, next) : prev.interests, history: [{ gameId: id, genre: selectedGenre, query: next, ...(categories.length ? { categories } : {}) }, ...prev.history.filter(item => item.query !== next || item.gameId !== id || (item.genre ?? 'all') !== selectedGenre || JSON.stringify(item.categories ?? (item.category ? [item.category] : [])) !== JSON.stringify(categories))].slice(0, 20) }));
    if (next === query && id === gameId && selectedGenre === genre) search.retry();
  };
  const visit = async (url: string, item?: Listing) => { const generation = interestGeneration.current; try { await openExternal(url); if (item && hydrated && generation === interestGeneration.current) setLocal(prev => prev.recommendationsEnabled ? { ...prev, interests: recordInterest(prev.interests, item.gameId, "", item) } : prev); } catch { setToast(t("링크를 열지 못했어요. 주소를 확인해 주세요.")); } };
  const save = (item: Listing) => { if (!hydrated) return; setLocal(prev => ({ ...toggleFavorite(prev, item), interests: !prev.recommendationsEnabled || prev.favorites.some(favorite => favorite.key === item.key) ? prev.interests : recordInterest(prev.interests, item.gameId, '', item) })); setToast(local.favorites.some(favorite => favorite.key === item.key) ? t('즐겨찾기를 해제했어요.') : t('즐겨찾기에 저장했어요.')); };
  const changeFilter = (key: keyof Filters, value: string) => navigate(prev => { const next = { ...prev.filters }; if (value) next[key] = value; else delete next[key]; return { ...prev, filters: next }; });
  const resetFilters = () => navigate({ filters: {}, categories: [] });
  const go = (target: Page) => { navigate({ page: target }); setMenuOpen(false); };
  const heroSearch = page === 'discover' && !hasSearch;
  const favoriteFolder = local.folders.find(folder => folder.id === selectedFolder);
  const visible = favoriteFolder ? local.favorites.filter(item => favoriteFolder.keys.includes(item.key)) : local.favorites;
  const shortcuts = shortcutFavorites(local);
  const groups = page === 'favorites' ? local.favorites.map(item => ({ id: item.key, listings: [item] })) : search.groups;

  const completed = Object.values(search.buckets).filter(b => b?.result && ['success', 'empty'].includes(b.result.status)).length;
  const unavailable = Object.values(search.buckets).filter(b => b?.result && !['success', 'empty'].includes(b.result.status));
  const sourceErrors = unavailable.some(b => ['error', 'rate_limited'].includes(b!.result!.status));
  const recoveryLinks = searchRecoveryLinks(Object.values(search.buckets));
  const activeFilters = Object.values(filters).filter(Boolean).length + selectedCategories.length;
  const saveCandidate = (item: Listing, alternatives: Listing[] = []) => local.favorites.find(saved => [item, ...alternatives].some(candidate => candidate.key === saved.key)) ?? item;
  const card = (item: Listing, alternatives: Listing[] = [], select?: () => void) => {
    const candidate = saveCandidate(item, alternatives);
    return <ModCard key={item.key} item={item} ready={hydrated} saveAvailable={!!candidate} visit={() => void visit(item.url, item)} saved={!!candidate && local.favorites.some(f => f.key === candidate.key)} toggleSave={() => { if (candidate) save(candidate); }} select={select ?? (() => showDetail(item, alternatives))} move={page === 'favorites' ? () => setMovingFavorite(item.key) : undefined} />;
  };
  const renderGroup = (group: { id: string; listings: Listing[] }) => card(group.listings[0], group.listings);
  const detailAlternatives = detail ? viewedAlternatives.current.get(detail.key) ?? search.groups.find(group => group.listings.some(item => item.key === detail.key))?.listings ?? [detail] : [];
  const detailCandidate = detail ? saveCandidate(detail, detailAlternatives) : undefined;
  const detailCompared = !!detail && compared.some(item => item.key === detail.key);
  const toggleComparison = (item: Listing) => {
    if (!hydrated || !canPersistListing(item)) return;
    if (!compared.some(candidate => candidate.key === item.key) && compared.length >= 3) { setToast(t('한 번에 최대 3개까지 비교할 수 있어요.')); return; }
    setCompared(previous => previous.some(candidate => candidate.key === item.key) ? previous.filter(candidate => candidate.key !== item.key) : previous.length < 3 ? [...previous, item] : previous);
  };
  const settingsControl = <button type="button" className="settings-fab" aria-label={t("설정 메뉴")} aria-expanded={menuOpen} title={t("설정 메뉴")} onClick={() => setMenuOpen(value => !value)}><Settings2 size={25} /></button>;
  const filterControl = <button type="button" className={`filter-orb ${filterOpen || activeFilters ? 'active' : ''}`} aria-label={t("검색 필터")} aria-expanded={filterOpen} onClick={() => setFilterOpen(value => !value)}><SlidersHorizontal size={18}/></button>;
  return <div className={`app-shell ${page === 'discover' && hasSearch ? 'has-results' : ''} ${gamePicker || filterOpen ? 'is-choosing' : ''} ${menuOpen ? 'is-menu-open' : ''}`}><svg width="0" height="0" aria-hidden="true" style={{ position:'absolute',pointerEvents:'none' }}><defs><linearGradient id="theme-icon-gradient" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="24" y2="24"><stop stopColor="var(--accent)"/><stop offset="1" stopColor="var(--cyan)"/></linearGradient></defs></svg><Atmosphere gameIds={scopeGames.map(g => g.id)} theme={accent} motionEnabled={page === 'discover'} scrollParallax={page === 'discover' && hasSearch} />
    <div className="settings-fab-wrap">
      {!mobileLayout && settingsControl}
      {menuOpen && <SettingsMenu close={() => setMenuOpen(false)} themeOptions={themeControls} languageOptions={<div className="language-options"><CardPages columns={3}><button type="button" aria-pressed={languagePreference === 'auto'} onClick={() => changeLanguage('auto')}>{t('자동 선택')}{languagePreference === 'auto' && <Check size={18}/>}</button>{LANGUAGES.map(language => <button type="button" key={language.id} lang={language.id} aria-pressed={languagePreference === language.id} onClick={() => changeLanguage(language.id)}>{language.name}{languagePreference === language.id && <Check size={18}/>}</button>)}</CardPages></div>}>
        <button type="button" onClick={() => go('favorites')}><Bookmark size={34} /><span>{t("즐겨찾기")}</span></button>
        <button type="button" onClick={() => go('recent')}><History size={34} /><span>{t("최근 기록")}</span></button>
        <button type="button" role="switch" aria-checked={!!local.recommendationsEnabled} aria-label={t("맞춤 추천")} disabled={!hydrated} onClick={() => setLocal(prev => ({ ...prev, recommendationsEnabled: !prev.recommendationsEnabled }))}><Sparkles size={34}/><span>{t("맞춤 추천")}</span><span className="recommendations-switch" aria-hidden="true"/></button>
      </SettingsMenu>}
    </div>
    {mobileLayout && <header className={`mobile-header ${headerScrolled ? 'is-scrolled' : ''}`}>
      {headerScrolled && <div className="mobile-nav-glass" aria-hidden="true"/>}
      <nav className="mobile-nav" aria-label={t('메인 메뉴')}>{settingsControl}<button type="button" className="page-brand home-logo" aria-label={t('메인 화면으로 이동')} onClick={returnHome}><BrandLogo size={96}/></button>{filterControl}</nav>
    </header>}
    <main className="main">
      <div className={`content ${page !== 'discover' ? 'collection-content' : ''}`}><div className={page !== 'discover' ? 'collection-stage' : 'discover-stage'}>
      {!mobileLayout && page === 'discover' && hasSearch && <button type="button" className="results-brand home-logo" aria-label={t('메인 화면으로 이동')} onClick={returnHome}><BrandLogo size={96} /></button>}
      <div className={page === 'discover' && hasSearch ? 'results-section search-results-panel' : 'search-results-wrapper'}>
      {page === 'discover' && hasSearch && <ResultPanelOutline/>}
      <div className={`search-dock ${heroSearch ? 'hero' : 'compact'}`}><div ref={searchRowRef} className="search-row">{!mobileLayout && page !== 'discover' && <button type="button" className="collection-brand home-logo" aria-label={t('메인 화면으로 이동')} onClick={returnHome}><BrandLogo size={76}/></button>}{!mobileLayout && heroSearch && <div className="hero-brand" role="img" aria-label="Mod Finder"><BrandLogo size={160}/></div>}<form className="search-box" onSubmit={e => { e.preventDefault(); if (window.matchMedia("(pointer: coarse), (max-width: 850px)").matches) inputRef.current?.blur(); submit(); }}><button type="button" className="game-orb" style={{ '--game-color': game?.color ?? '#a78bfa' } as React.CSSProperties} aria-label={t("게임 바꾸기")} title={t("게임 바꾸기")} aria-expanded={gamePicker} onClick={() => setGamePicker(value => !value)}><GameLogo gameId={gameId} /></button><label className="sr-only" htmlFor="mod-query">{t("모드 검색어")}</label><input ref={inputRef} id="mod-query" type="search" inputMode="search" enterKeyHint="search" name="q" value={input} maxLength={200} onChange={e => setInput(e.target.value)} placeholder={t('검색할 모드를 입력하세요.')} autoComplete="off" /><button ref={searchButtonRef} type="submit" className="search-submit" aria-label={t("모드 검색")}><ArrowRight size={18} aria-hidden="true" /></button></form>{!mobileLayout && filterControl}</div>
      {heroSearch && <div className="home-collections">
      <Rankings key={gameId} gameId={gameId} card={card} searchMod={entry => submit(entry.name, gameId, 'all', [], entry.kind === 'modpack' && gameId === 'minecraft-java' ? 'modpack' : undefined, true)}/>
      {hydrated && shortcuts.length > 0 && <nav className="home-shortcuts" aria-label={t('메인 화면 바로가기')}>{shortcuts.map(item => <a key={item.key} href={item.url} target="_blank" rel="noopener noreferrer" title={listingText(item, locale).title} onClick={event => { event.preventDefault(); void visit(item.url, item); }}><ModIcon item={item}/><span>{listingText(item, locale).title}</span></a>)}</nav>}
      </div>}
      </div>
      {page === 'discover' && hasSearch && <section className="results-content" key={`${gameId}:${query}`} aria-label={t("검색 결과")}>
        {hydrated && local.recommendationsEnabled && <Recommendations gameId={gameId} interests={local.interests ?? []} select={showDetail}/>}
        {Object.values(search.buckets).some(b => b?.result?.unsupportedFilters.length) && <p className="filter-warning">{t('일부 출처에는 {filters} 필터가 적용되지 않았어요.', { filters: Array.from(new Set(Object.values(search.buckets).flatMap(b => b?.result?.unsupportedFilters ?? []))).map(f => FILTER_NAMES[f]).join(', ') })}</p>}
        {groups.length > 0 && <div className="mod-grid">{groups.map(renderGroup)}</div>}
        {search.loading && !search.items.length && <div className="results-loading" role="status" aria-label={t("검색 중")}><span className="results-spinner" aria-hidden="true" /></div>}
        {!search.loading && !search.items.length && <div className="empty-state"><Search size={30} /><h3>{sourceErrors ? t("잠시 검색에 연결하지 못했어요") : unavailable.length && !completed ? t("원본 사이트에서 탐색을 이어가세요") : t("검색 결과가 없어요")}</h3><p>{sourceErrors ? t("다시 검색하거나 아래 원본 사이트에서 탐색을 이어갈 수 있어요.") : unavailable.length && !completed ? t("이 게임의 검색 연동을 준비하고 있어요. 아래 출처에서 모드를 찾아보세요.") : t("모드의 원래 이름으로 검색하거나 필터를 조금 줄여 보세요.")}</p>{completed > 0 && activeFilters > 0 && <button className="secondary-button" onClick={resetFilters}>{t("필터 초기화")}</button>}</div>}

        {!search.loading && unavailable.length > 0 && <div className="search-recovery" role="group" aria-label={t('다시 검색')}>
          {sourceErrors && <button type="button" className="secondary-button" onClick={search.retry}><RefreshCw size={16}/>{t('다시 시도')}</button>}
          {recoveryLinks.map(link => <a key={link.url} className="secondary-button" href={link.url} target="_blank" rel="noopener noreferrer" onClick={event => { event.preventDefault(); void visit(link.url); }}>{SOURCE_NAMES[link.source]}{scopeGames.length > 1 && ` · ${gameName(link.gameId)}`}<ArrowUpRight size={16}/></a>)}
        </div>}
        {search.hasMore && <div className="load-more"><button className="secondary-button" onClick={search.loadMore} disabled={search.loading}>{search.loading ? <LoaderCircle size={17} className="spin" /> : <ChevronDown size={17} />} {t("모드 더 보기")}</button></div>}
      </section>}
      </div>
      {page === 'favorites' && <section className="collection-panel"><div className="page-heading"><h1>{t("즐겨찾기")}</h1></div>{hydrated && <FolderBar data={local} update={setLocal} selected={selectedFolder} select={setSelectedFolder}/>} {visible.length ? <div className="mod-grid">{visible.map(item => card(item))}</div> : mobileLayout ? <Bookmark className="favorites-empty-icon" size={35} role="img" aria-label={t("아직 저장한 모드가 없어요")} /> : <div className="empty-state spacious icon-only" role="img" aria-label={t("아직 저장한 모드가 없어요")}><Bookmark size={35} aria-hidden="true" /></div>}</section>}
      {page === 'recent' && <><div className="page-heading"><h1>{t("최근 검색")}</h1></div><div className="history-list">{(local.history.length || local.interests?.length) ? <><div className="list-heading"><span>{t('최근 {count}개 검색', { count: local.history.length })}</span><button className="text-button" onClick={() => { interestGeneration.current++; setLocal(prev => ({ ...prev, history: [], interests: [] })); }}>{t("검색 기록 지우기")}</button></div>{local.history.map((h, i) => <button key={`${h.gameId}:${h.genre ?? 'all'}:${JSON.stringify(h.categories ?? h.category ?? '')}:${h.query}`} onClick={() => submit(h.query, h.gameId, h.genre ?? 'all', h.categories ?? (h.category ? [h.category] : []))}><span className="history-number">{String(i + 1).padStart(2, '0')}</span><Search size={18} /><strong>{h.query}</strong><span>{gameName(h.gameId)}{(h.categories ?? (h.category ? [h.category] : [])).map(id => ` · ${getCategory(h.gameId, id)?.[locale === 'ko' ? 'ko' : 'en'] ?? ''}`).join('')}{h.genre && h.genre !== 'all' ? ` · ${GENRES.find(g => g.id === h.genre)?.[locale === 'ko' ? 'ko' : 'en'] ?? ''}` : ''}</span><ArrowUpRight size={18} /></button>)}</> : <div className="empty-state spacious icon-only" role="img" aria-label={t("새로운 발견을 시작해 보세요")}><History size={34} aria-hidden="true" /></div>}</div></>}
      </div></div>
    </main>
    {compared.length > 0 && <div className="compare-tray"><GitCompareArrows size={19} /><strong>{t('{count}개 모드 선택', { count: compared.length })}</strong><span className="tray-names">{compared.map(item => item.title).join(' · ')}</span><button className="primary-button" onClick={() => setCompareOpen(true)}>{t("비교하기")} <ArrowRight size={15} /></button><button className="icon-button" aria-label={t("비교 선택 초기화")} onClick={() => { setCompared([]); setCompareOpen(false); }}><X size={18} /></button></div>}
      {filterOpen && <GameDeck genreMode sort={sort} setSort={setSort} filters={filters} changeFilter={changeFilter} showMinecraftFilters={gameId === 'minecraft-java'} steamSort={gameId === 'all' ? 'mixed' : game?.sources.steam ? Object.keys(game.sources).length === 1 ? 'only' : 'mixed' : 'none'} categories={gameId === 'all' ? undefined : categoriesForGame(gameId)} selectedCategories={gameId === 'all' ? undefined : selectedCategories} gameId={gameId === 'all' ? genre : 'all'} select={id => { if (gameId === 'all') { navigate({ genre: id }); setFilterOpen(false); } else { navigate(previous => ({ ...previous, categories: id === 'all' ? [] : previous.categories.includes(id) ? previous.categories.filter(value => value !== id) : [...previous.categories, id], page: 'discover' })); } }} close={() => setFilterOpen(false)} />}
      {gamePicker && <GameDeck gameId={gameId} select={chooseGame} close={() => setGamePicker(false)} />}
    {compareOpen && <Modal title={t("모드 비교")} close={() => setCompareOpen(false)} wide><p className="modal-intro">{t("출처마다 제공하는 정보와 통계의 기준이 달라요. 호환 여부는 원본 페이지에서 확인해 주세요.")}</p><div className="comparison-scroll"><table className="comparison-table"><thead><tr><th>{t("비교 항목")}</th>{compared.map(item => <th key={item.key}><ModIcon item={item} />{listingText(item, locale).title}</th>)}</tr></thead><tbody>{([[t("게임"), (i: Listing) => getGame(i.gameId)?.name], [t("출처"), (i: Listing) => SOURCE_NAMES[i.source]], [t("제작자"), (i: Listing) => i.author ?? t("정보 없음")], [t("설명"), (i: Listing) => listingText(i, locale).summary || t("정보 없음")], [t("게임 버전"), (i: Listing) => i.versions?.join(', ') || t("정보 없음")], [t("로더"), (i: Listing) => i.loaders?.join(', ') || t("정보 없음")], [t("업데이트"), (i: Listing) => dateLabel(i.updatedAt)], [t("통계"), (i: Listing) => i.metrics.map(m => `${t(m.label)} ${m.value.toLocaleString(locale)}`).join(' · ') || t("정보 없음")]] as const).map(([label, format]) => <tr key={label}><th>{label}</th>{compared.map(item => <td key={item.key}><span className="cell-scroll">{format(item)}</span></td>)}</tr>)}<tr><th>{t("원본 링크")}</th>{compared.map(item => <td key={item.key}><button className="external-link" onClick={() => void visit(item.url, item)}>{t("사이트에서 보기")} <ArrowUpRight size={14} /></button></td>)}</tr></tbody></table></div></Modal>}
    {detail && <Sheet title={listingText(detail, locale).title} close={closeDetail}><div className="detail-cover" style={{ '--game-color': getGame(detail.gameId)?.color ?? '#6d5cff' } as React.CSSProperties}><ModIcon item={detail} /><div><span className="source-label"><SourceMark source={detail.source} />{SOURCE_NAMES[detail.source]}</span><p>by {detail.author ?? t("제작자 정보 없음")}</p></div></div><p className="detail-description">{listingText(detail, locale).summary || t("원본 사이트에서 자세한 설명을 확인해 주세요.")}</p>{listingText(detail, locale).translated && <details className="original-copy"><summary>{t('원문 보기')}</summary><strong>{detail.title}</strong><p>{detail.summary}</p></details>}<dl className="detail-info"><dt>{t("게임")}</dt><dd>{gameName(detail.gameId)}</dd><dt>{t("게임 버전")}</dt><dd><span className="cell-scroll">{detail.versions?.join(', ') || t("정보 없음")}</span></dd><dt>{t("로더")}</dt><dd>{detail.loaders?.join(', ') || t("정보 없음")}</dd><dt>{t("업데이트")}</dt><dd>{dateLabel(detail.updatedAt)}</dd><dt>{t("조회 시각")}</dt><dd>{new Date(detail.fetchedAt).toLocaleString(locale)}</dd></dl><p className="detail-note">{t("버전 정보가 표시되어도 다른 모드와의 호환성을 보장하지 않아요.")}</p><div className="modal-actions">{detailAlternatives.length > 1 && detailAlternatives.map(item => <button key={item.key} className="secondary-button" onClick={() => void visit(item.url, item)}><SourceMark source={item.source}/>{SOURCE_NAMES[item.source]}<ArrowUpRight size={16}/></button>)}{canPersistListing(detail) && <button className="secondary-button" disabled={!hydrated} aria-pressed={detailCompared} onClick={() => toggleComparison(detail)}><GitCompareArrows size={16}/>{t(detailCompared ? "비교 해제" : "비교하기")}</button>}{detailCandidate && <button className="secondary-button" disabled={!hydrated} aria-pressed={local.favorites.some(item => item.key === detailCandidate.key)} onClick={() => save(detailCandidate)}><Bookmark size={16} />{local.favorites.some(f => f.key === detailCandidate.key) ? t("저장 해제") : t("즐겨찾기")}</button>}<button className="primary-button" onClick={() => void visit(detail.url, detail)}>{t("원본 사이트에서 보기")} <ArrowUpRight size={16} /></button></div></Sheet>}
    {movingFavorite && <MoveFavorite itemKey={movingFavorite} data={local} update={setLocal} close={() => setMovingFavorite(null)}/>}
    {toast && <div className="toast" role="status"><Check size={17} />{toast}<button className="icon-button" onClick={() => setToast('')} aria-label={t("알림 닫기")}><X size={15} /></button></div>}
  </div>;
}
