// Playwright CLI: run-code --filename=tooling/scripts/verify-history-delete.js
async (page) => {
  const assert = (ok, message) => { if (!ok) throw Error(message); };
  const origin = new URL(page.url()).origin;
  page.setDefaultTimeout(10000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const fixture = {
    recommendationsEnabled: false, favorites: [], folders: [], compared: [], favoriteGames: ['minecraft-java'],
    history: [{ gameId: 'minecraft-java', query: 'shared query' }, { gameId: 'stardew-valley', query: 'shared query' }, { gameId: 'minecraft-java', query: 'another query' }],
    interests: [{ gameId: 'minecraft-java', query: 'magic', topics: ['magic'], weight: 2, at: Date.now() }],
  };
  let searches = 0;
  await page.addInitScript(data => {
    if (new URL(location.href).searchParams.has('seed-history')) {
      localStorage.setItem('modfinder:local:v1', JSON.stringify(data));
      document.cookie = 'mf-language=ko; Path=/; SameSite=Lax';
    }
  }, fixture);
  await page.route('**/v1/search?**', async route => {
    searches++;
    const source = new URL(route.request().url()).searchParams.get('source');
    await route.fulfill({ json: { source, status: 'empty', items: [], nextCursor: null, total: 0, fetchedAt: new Date().toISOString(), appliedFilters: {}, unsupportedFilters: [], verifiedLinks: [], message: '', externalUrl: null, queryForwarded: true } });
  });
  const seed = async () => {
    await page.goto(`${origin}/?seed-history=1`);
    await page.goto(`${origin}/?page=recent`);
    await page.locator('.history-row').first().waitFor();
  };
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('modfinder:local:v1')));
  for (const [width, height] of [[1440, 1000], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await seed();
    const before = searches;
    const url = page.url();
    const rows = page.locator('.history-row');
    assert(await rows.count() === 3 && await rows.locator('button button').count() === 0, 'History must use independent search and delete buttons');
    await rows.nth(1).getByRole('button', { name: '검색 기록 삭제 · shared query', exact: true }).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('modfinder:local:v1')).history.length === 2);
    const remaining = await stored();
    assert(remaining.history[0].gameId === 'minecraft-java' && remaining.history[0].query === 'shared query', 'Deleting one game removed a matching query from another game');
    assert(remaining.interests.length === 1 && remaining.favorites.length === 0, 'Deleting history modified unrelated preferences');
    assert(page.url() === url && searches === before, 'Deleting history triggered a search or navigation');
    await page.reload();
    await rows.first().waitFor();
    assert(await rows.count() === 2, 'Deleted history returned after reload');
    await page.screenshot({ path: `output/playwright/history-delete-${width}.png` });
    const remove = rows.first().getByRole('button', { name: '검색 기록 삭제 · shared query', exact: true });
    await remove.focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('modfinder:local:v1')).history.length === 1);
    await rows.first().getByRole('button', { name: '검색 기록 삭제 · another query', exact: true }).click();
    await page.getByRole('img', { name: '새로운 발견을 시작해 보세요', exact: true }).waitFor();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('modfinder:local:v1')).history.length === 0);
    await page.reload();
    await page.getByRole('img', { name: '새로운 발견을 시작해 보세요', exact: true }).waitFor();
    assert(await rows.count() === 0, 'Last deleted history returned after reload');
    await seed();
    await page.getByRole('button', { name: '검색 기록 지우기', exact: true }).click();
    await page.waitForFunction(() => { const data = JSON.parse(localStorage.getItem('modfinder:local:v1')); return !data.history.length && !data.interests.length; });
    await seed();
    await rows.first().locator('.history-search').click();
    await page.waitForURL(url => url.searchParams.get('q') === 'shared query' && !url.searchParams.has('page'));
  }
  return { desktop: true, mobile: true, keyboard: true, individual: true, sameQueryDifferentGames: true, persistence: true, emptyState: true, clearAll: true, searchRetained: true };
}
