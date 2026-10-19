// Run with Playwright CLI: run-code --filename=tooling/scripts/verify-native-layout.js
async (page) => {
  const check = (value, message) => { if (!value) throw new Error(message); };
  const browser = page.context().browser();
  const results = [];
  for (const native of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, reducedMotion: 'reduce' });
    const errors = [];
    const target = await context.newPage();
    target.on('pageerror', error => errors.push(error.message));
    await context.addInitScript(isNative => {
      localStorage.setItem('modfinder-intro-seen', '1');
      document.cookie = 'mf-language=ko; Path=/; SameSite=Lax';
      if (isNative) window.__TAURI_INTERNALS__ = { invoke: async command => command === 'load_local_state' ? null : undefined };
    }, native);
    await target.route('**/v1/**', route => {
      const params = new URL(route.request().url()).searchParams;
      return route.fulfill({ json: {
        source: params.get('source'), status: 'empty', items: [], nextCursor: null, total: 0,
        fetchedAt: new Date().toISOString(), cached: false, appliedFilters: {}, unsupportedFilters: [],
        externalUrl: null, queryForwarded: true, message: '',
      } });
    });
    try {
      await target.goto(page.url());
      await target.locator('#mod-query').waitFor();
      for (const width of [1360, 850, 650, 390, 1600, 1360]) {
        await target.setViewportSize({ width, height: 900 });
        const mobileHeader = !native && width <= 1400;
        await target.waitForFunction(expected => !!document.querySelector('.mobile-header') === expected, mobileHeader);
        check(await target.locator('html').evaluate((el, expected) => el.hasAttribute('data-native') === expected, native), 'Native CSS gate');
        check(await target.locator('.hero-brand').count() === (mobileHeader ? 0 : 1), `Hero brand: ${native}/${width}`);
        const height = await target.locator('.search-box').evaluate(el => el.getBoundingClientRect().height);
        check(height === (!native && width <= 850 ? 64 : 106), `Search height: ${native}/${width}: ${height}`);
        const columns = await target.locator('.ranking-list').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
        check(columns === 2, `Ranking columns: ${native}/${width}`);
        if (!native) check(await target.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Web overflow: ${width}`);
      }
      await target.screenshot({ path: `output/playwright/${native ? 'native' : 'web'}-layout-1360.png` });
      for (const width of [850, 390]) {
        await target.setViewportSize({ width, height: 900 });
        await target.getByRole('button', { name: '설정 메뉴', exact: true }).click();
        await target.getByRole('dialog', { name: '설정 메뉴', exact: true }).waitFor();
        check(await target.locator('.settings-menu .picker-grid').count() === (native ? 0 : 1), `Settings cards: ${native}/${width}`);
        check(await target.locator('.settings-rail').evaluate(el => getComputedStyle(el).flexDirection) === (native ? 'row' : 'column'), `Settings rail: ${native}/${width}`);
        await target.getByRole('button', { name: '닫기', exact: true }).click();
        await target.getByRole('button', { name: '게임 바꾸기', exact: true }).click();
        await target.locator('.game-deck').waitFor();
        check((await target.locator('.game-deck .picker-grid').count() > 0) === !native, `Game cards: ${native}/${width}`);
        check(await target.locator('.deck-rail').evaluate(el => getComputedStyle(el).flexDirection) === (native ? 'row' : 'column'), `Game rail: ${native}/${width}`);
        if (width === 850) await target.screenshot({ path: `output/playwright/${native ? 'native' : 'web'}-game-picker-850.png` });
        await target.getByRole('button', { name: '닫기', exact: true }).click();
      }
      await target.locator('#mod-query').fill('layout check');
      await target.locator('.search-submit').click();
      await target.locator('.has-results').waitFor();
      const outline = await target.locator('.result-panel-outline').evaluate(el => getComputedStyle(el).display);
      check((outline !== 'none') === native, `Search results outline: ${native}`);
      check(await target.locator('.search-box').evaluate(el => {
        const style = getComputedStyle(el);
        return style.animationName === 'none' && style.transitionDuration === '0s';
      }), 'Reduced motion stays effective');
      check(errors.length === 0, errors.join('\n'));
      results.push({ native, resizedWindows: 6, pickerWidths: [850, 390], searchResults: true, reducedMotion: true, pageErrors: errors });
    } finally { await context.close(); }
  }
  return results;
}
