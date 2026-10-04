// Run with Playwright CLI: run-code --filename=tooling/scripts/check-mobile-ui.js
async (page) => {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  const nav = page.getByRole('navigation', { name: '모바일 메뉴' });
  const rect = selector => page.locator(selector).boundingBox();
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
    const boxes = await page.locator('.picker-grid').evaluate(el => Array.from(el.children).map(child => {
      const r = child.getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, right:r.right };
    }));
    check(boxes.length > 0 && boxes.length <= 4, 'Wrong page size');
    check(new Set(boxes.map(b => Math.round(b.y))).size <= 2, 'More than two rows');
    check(boxes.every(b => b.x >= 0 && b.right <= 390 && b.width > 100), 'Cards cut off');
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
  await page.getByRole('button', { name:'정렬 방법', exact:true }).click();
  await checkGrid();
  await page.getByRole('button', { name:'관련도순', exact:true }).click();
  check(await page.getByRole('button', { name:'관련도순', exact:true }).getAttribute('aria-pressed') === 'true', 'Sort selection lost');
  await page.getByRole('button', { name:'닫기', exact:true }).click();
  await nav.getByRole('button', { name:'설정', exact:true }).click();
  await checkGrid();
  await page.screenshot({ path:'output/playwright/mobile-settings.png' });
  await page.getByRole('button', { name:'테마', exact:true }).click();
  await checkGrid();
  await page.getByRole('button', { name:'다음 페이지', exact:true }).click();
  await checkGrid();
  await page.getByRole('button', { name:'뒤로', exact:true }).click();
  await page.getByRole('button', { name:'다음 페이지', exact:true }).click();
  await page.getByRole('button', { name:'언어', exact:true }).click();
  await checkGrid();
  await page.getByRole('button', { name:'닫기', exact:true }).click();
  const input = page.getByRole('searchbox', { name:'모드 검색어' });
  check(await input.getAttribute('enterkeyhint') === 'search', 'Missing keyboard search action');
  await input.fill('sodium');
  await input.press('Enter');
  await page.locator('.has-results').waitFor();
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
  return `PASS: 4 viewport sizes; ${seen.size} games; page boundaries; filter/settings/theme/language; Enter search; centered empty and populated collections; desktop rail.`;
}
