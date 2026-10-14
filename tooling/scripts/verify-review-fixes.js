// Run through Playwright CLI against the local web preview.
async (page) => {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const origin = new URL(page.url()).origin;
  const requests = []; const errors = []; const fontRequests = []; const summaryRequests = [];
  let failures = 3;
  const query = `review-${Date.now().toString(36)}`;
  const onError = error => errors.push(error.message);
  const onRequest = request => {
    if (/fonts\.(googleapis|gstatic)\.com/.test(request.url())) fontRequests.push(request.url());
    if (request.url().includes('/locales/mod-summaries/')) summaryRequests.push(request.url());
  };
  const route = async route => {
    const params = Object.fromEntries(new URL(route.request().url()).searchParams);
    requests.push(params);
    const primary = params.source === 'modrinth';
    const next = !!params.cursor;
    if (primary && next && params.query === query && failures-- > 0) {
      const result = {
        source: params.source, status: failures === 1 ? 'error' : 'rate_limited', items: [], nextCursor: null,
        total: null, fetchedAt: new Date().toISOString(), cached: false, appliedFilters: {}, unsupportedFilters: [],
        externalUrl: null, queryForwarded: true, message: 'Temporary outage',
      };
      await route.fulfill(failures === 2 ? { status: 503, body: 'Temporary outage' } : { json: result });
      return;
    }
    const items = primary ? (next ? [5] : [1, 2, 3, 4]).map(index => ({
      key: `modrinth:minecraft:review-${index}`, id: `review-${index}`, scope: 'minecraft', source: 'modrinth', gameId: 'minecraft-java',
      title: `Review Mod ${index}`, summary: 'Browser verification of search, details and favorites.', author: 'Verification',
      url: 'https://modrinth.com/mod/sodium', iconUrl: null, updatedAt: null, versions: null, loaders: null,
      kind: params.kind || 'mod', metrics: [{ label: '다운로드', value: 100 - index }], tags: [], rank: index, fetchedAt: new Date().toISOString(),
    })) : [];
    await route.fulfill({ json: {
      source: params.source, status: items.length ? 'success' : 'external', items,
      nextCursor: primary && params.query && !next ? 'page-2' : null, total: items.length, fetchedAt: new Date().toISOString(), cached: false,
      appliedFilters: {}, unsupportedFilters: [], externalUrl: null, queryForwarded: true, message: '',
    } });
  };
  page.on('pageerror', onError); page.on('request', onRequest);
  await page.route('**/v1/search?**', route);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('modfinder-intro-seen', '1'); document.cookie = 'mf-language=ko; Path=/'; });
  try {
    await page.goto(origin);
    await page.locator('#mod-query').fill(query);
    await page.locator('#mod-query').press('Enter');
    await page.getByRole('button', { name: 'Review Mod 1', exact: true }).waitFor();
    const more = page.getByRole('button', { name: '모드 더 보기', exact: true });
    await more.waitFor();
    assert(requests.filter(request => request.query === query && request.cursor).length === 0, 'Initial search automatically fetched extra pages');
    for (let attempt = 0; attempt < 3; attempt++) {
      await more.click();
      await page.getByRole('button', { name: '다시 시도', exact: true }).waitFor();
      assert(await page.locator('.mod-card').count() === 4, 'Page failure discarded earlier results');
      assert(await more.isEnabled(), 'Failed cursor is not retryable');
    }
    await more.click();
    await page.getByRole('button', { name: 'Review Mod 5', exact: true }).waitFor();
    assert(requests.filter(request => request.query === query && request.cursor === 'page-2').length === 4, 'Retry changed the failed cursor');
    assert(await more.count() === 0, 'Exhausted pagination remains available');

    await page.evaluate(() => { window.__oldOpen = window.open; window.open = url => { window.__openedUrl = url; return null; }; });
    await page.locator('.mod-logo-link').first().click();
    assert(await page.evaluate(() => window.__openedUrl) === 'https://modrinth.com/mod/sodium', 'Logo does not open the source');
    assert(await page.locator('.sheet').count() === 0, 'Logo opened details');
    for (let index = 1; index <= 3; index++) {
      await page.getByRole('button', { name: `Review Mod ${index}`, exact: true }).click();
      await page.locator('.sheet').getByRole('button', { name: '비교하기', exact: true }).click();
      await page.keyboard.press('Escape');
    }
    await page.getByRole('button', { name: 'Review Mod 4', exact: true }).click();
    await page.locator('.sheet').getByRole('button', { name: '비교하기', exact: true }).click();
    await page.getByRole('status').filter({ hasText: '한 번에 최대 3개' }).waitFor();
    assert(await page.evaluate(() => JSON.parse(localStorage.getItem('modfinder:local:v1')).compared.length) === 3, 'Comparison cap failed');
    await page.keyboard.press('Escape');
    await page.locator('.compare-tray').getByRole('button', { name: '비교하기', exact: true }).click();
    assert(await page.locator('.comparison-table thead th').count() === 4, 'Comparison does not include three selected mods');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '비교 선택 초기화', exact: true }).click();
    await page.getByRole('button', { name: 'Review Mod 1 즐겨찾기', exact: true }).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('modfinder:local:v1')).favorites.length === 1);
    for (let index = 0; index < 3; index++) {
      await page.getByRole('button', { name: 'Review Mod 1 즐겨찾기 해제', exact: true }).click();
      await page.getByRole('button', { name: 'Review Mod 1 즐겨찾기', exact: true }).click();
    }
    assert(await page.getByRole('status').filter({ hasText: '즐겨찾기에 저장했어요.' }).count() === 1, 'Rapid favorite toggles show the wrong notice');
    await page.screenshot({ path: 'output/playwright/review-results-desktop.png' });

    await page.locator('#mod-query').fill('작성 중인 검색');
    await page.evaluate(() => { window.__languageSentinel = true; });
    await page.getByRole('button', { name: '설정 메뉴', exact: true }).click();
    await page.getByRole('button', { name: '언어', exact: true }).click();
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    assert(await page.locator('#mod-query').inputValue() === '작성 중인 검색', 'Language change lost unfinished input');
    assert(await page.evaluate(() => window.__languageSentinel), 'Language change reloaded the page');
    assert(new URL(page.url()).searchParams.get('q') === query, 'Language change lost the search route');
    await page.getByRole('button', { name: '한국어', exact: true }).click();
    await page.locator('.settings-menu').getByRole('button', { name: '닫기', exact: true }).click();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: '설정 메뉴', exact: true }).click();
    await page.getByRole('button', { name: '즐겨찾기', exact: true }).click();
    await page.locator('.folder-rail').getByRole('button', { name: '미분류', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.folder-rail button[aria-pressed="true"]')?.textContent.includes('미분류'));
    assert(await page.getByRole('button', { name: 'Review Mod 1', exact: true }).count() === 1, 'Mobile unfiled favorites inaccessible');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile overflow');
    await page.screenshot({ path: 'output/playwright/review-favorites-mobile.png' });

    await page.goto(origin);
    await page.getByRole('button', { name: '검색 필터', exact: true }).click();
    await page.getByRole('button', { name: '장르', exact: true }).click();
    await page.getByRole('button', { name: '모드 로더', exact: true }).click();
    await page.getByRole('button', { name: 'Fabric', exact: true }).click();
    await page.getByRole('button', { name: '닫기', exact: true }).click();
    await page.locator('.results-content').waitFor();
    await page.getByRole('button', { name: 'Review Mod 1', exact: true }).waitFor();
    assert(requests.some(request => request.loader === 'fabric' && request.query === ''), 'Home filter did not search');

    await page.goto(origin);
    await page.getByRole('button', { name: '다운로드 순위', exact: true }).click();
    await page.getByRole('button', { name: 'Review Mod 1', exact: true }).click();
    await page.locator('.sheet').waitFor();
    assert(!new URL(page.url()).searchParams.has('q'), 'Ranking title navigates to a search instead of details');
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.getByRole('button', { name: '게임 바꾸기', exact: true }).click();
    await page.mouse.move(800, 100);
    await page.evaluate(() => {
      const original = window.requestAnimationFrame; window.__rafCount = 0;
      window.__restoreRaf = () => { window.requestAnimationFrame = original; };
      window.requestAnimationFrame = callback => original.call(window, time => { window.__rafCount++; callback(time); });
    });
    await page.waitForTimeout(300);
    const before = await page.evaluate(() => window.__rafCount);
    await page.waitForTimeout(700);
    const idleFrames = await page.evaluate(() => window.__rafCount) - before;
    assert(idleFrames <= 8, `Idle picker kept running animation frames: ${idleFrames}`);
    await page.screenshot({ path: 'output/playwright/review-picker-desktop.png' });
    summaryRequests.length = 0;
    await page.evaluate(() => { document.cookie = 'mf-language=en; Path=/'; });
    await page.goto(origin + '/?game=all&q=review-localization');
    await page.getByRole('button', { name: 'Review Mod 1', exact: true }).waitFor();
    assert(summaryRequests.length === 0, 'English search loads Korean summary catalogs');
    summaryRequests.length = 0;
    await page.evaluate(() => { document.cookie = 'mf-language=ko; Path=/'; });
    await page.goto(origin + '/?game=all&q=review-localization-ko');
    await page.getByRole('button', { name: 'Review Mod 1', exact: true }).waitFor();
    assert(summaryRequests.every(url => url.includes('minecraft-java.json')), 'All-games search preloads catalogs absent from results');
    assert(fontRequests.length === 0, 'Runtime still contacts Google Fonts');
    assert(errors.length === 0, errors.join('\n'));
    return { passed: ['one page per action', 'HTTP and provider error recovery', 'source logo and details', 'comparison and cap', 'favorite toggle notices', 'language without reload', 'mobile unfiled favorites', 'filter-only search', 'ranking details', 'idle picker', 'local fonts', 'localized catalog loading'], idleFrames, pageErrors: errors };
  } finally {
    await page.unroute('**/v1/search?**', route);
    await page.evaluate(() => { if (window.__oldOpen) window.open = window.__oldOpen; window.__restoreRaf?.(); });
    page.off('pageerror', onError); page.off('request', onRequest);
  }
}
