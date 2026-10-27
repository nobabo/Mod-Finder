// Run through Playwright CLI with the app open. Captures stay in output/playwright.
async (page) => {
  const base = new URL(page.url()).origin;
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const contexts = [];
  const errors = [];
  const reports = [];
  try {
    for (const mobile of [false, true]) {
      const context = await page.context().browser().newContext({
        viewport: { width: mobile ? 390 : 1536, height: mobile ? 844 : 960 },
        isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce',
      });
      contexts.push(context);
      await context.addInitScript(() => {
        document.cookie = 'mf-language=ko; Path=/';
        localStorage.setItem('modfinder-intro-seen', '1');
      });
      const tab = await context.newPage();
      tab.on('pageerror', error => errors.push(error.message));
      const button = name => tab.getByRole('button', { name, exact: true });
      for (const game of ['minecraft-java', 'stardew-valley']) {
        await tab.goto(`${base}/?game=${game}`);
        await tab.locator('.game-characters').waitFor();
        await tab.evaluate(() => document.fonts.ready);
        await tab.locator('.game-character img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
        await tab.locator('.game-backdrop-photo').evaluate(image => image.decode());
        const inspect = async () => tab.evaluate(() => {
          const field = document.querySelector('.search-field');
          const form = field.querySelector('.search-box');
          const art = field.querySelector('.game-characters');
          const box = form.getBoundingClientRect();
          const representative = art.querySelector('.is-representative').getBoundingClientRect();
          return {
            game: document.documentElement.dataset.gameTheme,
            photo: document.querySelector('.game-backdrop-photo').getAttribute('src'),
            opacity: getComputedStyle(document.querySelector('.game-backdrop-photo')).opacity,
            representatives: art.querySelectorAll('.is-representative').length,
            above: [...art.children].filter(el => el.getBoundingClientRect().top < box.top).length,
            centered: Math.abs(representative.x + representative.width / 2 - box.x - box.width / 2) < 15,
            foreground: Number(getComputedStyle(form).zIndex) > Number(getComputedStyle(art).zIndex),
            border: getComputedStyle(form, '::after').backgroundImage,
            overflow: document.documentElement.scrollWidth > innerWidth,
            webgl: document.querySelectorAll('.atmosphere-canvas').length,
            placeholder: document.querySelector('#mod-query').placeholder,
          };
        });
        const report = await inspect();
        check(report.game === (game === 'minecraft-java' ? 'minecraft' : 'stardew'), 'Game palette follows selection');
        check(report.photo.includes(game) && Number(report.opacity) > 0 && Number(report.opacity) <= .08, 'Matching faint photograph');
        check(report.representatives === 1 && report.above === 1 && report.centered, 'One representative centered above search');
        check(report.foreground && report.border.includes('gradient'), 'Search and glass border are above characters');
        check(!report.overflow && report.webgl === 0, 'No overflow or dark scene renderer');
        await tab.screenshot({ path: `output/playwright/${game}-${mobile ? 'mobile' : 'desktop'}-final.png` });
        await button('설정 메뉴').click();
        await tab.getByRole('dialog', { name: '설정 메뉴', exact: true }).waitFor();
        const card = button('즐겨찾기');
        const cardBackground = await card.evaluate(el => ({ color: getComputedStyle(el).backgroundColor, image: getComputedStyle(el).backgroundImage }));
        check(cardBackground.color === 'rgba(0, 0, 0, 0)' && cardBackground.image === 'none', 'Unselected option cards are transparent');
        check(await tab.locator('#mod-query').getAttribute('placeholder') === report.placeholder, 'Settings preserve search placeholder');
        const recommendation = tab.getByRole('switch', { name: '맞춤 추천', exact: true });
        const wasSelected = await recommendation.getAttribute('aria-checked') === 'true';
        if (!wasSelected) await recommendation.click();
        check((await recommendation.evaluate(el => getComputedStyle(el).backgroundImage)).includes('gradient'), 'Selected card is translucent');
        await tab.screenshot({ path: `output/playwright/${game}-${mobile ? 'mobile' : 'desktop'}-settings.png` });
        if (!wasSelected) await recommendation.click();
        await button('테마').click();
        await button('시안').click();
        check(await tab.locator('html').getAttribute('data-game-theme') === null, 'Custom color overrides game palette');
        await button('게임 기본').click();
        await button('닫기').click();
        await tab.reload();
        await tab.locator('.game-characters').waitFor();
        check(await tab.evaluate(() => localStorage.getItem('modfinder-theme')) === 'game', 'Game default survives reload');
        if (mobile) {
          await tab.setViewportSize({ width: 320, height: 740 });
          check(!(await inspect()).overflow, 'Narrow mobile has no horizontal overflow');
          await tab.setViewportSize({ width: 390, height: 844 });
        }
        await tab.locator('#mod-query').fill(game === 'minecraft-java' ? 'sodium' : 'SMAPI');
        await button('모드 검색').click();
        await tab.locator('.results-content').waitFor();
        check(await tab.locator('.game-characters').count() === 0, 'Compact results keep characters clear of controls');
        await tab.screenshot({ path: `output/playwright/${game}-${mobile ? 'mobile' : 'desktop'}-results.png` });
        reports.push({ ...report, mobile, transparentOptions: true, selectedTint: true, persistent: true });
      }
      await tab.goto(`${base}/?game=valheim`);
      check(await tab.locator('html').getAttribute('data-game-theme') === null, 'Other games retain their photographic theme');
      await tab.locator('.atmosphere-canvas').waitFor();
    }
    check(errors.length === 0, errors.join('\n'));
    return { passed: true, reports, pageErrors: errors };
  } finally {
    await Promise.all(contexts.map(context => context.close()));
  }
}
