// Run with Playwright CLI: run-code --filename=tooling/scripts/check-mobile-ui.js
async (page) => {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  const nav = page.getByRole('navigation', { name: '모바일 메뉴' });
  const rect = selector => page.locator(selector).boundingBox();
  for (const [width, height] of [[320,568], [390,844], [768,1024]]) {
    await page.setViewportSize({ width, height });
    for (const selector of ['.search-dock.hero .search-box', '.ranking-panel']) {
      const box = await rect(selector);
      check(Math.abs(box.x + box.width / 2 - width / 2) < 2, `${selector} is off center`);
    }
    check(await page.locator('.search-submit').evaluate(el => getComputedStyle(el).borderTopWidth === '0px'), 'Search button still has a border');
    check(await page.locator('.search-submit').evaluate(el => { const s = getComputedStyle(el); return s.backgroundColor === 'rgba(0, 0, 0, 0)' && s.backgroundImage === 'none'; }), 'Search button still has a background');
  }
  const centered = async (selector, height) => {
    const panel = await rect(selector);
    const search = await rect('.search-row');
    check(Math.abs(panel.y + panel.height / 2 - height / 2) < 2, `${selector} not centered at ${height}`);
    check(search.y >= 0 && search.y + search.height < panel.y, `Search clipped/overlapping at ${height}`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal overflow');
  };
  for (const [width, height] of [[320,568], [390,844], [768,1024], [844,390]]) {
    await page.setViewportSize({ width, height });
    await nav.getByRole('button', { name: '최근 검색', exact: true }).click();
    await centered('.history-list', height);
    await nav.getByRole('button', { name: '즐겨찾기', exact: true }).click();
    await centered('.collection-panel', height);
    const submit = await rect('.search-submit');
    check(submit.width >= 48 && submit.height >= 48, 'Search touch target too small');
  }
  await page.setViewportSize({ width:390, height:844 });
  await page.getByRole('button', { name:'게임 바꾸기' }).click();
  const checkGrid = async () => {
    const columns = await page.locator('.picker-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    const expectedColumns = await page.locator('.settings-menu').count() ? 3 : 2;
    check(columns === expectedColumns, 'Wrong column count');
    const boxes = await page.locator('.picker-grid').evaluate(el => Array.from(el.children).map(child => {
      const r = child.getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, right:r.right };
    }));
    check(boxes.length > 0 && boxes.length <= columns * 2, 'Wrong page size');
    check(new Set(boxes.map(b => Math.round(b.y))).size <= 2, 'More than two rows');
    check(boxes.every(b => b.x >= 0 && b.right <= page.viewportSize().width && b.width > 70), 'Cards cut off');
    return boxes;
  };
  await checkGrid();
  check(await page.getByRole('button', { name:'이전 페이지', exact:true }).isDisabled(), 'First page can go back');
  await page.screenshot({ path:'output/playwright/mobile-games.png' });
  const seen = new Set();
  for (let i=0; i<100; i++) {
    await checkGrid();
    for (const name of await page.locator('.picker-grid button').allTextContents()) {
      check(!seen.has(name), `Duplicate game across pages: ${name}`); seen.add(name);
    }
    const next = page.getByRole('button', { name:'다음 페이지', exact:true });
    if (await next.isDisabled()) break;
    await next.click();
    check(i < 99, 'Pagination never ends');
  }
  check(seen.size > 8, 'Missing games');
  await page.getByRole('textbox', { name:'게임 찾기' }).fill('마인크래프트');
  check(await page.locator('.picker-grid button').count() === 1, 'Search did not reset pagination');
  await page.getByRole('button', { name:'마인크래프트', exact:true }).click();
  await page.getByRole('button', { name:'검색 필터', exact:true }).click();
  await checkGrid();
  const filterHeader = await rect('.deck-header');
  const filterCards = await rect('.picker-grid');
  check(Math.abs((filterHeader.y + filterCards.y + filterCards.height) / 2 - 422) < 2, 'Filter contents are not vertically centered');
  await page.screenshot({ path:'output/playwright/mobile-filter-centered.png' });
  await page.getByRole('button', { name:'정렬 방법', exact:true }).click();
  await checkGrid();
  await page.getByRole('button', { name:'관련도순', exact:true }).click();
  check(await page.getByRole('button', { name:'관련도순', exact:true }).getAttribute('aria-pressed') === 'true', 'Sort selection lost');
  await page.getByRole('button', { name:'닫기', exact:true }).click();
  await nav.getByRole('button', { name:'설정', exact:true }).click();
  for (const width of [320,768,390]) {
    await page.setViewportSize({width,height:844});
    await checkGrid();
  }
  check(await page.getByRole('button', { name:'모드 둘러보기', exact:true }).count() === 0, 'Browse card remains');
  await page.screenshot({ path:'output/playwright/mobile-settings.png' });
  await page.getByRole('button', { name:'테마', exact:true }).click();
  await checkGrid();
  await page.getByRole('button', { name:'다음 페이지', exact:true }).click();
  await checkGrid();
  await page.getByRole('button', { name:'뒤로', exact:true }).click();
  await page.getByRole('button', { name:'웹 / 앱 다운로드', exact:true }).click();
  check(await page.getByRole('link', { name:'웹에서 열기', exact:true }).count() === 0, 'Open web card remains');
  check(await page.getByRole('link', { name:'Windows', exact:true }).count() === 1 && await page.getByRole('link', { name:'Android', exact:true }).count() === 1, 'App downloads missing');
  await page.screenshot({ path:'output/playwright/mobile-downloads.png' });
  await page.getByRole('button', { name:'뒤로', exact:true }).click();
  await page.getByRole('button', { name:'언어', exact:true }).click();
  await checkGrid();
  await page.getByRole('button', { name:'닫기', exact:true }).click();
  const input = page.getByRole('searchbox', { name:'모드 검색어' });
  check(await input.getAttribute('enterkeyhint') === 'search', 'Missing keyboard search action');
  await input.fill('sodium');
  await page.evaluate(() => window.scrollTo({ top:120, behavior:'instant' }));
  check(await page.evaluate(() => scrollY > 0), 'Search scroll regression did not start scrolled');
  await input.press('Enter');
  await page.locator('.has-results').waitFor();
  check(await page.evaluate(() => scrollY === 0), 'Search retained old scroll position');
  check((await rect('.search-row')).y >= 0, 'Search clipped after submitting');
  check(await input.evaluate(el => document.activeElement !== el), 'Keyboard focus not released after submit');
  await nav.getByRole('button', { name:'최근 검색', exact:true }).click();
  check((await page.locator('.history-list').innerText()).includes('sodium'), 'Enter did not save query');
  await page.screenshot({ path:'output/playwright/mobile-recent.png' });
  await page.evaluate(() => {
    const key = 'modfinder:local:v1';
    const data = JSON.parse(localStorage.getItem(key));
    data.history = Array.from({length:20}, (_,i) => ({gameId:'minecraft-java', query:`Search ${i}`}));
    localStorage.setItem(key, JSON.stringify(data));
  });
  await page.reload();
  await nav.getByRole('button', { name:'최근 검색', exact:true }).click();
  await centered('.history-list', 844);
  check(await page.locator('.history-list').evaluate(el => el.scrollHeight > el.clientHeight), 'Long history should scroll inside panel');
  await page.screenshot({ path:'output/playwright/mobile-history-full.png' });
  await page.setViewportSize({ width:1440, height:1000 });
  await page.getByRole('button', { name:'게임 바꾸기' }).click();
  check(await page.locator('.picker-grid').count() === 0, 'Desktop rail replaced');
  check(await page.locator('.deck-card').count() === seen.size, 'Desktop/mobile games differ');
  await page.screenshot({ path:'output/playwright/desktop-games.png' });
  return `PASS: 4 viewport sizes; ${seen.size} games; page boundaries; simplified settings/downloads; centered mobile search, rankings and filters; borderless search button; Enter resets scroll; centered collections; desktop rail.`;
}
