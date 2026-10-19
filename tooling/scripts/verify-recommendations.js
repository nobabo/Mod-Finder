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
  const magic = make('recommendation-magic', 'Magic Example', 'Magic spells and adventure dungeons');
  await page.route('**/v1/search?**', async route => {
    const params = new URL(route.request().url()).searchParams;
    const source = params.get('source'), query = params.get('query');
    searches.push({ source, query });
    const items = source !== 'modrinth' ? [] : query === 'magic' ? [magic] : Array.from({ length: 12 }, (_, index) => make(`example-${index}`, `Example ${index + 1}`));
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
    return { filter: style.filter, animation: animation?.playState, y: new DOMMatrix(style.transform).m42, drop: parseFloat(style.getPropertyValue('--card-drop')) || 0 };
  });
  const freezePick = () => toggle.evaluate(element => {
    const animation = element.getAnimations().find(item => item.animationName === 'genre-card-pick');
    if (animation) { animation.pause(); animation.currentTime = 190; }
  });
  const finishPick = () => toggle.evaluate(element => {
    for (const animation of element.getAnimations()) animation.finish();
  });
  const drawFits = () => toggle.evaluate(element => element.getBoundingClientRect().top >= element.closest('.settings-rail').getBoundingClientRect().top);
  assert((await visual()).filter === 'grayscale(1)', 'Disabled recommendation card is not grayscale');
  await page.screenshot({ path: 'output/playwright/recommendation-card-off.png' });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await toggle.focus(); await page.keyboard.press('Space');
  assert(await toggle.getAttribute('aria-checked') === 'true' && (await visual()).animation === 'running', 'Keyboard activation did not play the shared genre effect');
  await freezePick();
  const lifted = await visual();
  assert(lifted.y < lifted.drop - 25, 'Recommendation card did not draw upward like a genre card');
  assert(await drawFits(), 'Desktop draw animation was clipped');
  await page.screenshot({ path: 'output/playwright/recommendation-card-on-desktop.png' });
  await finishPick();
  await toggle.dispatchEvent('click'); await toggle.dispatchEvent('click');
  assert(await toggle.evaluate(element => element.getAnimations().filter(item => item.animationName === 'genre-card-pick').length) === 1, 'Repeated toggles stacked draw animations');
  await finishPick();
  await page.setViewportSize({ width: 390, height: 844 });
  await toggle.dispatchEvent('click'); await toggle.dispatchEvent('click');
  assert((await visual()).animation === 'running', 'Mobile recommendation card did not animate');
  await freezePick();
  assert((await visual()).y < -10, 'Mobile card did not lift');
  assert(await drawFits(), 'Mobile draw animation was clipped');
  await page.screenshot({ path: 'output/playwright/recommendation-card-on-mobile.png' });
  await finishPick();
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
  await row.getByRole('button', { name: magic.title, exact: true }).click();
  await page.getByRole('dialog', { name: magic.title, exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await page.locator('.sheet').waitFor({ state: 'detached' });
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
  return { defaultDisabled: true, legacyDisabled: true, persistence: true, interestOptIn: true, homeExcluded: true, detail: true, desktop, mobile };
}
