// Playwright CLI: run-code --filename=tooling/scripts/verify-recommendations.js
async (page) => {
  const assert = (condition, message) => { if (!condition) throw Error(message); };
  const origin = new URL(page.url()).origin;
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(async () => {
    localStorage.clear();
    localStorage.setItem('modfinder-intro-seen', '1');
    document.cookie = 'mf-language=ko; Path=/; SameSite=Lax';
    for (const { name } of await indexedDB.databases()) if (name) await new Promise(resolve => {
      const task = indexedDB.deleteDatabase(name); task.onsuccess = task.onerror = task.onblocked = resolve;
    });
  });
  const searches = [];
  const make = (id, title, summary = '') => ({ source: 'modrinth', scope: 'minecraft', id, key: `modrinth:minecraft:${id}`, gameId: 'minecraft-java', title, summary, author: null, url: `https://modrinth.com/mod/${id}`, iconUrl: null, versions: null, loaders: null, updatedAt: null, fetchedAt: new Date().toISOString(), kind: 'mod', metrics: [], tags: [], rank: 1 });
  const magic = { ...make('recommendation-magic', 'Magic Example', 'Magic spells and adventure dungeons'), kind: 'modpack', url: 'https://modrinth.com/modpack/recommendation-magic' };
  await page.route('**/v1/search?**', async route => {
    const params = new URL(route.request().url()).searchParams;
    const source = params.get('source'), query = params.get('query');
    searches.push(Object.fromEntries(params));
    const items = source !== 'modrinth' ? [] : ['magic', magic.title].includes(query) ? [magic] : Array.from({ length: 12 }, (_, index) => make(`example-${index}`, `Example ${index + 1}`));
    await route.fulfill({ json: { source, status: items.length ? 'success' : 'empty', items, nextCursor: null, total: items.length, fetchedAt: new Date().toISOString(), appliedFilters: {}, unsupportedFilters: [], verifiedLinks: [], message: '', externalUrl: null, queryForwarded: true } });
  });
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('modfinder:local:v1')));
  const settings = page.getByRole('dialog', { name: '설정 메뉴', exact: true });
  const toggle = settings.getByRole('switch', { name: '맞춤 추천', exact: true });
  const openSettings = () => page.getByRole('button', { name: '설정 메뉴', exact: true }).click();
  const closeSettings = () => settings.getByRole('button', { name: '닫기', exact: true }).click();
  const submit = async query => {
    await page.getByRole('searchbox', { name: '모드 검색어', exact: true }).fill(query);
    await page.getByRole('button', { name: '모드 검색', exact: true }).click();
    await page.locator('.results-content>.mod-grid .mod-card').first().waitFor();
  };
  await page.goto(origin);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('modfinder:local:v1'))?.recommendationsEnabled === false);
  assert(await page.getByRole('group', { name: '순위 종류', exact: true }).getByRole('button').count() === 2, 'Home must only show search and download rankings');
  assert(searches.length === 0, 'Home fetched recommendation candidates');
  await page.screenshot({ path: 'output/playwright/recommendations-home.png' });
  await openSettings();
  assert(await toggle.getAttribute('aria-checked') === 'false', 'Fresh preferences enabled recommendations');
  assert(await toggle.locator('.recommendations-switch,input').count() === 0, 'A separate miniature switch remains on the card');
  const visual = () => toggle.evaluate(element => {
    const style = getComputedStyle(element);
    const animation = element.getAnimations().find(item => item.animationName === 'genre-card-pick');
    return { filter: style.filter, iconFilter: getComputedStyle(element.querySelector('svg')).filter, animation: animation?.playState, y: new DOMMatrix(style.transform).m42, drop: parseFloat(style.getPropertyValue('--card-drop')) || 0 };
  });
  const finishTransitions = () => toggle.evaluate(element => {
    for (const animation of element.getAnimations()) animation.finish();
  });
  const inactive = await visual();
  assert([inactive.filter, inactive.iconFilter].includes('grayscale(1)'), 'Disabled recommendation card is not grayscale');
  await page.screenshot({ path: 'output/playwright/recommendation-card-off.png' });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await toggle.focus(); await page.keyboard.press('Space');
  assert(await toggle.getAttribute('aria-checked') === 'true' && !(await visual()).animation, 'Keyboard activation must enable recommendations without a draw animation');
  await finishTransitions();
  const active = await visual();
  assert(Math.abs(active.y - active.drop) < .1, 'Enabled recommendation card moved above the other settings cards');
  assert(active.filter === 'none' && !active.iconFilter.includes('grayscale'), 'Enabled recommendation card must keep its theme color');
  await page.screenshot({ path: 'output/playwright/recommendation-card-on-desktop.png' });
  await toggle.dispatchEvent('click'); await toggle.dispatchEvent('click');
  assert(!(await visual()).animation, 'Repeated toggles must not animate the card position');
  await finishTransitions();
  await page.setViewportSize({ width: 390, height: 844 });
  await toggle.dispatchEvent('click'); await toggle.dispatchEvent('click');
  assert(!(await visual()).animation, 'Mobile recommendation card must not use a draw animation');
  await finishTransitions();
  assert(Math.abs((await visual()).y) < .1, 'Mobile recommendation card must stay aligned with the other cards');
  await page.screenshot({ path: 'output/playwright/recommendation-card-on-mobile.png' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await toggle.dispatchEvent('click'); await toggle.dispatchEvent('click');
  assert(await toggle.getAttribute('aria-checked') === 'true' && !(await visual()).animation, 'Reduced motion did not keep the color state without animation');
  await toggle.dispatchEvent('click');
  await closeSettings();
  await page.setViewportSize({ width: 1440, height: 1000 });

  // A pre-existing profile must not opt a legacy user in automatically.
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('modfinder:local:v1'));
    delete data.recommendationsEnabled;
    data.interests = [{ gameId: 'minecraft-java', query: 'magic', topics: ['magic'], weight: 2, at: Date.now() }];
    localStorage.setItem('modfinder:local:v1', JSON.stringify(data));
  });
  await page.reload();
  await submit('needle');
  assert(await page.locator('.recommendations-row').count() === 0, 'Disabled recommendations occupied search results');
  assert(!searches.some(request => ['', 'magic'].includes(request.query)), 'Disabled recommendations sent candidate requests');
  assert((await stored()).interests.length === 1, 'Disabled searches collected interest signals');

  await openSettings();
  assert(await toggle.getAttribute('aria-checked') === 'false', 'Legacy profile enabled recommendations');
  await toggle.click();
  assert(await toggle.getAttribute('aria-checked') === 'true', 'Recommendation switch did not enable');
  await closeSettings();
  const row = page.getByRole('region', { name: '맞춤 추천', exact: true });
  const chooseRecommendation = async (keyboard = false) => {
    const button = row.getByRole('button', { name: magic.title, exact: true });
    if (keyboard) { await button.focus(); await page.keyboard.press('Enter'); }
    else await button.click();
    await page.waitForURL(url => url.searchParams.get('q') === magic.title);
    await page.waitForFunction(() => document.activeElement?.id === 'mod-query');
    assert(await page.getByRole('searchbox', { name: '모드 검색어', exact: true }).inputValue() === magic.title, 'Recommendation did not fill the search field with the original title');
    assert(await page.locator('.sheet,.sheet-backdrop').count() === 0, 'Recommendation opened a detail panel');
    assert(await page.evaluate(() => !history.state?.modFinder?.detail && scrollY === 0), 'Recommendation left a detail history entry or did not return to the search field');
    const params = new URL(page.url()).searchParams;
    assert((params.get('game') ?? 'minecraft-java') === magic.gameId && params.get('kind') === magic.kind, 'Recommendation lost its game or modpack type');
    assert(['version', 'loader', 'category', 'genre'].every(key => !params.has(key)), 'Recommendation retained unrelated filters');
    await page.locator('.results-content>.mod-grid .title-button').filter({ hasText: magic.title }).waitFor();
    assert(searches.some(request => request.query === magic.title && request.gameId === magic.gameId && request.kind === magic.kind), 'Recommendation did not submit a game-scoped search');
  };
  await row.getByRole('button', { name: magic.title, exact: true }).waitFor();
  assert(searches.some(request => request.query === 'magic'), 'Personal interests did not expand candidates');
  assert(await row.getByRole('button').first().textContent() === magic.title, 'Interest candidate was not ranked first');
  const measure = () => page.evaluate(() => {
    const row = document.querySelector('.recommendations-row');
    const list = row.querySelector('ul');
    const tops = [...list.children].map(item => item.getBoundingClientRect().top);
    return { first: row.parentElement.firstElementChild === row, height: row.getBoundingClientRect().height, singleRow: tops.every(top => Math.abs(top - tops[0]) < 1), scrollable: list.scrollWidth > list.clientWidth, fits: document.documentElement.scrollWidth <= innerWidth };
  });
  const desktop = await measure();
  assert(desktop.first && desktop.height <= 72 && desktop.singleRow && desktop.scrollable && desktop.fits, 'Desktop recommendations must occupy one compact row above results');
  await page.screenshot({ path: 'output/playwright/recommendations-desktop.png' });
  const filtered = new URL('/?q=needle&version=1.20.1&loader=fabric&kind=mod&category=modrinth:optimization', origin).href;
  await page.goto(filtered);
  await row.getByRole('button', { name: magic.title, exact: true }).waitFor();
  await chooseRecommendation();
  await page.screenshot({ path: 'output/playwright/recommendation-search-desktop.png' });
  await page.goBack();
  await page.waitForURL(filtered);
  assert(await page.getByRole('searchbox', { name: '모드 검색어', exact: true }).inputValue() === 'needle' && await page.locator('.sheet,.sheet-backdrop').count() === 0, 'Back restored a recommendation detail panel instead of the previous search');
  await page.goForward();
  await page.waitForURL(url => url.searchParams.get('q') === magic.title);
  assert(await page.locator('.sheet,.sheet-backdrop').count() === 0, 'Forward reopened a recommendation detail panel');
  await page.reload();
  await row.getByRole('button', { name: magic.title, exact: true }).waitFor();
  assert((await stored()).recommendationsEnabled === true, 'Enabled setting did not survive reload');
  await submit('new search');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('modfinder:local:v1')).interests.some(event => event.query === 'new search'));
  await row.getByRole('button', { name: magic.title, exact: true }).waitFor();

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await measure();
  assert(mobile.first && mobile.height <= 72 && mobile.singleRow && mobile.scrollable && mobile.fits, 'Mobile recommendations must stay in one scrollable row');
  await page.screenshot({ path: 'output/playwright/recommendations-mobile.png', fullPage: true });
  await chooseRecommendation();
  await page.screenshot({ path: 'output/playwright/recommendation-search-mobile.png' });
  await page.goto(new URL('/?game=all&q=all-games', origin).href);
  await row.getByRole('button', { name: magic.title, exact: true }).waitFor();
  await chooseRecommendation(true);
  await chooseRecommendation(true);
  assert(await page.locator('.sheet,.sheet-backdrop').count() === 0, 'Repeated recommendation selection opened a detail panel');
  await openSettings();
  await toggle.click();
  await closeSettings();
  assert(await page.locator('.recommendations-row').count() === 0, 'Disabling recommendations left a row behind');
  const before = (await stored()).interests.length;
  const candidateRequests = searches.filter(request => request.query === '').length;
  await submit('disabled search');
  assert((await stored()).interests.length === before, 'Disabled recommendations kept collecting signals');
  assert(searches.filter(request => request.query === '').length === candidateRequests, 'Disabled recommendations kept fetching candidates');
  await page.reload();
  await page.locator('.results-content>.mod-grid .mod-card').first().waitFor();
  assert((await stored()).recommendationsEnabled === false && await page.locator('.recommendations-row').count() === 0, 'Disabled preference did not survive reload');
  await openSettings(); await toggle.click(); await closeSettings();
  await page.getByRole('button', { name: '메인 화면으로 이동', exact: true }).click();
  await page.locator('.ranking-panel').waitFor();
  assert(await page.locator('.recommendations-row').count() === 0, 'Enabled recommendations appeared on home');
  assert(await page.getByRole('group', { name: '순위 종류', exact: true }).getByRole('button').count() === 2, 'Recommendation tab returned to home');
  assert(errors.length === 0, errors.join('\n'));
  return { defaultDisabled: true, legacyDisabled: true, persistence: true, interestOptIn: true, homeExcluded: true, recommendationSearch: { desktop: true, mobile: true, keyboard: true, gameScoped: true, filtersCleared: true, modpack: true, history: true, repeated: true, detailPanel: false }, desktop, mobile };
}
