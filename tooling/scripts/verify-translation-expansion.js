// Playwright CLI: run-code --filename=tooling/scripts/verify-translation-expansion.js
async (page) => {
  const errors = []; const searches = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname === '/v1/search') searches.push(Object.fromEntries(url.searchParams));
  });
  const origin = new URL(page.url()).origin;
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  if (new URL(origin).hostname === '127.0.0.1') {
    await page.route('**/v1/**', async route => {
      const requested = new URL(route.request().url());
      const response = await route.fetch({ url: 'http://127.0.0.1:8791' + requested.pathname + requested.search, headers: { ...route.request().headers(), origin: 'http://127.0.0.1:1420' } });
      await route.fulfill({ response, headers: { ...response.headers(), 'access-control-allow-origin': origin } });
    });
  }
  await page.evaluate(async () => {
    localStorage.clear(); localStorage.setItem('modfinder-intro-seen', '1'); document.cookie = 'mf-language=ko; Path=/; SameSite=Lax';
    for (const { name } of await indexedDB.databases()) if (name) await new Promise(resolve => {
      const task = indexedDB.deleteDatabase(name); task.onsuccess = task.onerror = task.onblocked = resolve;
    });
  });
  await page.reload();
  await page.getByRole('button', { name: '게임 바꾸기', exact: true }).click();
  await page.getByRole('textbox', { name: '게임 찾기', exact: true }).fill('림월드');
  await page.getByRole('button', { name: '림월드', exact: true }).click();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.getByRole('button', { name: '검색 필터', exact: true }).click();
    const legacyMenu = page.getByRole('button', { name: '장르', exact: true });
    if (await legacyMenu.count()) await legacyMenu.click();
    const categorySearch = page.getByRole('textbox', { name: '장르', exact: true });
    if (await categorySearch.count()) await categorySearch.fill('모드팩');
    else await page.getByRole('button', { name: '컨텐츠', exact: true }).click();
    const modpacks = page.getByRole('button', { name: '모드팩', exact: true });
    await modpacks.waitFor();
    await page.screenshot({ path: `output/playwright/collections-filter-${width}.png` });
    if (await modpacks.getAttribute('aria-pressed') !== 'true') await modpacks.click();
    await page.getByRole('button', { name: '닫기', exact: true }).click();
    const first = page.locator('.results-content .mod-card').first();
    await first.waitFor({ timeout: 40000 });
    await page.mouse.move(0, 0);
    await page.keyboard.press('Escape');
    await first.locator('.title-button').focus();
    await first.locator('.title-button').press('Enter');
    const detail = page.getByRole('dialog');
    await detail.waitFor();
    await detail.getByRole('button', { name: '닫기', exact: true }).focus();
    await detail.getByText('제가 만든 림월드 모드를 모두 하나의 간편한 패키지로 묶었습니다!', { exact: true }).waitFor();
    await page.screenshot({ path: `output/playwright/collections-korean-detail-${width}.png` });
    await page.keyboard.press('Escape');
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw Error('Horizontal page overflow');
  }
  if (errors.length) throw Error(errors.join('\n'));
  if (!searches.some(request => request.source === 'nexus' && request.category === 'nexus:collections')) throw Error('Modpack category did not reach Nexus');
  return { viewports: [1440, 390], realCollection: 'nexus:rimworld:collection-inebmp', searches: searches.length, errors };
}
