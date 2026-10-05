// Run with Playwright CLI against a local preview, in desktop and touch sessions.
async (page) => {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const origin = new URL(page.url()).origin;
  const touch = await page.evaluate(() => matchMedia('(hover: none) and (pointer: coarse)').matches);
  const mode = touch ? 'touch' : 'desktop';
  const run = Date.now().toString(36);
  const queryA = `navigation-${run}`;
  const queryB = `restore-${run}`;
  const errorQuery = `offline-${run}`;
  const requests = [];
  const errors = [];
  let unavailable = false;
  const onError = error => errors.push(error.message);
  const routeSearch = async route => {
    const params = new URL(route.request().url()).searchParams;
    const request = Object.fromEntries(params);
    requests.push(request);
    if (unavailable) { await route.fulfill({ status: 503, body: 'Temporary test outage' }); return; }
    const source = params.get('source');
    const gameId = params.get('gameId');
    const query = params.get('query');
    const scope = gameId === 'stardew-valley' ? 'stardewvalley' : 'minecraft';
    const supported = source === 'modrinth' || source === 'nexus';
    const items = supported ? Array.from({ length: 32 }, (_, index) => ({
      key: `${source}:${scope}:qa-${query}-${index}`, source, scope, id: `qa-${query}-${index}`, gameId,
      title: `${query} ${index + 1}`, summary: 'Navigation verification.', author: 'UX verification', rank: index,
      url: source === 'nexus' ? 'https://www.nexusmods.com/stardewvalley/mods/2400' : 'https://modrinth.com/mod/sodium',
      iconUrl: null, updatedAt: null, versions: null, loaders: null, kind: 'mod',
      metrics: [{ label: '다운로드', value: 1000 - index }], tags: [], fetchedAt: new Date().toISOString(),
    })) : [];
    await route.fulfill({ json: {
      source, status: items.length ? 'success' : 'empty', items, nextCursor: null, total: items.length,
      fetchedAt: new Date().toISOString(), cached: false, appliedFilters: request.category ? { category: request.category } : {},
      unsupportedFilters: [], externalUrl: null, queryForwarded: true, message: '',
    } });
  };
  const search = page.getByRole('searchbox', { name: '모드 검색어' });
  const submit = async value => {
    await search.fill(value);
    await page.getByRole('button', { name: '모드 검색', exact: true }).click();
    await page.waitForURL(url => url.searchParams.get('q') === value);
    await page.getByRole('button', { name: `${value} 1`, exact: true }).waitFor();
  };
  const settings = async name => {
    await page.getByRole('button', { name: '설정 메뉴', exact: true }).click();
    await page.getByRole('dialog', { name: '설정 메뉴' }).getByRole('button', { name, exact: true }).click();
  };

  page.on('pageerror', onError);
  await page.context().route('**/v1/search?**', routeSearch);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('modfinder-intro-seen', '1'); document.cookie = 'mf-language=ko; Path=/'; });
  try {
    await page.goto(origin);
    for (const [width, height] of touch ? [[320, 740], [412, 839], [844, 390], [1024, 768]] : [[1440, 900], [1399, 900], [1024, 800], [768, 900], [390, 844]]) {
      await page.setViewportSize({ width, height });
      assert(await page.locator('.mobile-nav').count() === 0, `Bottom bar remains at ${width}`);
      const button = page.getByRole('button', { name: '설정 메뉴', exact: true });
      assert(await button.isVisible(), `Missing settings at ${width}`);
      const box = await button.boundingBox();
      assert(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height, `Settings clipped at ${width}`);
      if (touch) assert(box.x < 60 && box.y < 90, `Mobile settings not at top left at ${width}`);
      await page.screenshot({ path: `output/playwright/ux-fixed-${mode}-${width}.png`, scale: 'css' });
    }
    await page.setViewportSize(touch ? { width: 412, height: 839 } : { width: 1399, height: 900 });
    await page.getByRole('button', { name: '게임 바꾸기', exact: true }).click();
    await page.getByRole('button', { name: '스타듀 밸리', exact: true }).click();
    await page.waitForURL(url => url.searchParams.get('game') === 'stardew-valley');
    await submit(queryA);
    await page.getByRole('button', { name: '검색 필터', exact: true }).click();
    await page.getByRole('button', { name: '정렬 방법', exact: true }).click();
    await page.getByRole('button', { name: '최근 업데이트순', exact: true }).click();
    await page.getByRole('button', { name: '닫기', exact: true }).click();
    await page.waitForURL(url => url.searchParams.get('sort') === 'updated');
    await page.getByRole('button', { name: `${queryA} 1`, exact: true }).waitFor();
    await page.getByRole('button', { name: `${queryA} 1 즐겨찾기`, exact: true }).click();
    const searchUrl = page.url();
    await page.evaluate(() => scrollTo({ top: 700, behavior: 'instant' }));
    await settings('즐겨찾기');
    await page.getByRole('heading', { name: '즐겨찾기', exact: true }).waitFor();
    assert(await page.locator('.mod-card').count() === 1, 'Favorite missing');
    await page.goBack();
    await page.waitForURL(searchUrl);
    await page.waitForFunction(() => scrollY >= 650);
    assert(await search.inputValue() === queryA, 'Back lost query');
    await page.goForward();
    await page.getByRole('heading', { name: '즐겨찾기', exact: true }).waitFor();
    await page.reload();
    await page.getByRole('heading', { name: '즐겨찾기', exact: true }).waitFor();
    await page.getByRole('button', { name: `${queryA} 1`, exact: true }).waitFor();
    assert(await search.inputValue() === queryA, 'Reload lost query context');
    assert(new URL(page.url()).searchParams.get('game') === 'stardew-valley', 'Reload lost game');
    assert(new URL(page.url()).searchParams.get('sort') === 'updated', 'Reload lost sort');

    const pagesBefore = page.context().pages().length;
    await page.locator('.mod-logo-link').first()[touch ? 'tap' : 'click']();
    await page.getByRole('dialog', { name: `${queryA} 1`, exact: true }).waitFor();
    assert(page.context().pages().length === pagesBefore, 'Image unexpectedly opened an external tab');
    await page.goBack();
    await page.locator('.sheet').waitFor({ state: 'hidden' });
    assert(new URL(page.url()).searchParams.get('page') === 'favorites', 'Closing details left favorites');
    await page.goForward();
    await page.getByRole('dialog', { name: `${queryA} 1`, exact: true }).waitFor();
    await page.getByRole('button', { name: '닫기', exact: true }).click();
    await page.locator('.sheet').waitFor({ state: 'hidden' });
    await page.locator('.title-button').first()[touch ? 'tap' : 'click']();
    await page.getByRole('dialog', { name: `${queryA} 1`, exact: true }).waitFor();
    await page.evaluate(() => { window.__uxOpen = window.open; window.open = url => { window.__uxDestination = url; return null; }; });
    await page.getByRole('button', { name: '원본 사이트에서 보기', exact: true }).click();
    assert(await page.evaluate(() => window.__uxDestination) === 'https://www.nexusmods.com/stardewvalley/mods/2400', 'Explicit external action failed');
    await page.evaluate(() => { window.open = window.__uxOpen; });
    await page.getByRole('button', { name: '닫기', exact: true }).click();
    await page.locator('.sheet').waitFor({ state: 'hidden' });
    await submit(queryB);
    await page.goBack();
    await page.getByRole('heading', { name: '즐겨찾기', exact: true }).waitFor();
    assert(await search.inputValue() === queryA, 'Previous search input was not restored');
    await page.goForward();
    await page.waitForURL(url => url.searchParams.get('q') === queryB);
    await page.reload();
    await page.getByRole('button', { name: `${queryB} 1`, exact: true }).waitFor();

    const sharedUrl = `${origin}/?q=filters-${run}&version=1.21.1&loader=fabric&kind=mod&category=modrinth%3Amagic&category=modrinth%3Aoptimization&sort=relevance`;
    await page.goto(sharedUrl);
    await page.getByRole('button', { name: `filters-${run} 1`, exact: true }).waitFor();
    assert(requests.some(request => request.version === '1.21.1' && request.loader === 'fabric' && request.kind === 'mod' && request.category === 'modrinth:magic' && request.sort === 'relevance'), 'Shared URL lost filters');
    const shared = await page.context().newPage();
    try {
      await shared.goto(sharedUrl);
      await shared.getByRole('button', { name: `filters-${run} 1`, exact: true }).waitFor();
      assert(await shared.getByRole('searchbox', { name: '모드 검색어' }).inputValue() === `filters-${run}`, 'New tab lost shared query');
    } finally { await shared.close(); }

    await page.goto(origin);
    unavailable = true;
    await search.fill(errorQuery);
    await page.getByRole('button', { name: '모드 검색', exact: true }).click();
    await page.getByRole('heading', { name: '잠시 검색에 연결하지 못했어요', exact: true }).waitFor();
    assert(await page.getByRole('link', { name: 'Modrinth', exact: true }).getAttribute('href') === `https://modrinth.com/mods?q=${errorQuery}`, 'Missing source recovery link');
    assert(await page.getByRole('link', { name: 'CurseForge', exact: true }).count() === 1, 'Missing second source recovery link');
    assert(await page.locator('.mod-card').count() === 0, 'External links counted as results');
    await page.screenshot({ path: `output/playwright/ux-fixed-${mode}-error.png`, scale: 'css' });
    const beforeRetry = requests.length;
    unavailable = false;
    await page.getByRole('button', { name: '다시 시도', exact: true }).click();
    await page.getByRole('button', { name: `${errorQuery} 1`, exact: true }).waitFor();
    assert(requests.length > beforeRetry, 'Retry did not reach the service');
    assert(await page.locator('.search-recovery').count() === 0, 'Recovery controls remain after success');
    assert(await page.locator('.mobile-nav').count() === 0, 'Bottom bar returned after search');
    assert(errors.length === 0, errors.join('\n'));
    return { mode, status: 'passed', viewportChecks: touch ? 4 : 5, restored: ['game', 'query', 'filters', 'sort', 'favorites', 'back', 'forward', 'scroll', 'details'], recovery: 'retry and source links', cardActions: 'consistent' };
  } finally {
    await page.context().unroute('**/v1/search?**', routeSearch);
    page.off('pageerror', onError);
  }
}
