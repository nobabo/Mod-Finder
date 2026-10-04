// Run through Playwright CLI: run-code --filename tooling/scripts/verify-fuzzy-search.js
async (page) => {
  const assert = (condition, message) => { if (!condition) throw Error(message); };
  const requests = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/v1/search?**', async route => {
    const params = new URL(route.request().url()).searchParams;
    const source = params.get('source'); const query = params.get('query');
    requests.push({ source, query });
    const found = source === 'modrinth' && ['Sodium', 'battery', 'batteries', 'Iris'].includes(query);
    const now = new Date().toISOString();
    const items = found ? [{ key: `modrinth:minecraft:fuzzy-${query}`, id: `fuzzy-${query}`,
      source, scope: 'minecraft', gameId: 'minecraft-java', title: `Verified ${query}`, summary: 'Browser test fixture',
      rank: 1, author: null, url: 'https://modrinth.com/mod/sodium', iconUrl: null, updatedAt: null,
      versions: null, loaders: null, kind: 'mod', metrics: [], tags: [], fetchedAt: now }] : [];
    await route.fulfill({ json: { source, status: found ? 'success' : 'empty', items, nextCursor: null,
      total: found ? 1 : 0, fetchedAt: now, cached: false, appliedFilters: {}, unsupportedFilters: [],
      externalUrl: null, queryForwarded: true, message: '' } });
  });
  const input = page.getByRole('searchbox', { name: '모드 검색어', exact: true });
  await input.fill('소듕'); await input.press('Enter');
  await page.getByText('Verified Sodium', { exact: true }).waitFor();
  assert(await input.inputValue() === '소듕', 'Search input was replaced');
  const sodium = requests.filter(request => request.source === 'modrinth').map(request => request.query);
  assert(sodium.join('|') === '소듕|thebd|Sodium', `Unexpected retry order: ${sodium}`);
  await page.screenshot({ path: 'output/playwright/fuzzy-korean.png', fullPage: true });

  requests.length = 0;
  await input.fill('battery'); await input.press('Enter');
  await page.getByText('Verified battery', { exact: true }).waitFor();
  await page.getByText('Verified batteries', { exact: true }).waitFor();
  assert(requests.filter(request => request.source === 'modrinth').length === 2, 'Unexpected plural requests');
  await page.screenshot({ path: 'output/playwright/fuzzy-plurals.png', fullPage: true });

  requests.length = 0;
  await input.fill('Iris'); await input.press('Enter');
  await page.getByText('Verified Iris', { exact: true }).waitFor();
  assert(requests.every(request => request.query === 'Iris'), 'Proper name was altered');
  assert(!errors.length, `Browser errors: ${errors.join(', ')}`);
  await page.unroute('**/v1/search?**');
  console.log(JSON.stringify({ koreanRetryOrder: sodium, pluralResults: ['battery', 'batteries'], properName: 'Iris', pageErrors: errors }));
}
