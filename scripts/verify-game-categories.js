// Run with Playwright CLI: run-code --filename=scripts/verify-game-categories.js
async (page) => {
  const assert = (value, message) => { if (!value) throw Error(message); };
  const requests = [];
  const paramsFor = url => Object.fromEntries((url.split('?')[1] ?? '').split('&').filter(Boolean).map(pair => { const [key, value = ''] = pair.split('='); return [decodeURIComponent(key), decodeURIComponent(value.replace(/\+/g, ' '))]; }));
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route('**/v1/search?**', async route => {
    const params = paramsFor(route.request().url());
    requests.push(params);
    await route.fulfill({ json: { source: params.source, status: 'empty', items: [], nextCursor: null, total: 0, fetchedAt: new Date().toISOString(), cached: false, appliedFilters: { category: params.category }, unsupportedFilters: [], externalUrl: null, queryForwarded: true, message: '검색 결과가 없어요' } });
  });
  await page.reload();
  const openCategories = async () => {
    await page.getByRole('button', { name: '검색 필터', exact: true }).click();
    await page.getByRole('button', { name: '장르', exact: true }).click();
  };
  await openCategories();
  await page.getByRole('combobox', { name: '모드 로더', exact: true }).selectOption('fabric');
  await page.getByRole('textbox', { name: '게임 버전', exact: true }).fill('1.21.1');
  await page.getByRole('button', { name: '최적화', exact: true }).click();
  await page.waitForResponse(response => response.url().includes('category=modrinth%3Aoptimization'));
  assert(requests.at(-1).gameId === 'minecraft-java' && requests.at(-1).loader === 'fabric' && requests.at(-1).version === '1.21.1', 'Category lost game or compatibility filters');
  assert(await page.locator('#mod-query').getAttribute('placeholder') === '검색할 모드를 입력하세요.', 'Search placeholder changed');
  await openCategories();
  assert(await page.getByRole('button', { name: '최적화', exact: true }).getAttribute('aria-pressed') === 'true', 'Selection not retained');
  await page.screenshot({ path: 'output/playwright/categories-minecraft.png' });
  await page.getByRole('button', { name: '전체 장르', exact: true }).click();
  await page.locator('#mod-query').fill('test');
  await page.locator('#mod-query').press('Enter');
  for (const [game, gameId, category, id, absent] of [
    ['스타듀 밸리', 'stardew-valley', '작물', 'nexus:Crops', '최적화'],
    ['리썰 컴퍼니', 'lethal-company', '위성', 'thunderstore:690', '작물'],
    ['림월드', 'rimworld', '시나리오', 'steam:Scenario', '위성'],
  ]) {
    await page.getByRole('button', { name: '게임 바꾸기', exact: true }).click();
    await page.getByRole('textbox', { name: '게임 찾기', exact: true }).fill(game);
    await page.getByRole('button', { name: game, exact: true }).click();
    await openCategories();
    assert(await page.getByRole('button', { name: absent, exact: true }).count() === 0, 'Previous game categories leaked');
    assert(await page.getByRole('button', { name: '전체 장르', exact: true }).getAttribute('aria-pressed') === 'true', 'Game change did not reset category');
    assert(await page.getByRole('textbox', { name: '게임 버전', exact: true }).count() === 0, 'Minecraft controls leaked');
    await page.screenshot({ path: `output/playwright/categories-${gameId}.png` });
    const response = page.waitForResponse(response => paramsFor(response.url()).category === id);
    await page.getByRole('button', { name: category, exact: true }).click();
    await response;
    assert(requests.at(-1).gameId === gameId && requests.at(-1).query === 'test' && requests.at(-1).category === id && !requests.at(-1).loader, 'Wrong category search');
  }
  assert(errors.length === 0, errors.join('\n'));
  return { checked: ['minecraft-java', 'stardew-valley', 'lethal-company', 'rimworld'], categoryRequests: requests.filter(request => request.category), errors };
}
