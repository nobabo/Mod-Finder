// Playwright CLI: run-code --filename=tooling/scripts/verify-catalog-titles.js
async (page) => {
  const origin = new URL(page.url()).origin;
  const context = await page.context().browser().newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const errors = [], searches = [];
  try {
    await context.addCookies([{ name: 'mf-language', value: 'ko', url: origin }]);
    await context.addInitScript(() => localStorage.setItem('modfinder-intro-seen', '1'));
    const tab = await context.newPage();
    tab.on('pageerror', error => errors.push(error.message));
    tab.on('request', request => {
      const url = new URL(request.url());
      if (url.pathname === '/v1/search') searches.push(Object.fromEntries(url.searchParams));
    });
    await tab.goto(origin + '/?q=&kind=mod');
    const jei = tab.getByRole('button', { name: '저스트 이너프 아이템 (JEI)', exact: true }).first();
    await jei.waitFor({ timeout: 45000 });
    await tab.getByRole('button', { name: '마우스 트윅', exact: true }).first().waitFor({ timeout: 45000 });
    await tab.getByRole('button', { name: '게코립', exact: true }).first().waitFor({ timeout: 45000 });
    for (const width of [1440, 390]) {
      await tab.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await tab.mouse.move(0, 0);
      await tab.screenshot({ path: `output/playwright/curseforge-korean-titles-${width}.png` });
      await jei.focus(); await jei.press('Enter');
      const detail = tab.getByRole('dialog');
      await detail.getByRole('button', { name: '닫기', exact: true }).focus();
      await detail.getByText('저스트 이너프 아이템 (JEI)', { exact: true }).waitFor();
      await detail.locator('summary').filter({ hasText: '원문 보기' }).click();
      await detail.getByText('Just Enough Items (JEI)', { exact: true }).waitFor();
      await tab.screenshot({ path: `output/playwright/curseforge-korean-title-detail-${width}.png` });
      await tab.keyboard.press('Escape');
      if (await tab.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw Error('Horizontal overflow');
    }
    await tab.getByRole('searchbox', { name: '모드 검색어', exact: true }).fill('마우스 트윅');
    await tab.getByRole('button', { name: '모드 검색', exact: true }).click();
    await tab.getByRole('button', { name: '마우스 트윅', exact: true }).first().waitFor({ timeout: 45000 });
    if (!searches.some(request => request.source === 'curseforge' && request.query === 'Mouse Tweaks')) throw Error('Korean title did not reach CurseForge');
    await context.addCookies([{ name: 'mf-language', value: 'en', url: origin }]);
    await tab.goto(origin + '/?q=Mouse%20Tweaks&kind=mod');
    await tab.getByRole('button', { name: 'Mouse Tweaks', exact: true }).first().waitFor({ timeout: 45000 });
    if (errors.length) throw Error(errors.join('\n'));
    return { viewports: [1440, 390], koreanTitles: ['JEI', 'Mouse Tweaks', 'GeckoLib'], originalVisible: true, koreanProviderSearch: true, englishTitle: true, errors };
  } finally { await context.close(); }
}
