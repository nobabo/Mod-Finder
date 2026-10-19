async (page) => {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const evidence = {};
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.evaluate(async () => {
    const { changeLanguage } = await import('/lib/i18n.ts'); changeLanguage('ko');
    for (const { name } of await indexedDB.databases()) if (name) await new Promise(resolve => { const task = indexedDB.deleteDatabase(name); task.onsuccess = task.onerror = task.onblocked = resolve; });
  });
  const settings = page.getByRole('dialog', { name: '설정 메뉴', exact: true });
  if (await settings.count()) await settings.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '검색 필터', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '장르', exact: true }).click();
  await page.locator('.deck-search').waitFor();
  await page.getByRole('dialog').getByRole('button', { name: '뒤로', exact: true }).click();
  await page.screenshot({ path: 'output/playwright/review-filter-menu.png' });
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click();
  await page.waitForFunction(() => document.body.style.overflow !== 'hidden');
  evidence.glass = await page.evaluate(() => ({ mode: document.documentElement.dataset.glass, searchLens: !!document.querySelector('.search-box .glass-control-surface') }));
  if (evidence.glass.mode === 'webgl') {
    await page.waitForFunction(() => !!document.querySelector('.search-box .glass-control-surface'));
    evidence.glass.searchLens = true;
  }
  evidence.overlay = await page.evaluate(async () => {
    const { mountOverlay } = await import('/lib/overlay.ts');
    const overflow = document.body.style.overflow;
    const first = document.createElement('section'), second = document.createElement('section'), outside = document.createElement('button');
    first.innerHTML = '<button>First fixture</button>'; second.innerHTML = '<button>Second fixture</button>';
    document.body.append(first, second, outside);
    const releaseFirst = mountOverlay(first), releaseSecond = mountOverlay(second);
    outside.focus();
    const trapped = second.contains(document.activeElement);
    releaseFirst(); first.remove();
    const stillLocked = document.body.style.overflow === 'hidden';
    releaseSecond(); second.remove(); outside.remove();
    return { trapped, stillLocked, restored: document.body.style.overflow === overflow };
  });
  assert(Object.values(evidence.overlay).every(Boolean), 'Nested overlay focus or overflow restoration failed');

  const item = { source: 'modrinth', scope: 'minecraft', id: 'review-fixture', key: 'modrinth:minecraft:review-fixture', gameId: 'minecraft-java', title: 'Review Magic Example', summary: 'Magic spells and adventure dungeons', author: null, url: 'https://modrinth.com/mod/review-fixture', iconUrl: null, versions: null, loaders: null, updatedAt: null, fetchedAt: new Date().toISOString(), kind: 'mod', metrics: [], tags: [], rank: 1 };
  const reference = { source: 'curseforge', scope: '432', id: '123', key: 'curseforge:432:123', gameId: 'minecraft-java', referenceOnly: true };
  let releaseRefresh;
  const refreshGate = new Promise(resolve => { releaseRefresh = resolve; });
  await page.route('**/v1/listings/curseforge/432/123', async route => {
    await refreshGate;
    await route.fulfill({ json: { listing: { ...item, ...reference, referenceOnly: false, title: 'Restored bookmark', url: 'https://www.curseforge.com/projects/123' } } });
  });
  await page.route('**/v1/listings/modrinth/minecraft/review-fixture', route => route.fulfill({ json: { listing: item } }));
  await page.evaluate(({ item, reference }) => localStorage.setItem('modfinder:local:v1', JSON.stringify({ favorites: [item, reference], folders: [], compared: [], favoriteGames: ['minecraft-java'], history: [] })), { item, reference });
  await page.goto('http://localhost:1420/?page=favorites');
  await page.getByRole('button', { name: item.title, exact: true }).waitFor();
  evidence.hydration = await page.locator('.save-button:disabled').count() === 0;
  releaseRefresh();
  assert(evidence.hydration, 'Local favorites waited for an external detail request');
  await page.getByRole('button', { name: 'Restored bookmark', exact: true }).waitFor();
  await page.getByRole('button', { name: item.title, exact: true }).click();
  await page.locator('.sheet').waitFor();
  await page.locator('.sheet').focus();
  await page.keyboard.press('Escape');
  await page.locator('.sheet').waitFor({ state: 'detached' });
  await page.reload();
  await page.getByRole('button', { name: item.title, exact: true }).waitFor();
  await page.goForward();
  await page.locator('.sheet').waitFor();
  evidence.history = await page.getByRole('dialog', { name: item.title, exact: true }).isVisible();
  await page.keyboard.press('Escape');
  await page.locator('.sheet').waitFor({ state: 'detached' });

  const searches = [];
  await page.route('**/v1/search?**', async route => {
    const request = route.request(), url = new URL(request.url());
    searches.push({ query: url.searchParams.get('query'), locale: request.headers()['accept-language'] });
    const source = url.searchParams.get('source'), interested = url.searchParams.get('query') === 'magic';
    const items = source === 'modrinth' ? [{ ...item, ...(interested ? {} : { id: 'other-fixture', key: 'modrinth:minecraft:other-fixture', title: 'Other example', summary: '' }) }] : [];
    await route.fulfill({ json: { source, status: items.length ? 'success' : 'empty', items, total: items.length, nextCursor: null, fetchedAt: new Date().toISOString(), appliedFilters: {}, unsupportedFilters: [], verifiedLinks: [], message: '', externalUrl: null, queryForwarded: false } });
  });
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('modfinder:local:v1'));
    data.interests = [{ gameId: 'minecraft-java', query: 'magic', topics: ['magic'], weight: 2, at: Date.now() }];
    data.recommendationsEnabled = true;
    localStorage.setItem('modfinder:local:v1', JSON.stringify(data));
  });
  await page.goto('http://localhost:1420/?q=fixture');
  await page.locator('.recommendations-list>li').first().waitFor();
  assert(searches.some(request => request.query === 'magic'), 'Recommendations did not expand the candidate pool');
  assert(await page.locator('.recommendations-list>li').first().getByRole('button', { name: item.title, exact: true }).isVisible(), 'Interest-based candidate was not ranked first');
  evidence.recommendations = { expanded: true, count: await page.locator('.recommendations-list>li').count() };
  await page.screenshot({ path: 'output/playwright/review-recommendations-desktop.png' });
  await page.getByRole('button', { name: '설정 메뉴', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '언어', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'English', exact: true }).click();
  await page.waitForFunction(() => document.documentElement.lang === 'en');
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await page.locator('.recommendations-list>li').first().waitFor();
  assert(searches.some(request => request.locale === 'en'), 'Language changes did not refresh source messages');
  evidence.language = true;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'output/playwright/review-recommendations-mobile.png' });
  evidence.mobile = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  assert(evidence.mobile, 'Recommendation layout overflows a mobile viewport');
  return evidence;
}
