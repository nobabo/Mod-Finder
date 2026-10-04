// Run with Playwright CLI: run-code --filename=tooling/scripts/verify-filter-card-pick.js
async (page) => {
  const assert = (value, message) => { if (!value) throw Error(message); };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.context().addCookies([{ name: 'mf-language', value: 'ko', url: page.url() }]);
  await page.route('**/v1/**', route => route.fulfill({ json: { source: 'modrinth', status: 'empty', items: [], nextCursor: null, total: 0, fetchedAt: new Date().toISOString(), cached: false, appliedFilters: {}, unsupportedFilters: [], externalUrl: null, queryForwarded: true } }));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload();
  const button = name => page.getByRole('button', { name, exact: true });
  await button('검색 필터').click();
  await button('장르').click();
  const cards = page.locator('.deck-card[aria-pressed][aria-label]');
  const first = cards.nth(0);
  const second = cards.nth(1);
  const animation = card => card.evaluate(element => element.getAnimations().find(item => (item.id === 'filter-card-pick' || item.animationName === 'genre-card-pick'))?.playState);
  const finish = async () => {
    await page.locator('.deck-rail').evaluate(rail => {
      for (const card of rail.querySelectorAll('.deck-card')) {
        for (const item of card.getAnimations()) if ((item.id === 'filter-card-pick' || item.animationName === 'genre-card-pick')) item.finish();
      }
    });
  };
  // Dispatch rapid activations to exercise concurrent and repeated picks without
  // Playwright waiting for an already animated card to become stable.
  await first.dispatchEvent('click');
  assert(await first.getAttribute('aria-pressed') === 'true', 'Category selection was delayed');
  assert(await animation(first) === 'running', 'Category draw animation missing');
  await second.dispatchEvent('click');
  assert(await first.getAttribute('aria-pressed') === 'true' && await second.getAttribute('aria-pressed') === 'true', 'Multi-select lost a selection');
  await first.dispatchEvent('click');
  assert(await first.getAttribute('aria-pressed') === 'false', 'Rapid deselection failed');
  await first.dispatchEvent('click');
  assert(await first.evaluate(element => element.getAnimations().filter(item => (item.id === 'filter-card-pick' || item.animationName === 'genre-card-pick')).length) === 1, 'Repeated activation stacked animations');
  await page.locator('.deck-rail').evaluate(rail => {
    for (const card of rail.querySelectorAll('.deck-card')) {
      for (const item of card.getAnimations()) {
        if ((item.id === 'filter-card-pick' || item.animationName === 'genre-card-pick')) { item.pause(); item.currentTime = 190; }
      }
    }
  });
  assert(await first.evaluate(element => new DOMMatrix(getComputedStyle(element).transform).m42 < -25), 'Card did not rise out of the deck');
  await page.screenshot({ path: 'output/playwright/filter-card-pick-desktop.png' });
  await finish();
  assert(await page.getByRole('dialog', { name: '장르', exact: true }).count() === 1, 'Filter closed after multi-select');
  assert(await first.locator('.sort-selection').count() === 0 && await second.locator('.sort-selection').count() === 0, 'Genre selection still uses check marks');
  assert(await first.evaluate(element => getComputedStyle(element).opacity) === '1', 'Selected card disappeared');
  await button('전체 장르').dispatchEvent('click');
  assert(await first.getAttribute('aria-pressed') === 'false' && await second.getAttribute('aria-pressed') === 'false', 'All categories did not reset multi-select');
  await finish();
  await button('뒤로').click();
  await button('정렬 방법').click();
  await button('최근 업데이트순').dispatchEvent('click');
  assert(await button('최근 업데이트순').getAttribute('aria-pressed') === 'true', 'Sort selection failed');
  assert(await animation(button('최근 업데이트순')) === 'running', 'Sort draw animation missing');
  await finish();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await button('관련도순').dispatchEvent('click');
  assert(await button('관련도순').getAttribute('aria-pressed') === 'true' && !await animation(button('관련도순')), 'Reduced motion did not preserve selection without animation');
  await button('뒤로').click();
  await button('장르').click();
  await first.dispatchEvent('click');
  assert(await first.getAttribute('aria-pressed') === 'true' && !await animation(first), 'Reduced motion category selection failed');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 390, height: 844 });
  await first.evaluate(element => element.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'instant' }));
  await first.dispatchEvent('click');
  await first.dispatchEvent('click');
  assert(await animation(first) === 'running', 'Mobile draw animation missing');
  await first.evaluate(element => { const item = element.getAnimations().find(item => (item.id === 'filter-card-pick' || item.animationName === 'genre-card-pick')); item.pause(); item.currentTime = 190; });
  await page.screenshot({ path: 'output/playwright/filter-card-pick-mobile.png' });
  await finish();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile horizontal overflow');
  await button('닫기').click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await button('게임 바꾸기').click();
  await page.getByRole('textbox', { name: '게임 찾기', exact: true }).fill('스타듀 밸리');
  await button('스타듀 밸리').dispatchEvent('click');
  assert(await button('스타듀 밸리').evaluate(element => getComputedStyle(element).animationName) === 'card-pick', 'Original game draw animation changed');
  await page.getByRole('dialog', { name: '게임 선택', exact: true }).waitFor({ state: 'hidden' });
  assert(errors.length === 0, errors.join('\n'));
  return { checked: ['category draw and return', 'rapid multi-select and repeat', 'selection without checks', 'all reset', 'sort draw', 'reduced motion', 'mobile', 'original game selection'], errors };
}
