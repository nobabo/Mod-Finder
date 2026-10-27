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
        await tab.locator('.game-characters-search').waitFor();
        await tab.evaluate(() => document.fonts.ready);
        await tab.locator('.game-character img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
        await tab.locator('.atmosphere.is-ready').waitFor();
        await tab.locator('.search-box>.glass-control-surface').waitFor({ state: 'visible' });
        const inspect = async () => tab.evaluate(() => {
          const field = document.querySelector('.search-field');
          const form = field.querySelector('.search-box');
          const art = field.querySelector('.game-characters');
          const box = form.getBoundingClientRect();
          const representative = art.querySelector('.is-representative').getBoundingClientRect();
          const ranking = document.querySelector('.ranking-panel');
          const companions = [...ranking.querySelectorAll('.is-companion')].map(el => el.getBoundingClientRect());
          const text = [...ranking.querySelectorAll('.ranking-tabs button,.ranking-list strong,.ranking-pagination,.title-button')].map(el => el.getBoundingClientRect());
          const filter = document.querySelector('.filter-orb').getBoundingClientRect();
          const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
          const transparent = el => getComputedStyle(el).backgroundColor === 'rgba(0, 0, 0, 0)' && getComputedStyle(el).backgroundImage === 'none';
          const scene = document.querySelector('.atmosphere');
          const lens = form.querySelector('.glass-control-surface');
          return {
            game: document.documentElement.dataset.gameTheme,
            photo: scene.dataset.background,
            photos: Number(scene.dataset.backgroundCount),
            representatives: art.querySelectorAll('.is-representative').length,
            above: [...art.children].filter(el => el.getBoundingClientRect().top < box.top).length,
            centered: Math.abs(representative.x + representative.width / 2 - box.x - box.width / 2) < 15,
            foreground: Number(getComputedStyle(form).zIndex) > Number(getComputedStyle(art).zIndex),
            companions: companions.length,
            rankingCorners: companions.every(rect => rect.top >= ranking.getBoundingClientRect().top),
            textClear: companions.every(rect => text.every(label => !overlaps(rect, label))),
            filterClear: companions.every(rect => !overlaps(rect, filter)),
            transparentSurfaces: transparent(form) && transparent(ranking),
            border: getComputedStyle(form, '::after').backgroundImage,
            overflow: document.documentElement.scrollWidth > innerWidth,
            webgl: document.documentElement.dataset.glass === 'webgl',
            refractedPixels: !!lens && lens.width > 0 && lens.getContext('2d').getImageData(Math.floor(lens.width / 2), Math.floor(lens.height / 2), 1, 1).data[3] === 255,
            placeholder: document.querySelector('#mod-query').placeholder,
          };
        });
        const report = await inspect();
        check(report.game === (game === 'minecraft-java' ? 'minecraft' : 'stardew'), 'Game palette follows selection');
        check(report.photo.includes(game) && report.photos === 5, 'Five matching photographs');
        check(report.representatives === 1 && report.above === 1 && report.centered, 'One representative centered above search');
        check(report.foreground && report.border.includes('gradient'), 'Search and glass border are above characters');
        check(report.companions === 4 && report.rankingCorners && report.textClear && report.filterClear, 'Companions stay at ranking corners, clear of text and filter');
        check(report.transparentSurfaces, 'Search and ranking have no white fill');
        check(!report.overflow && report.webgl && report.refractedPixels, 'Actual WebGL refraction without overflow');
        await tab.screenshot({ path: `output/playwright/${game}-${mobile ? 'mobile' : 'desktop'}-final.png` });
        await button('설정 메뉴').click();
        await tab.getByRole('dialog', { name: '설정 메뉴', exact: true }).waitFor();
        const card = button('즐겨찾기');
        await card.locator('.glass-control-surface').waitFor({ state: 'visible' });
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
        await tab.locator('.game-characters-search').waitFor();
        check(await tab.evaluate(() => localStorage.getItem('modfinder-theme')) === 'game', 'Game default survives reload');
        if (mobile) {
          await tab.setViewportSize({ width: 320, height: 740 });
          const narrow = await inspect();
          check(!narrow.overflow && narrow.textClear && narrow.filterClear, 'Narrow mobile keeps all text and controls clear');
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
    const rotationContext = await page.context().browser().newContext({ reducedMotion: 'no-preference', viewport: { width: 1536, height: 960 } });
    contexts.push(rotationContext);
    await rotationContext.addInitScript(() => {
      document.cookie = 'mf-language=ko; Path=/';
      localStorage.setItem('modfinder-intro-seen', '1');
    });
    const rotationTab = await rotationContext.newPage();
    rotationTab.on('pageerror', error => errors.push(error.message));
    await rotationTab.clock.install();
    await rotationTab.goto(`${base}/?game=minecraft-java`);
    const activePhoto = () => rotationTab.locator('.atmosphere').getAttribute('data-background');
    await rotationTab.locator('.atmosphere.is-ready').waitFor();
    const seen = new Set();
    for (let index = 0; index < 5; index++) {
      seen.add(await activePhoto());
      await rotationTab.clock.fastForward(20000);
    }
    check(seen.size === 5, 'All five shuffled backgrounds rotate');
    await rotationTab.getByRole('button', { name: '설정 메뉴', exact: true }).click();
    const pausedPhoto = await activePhoto();
    await rotationTab.clock.fastForward(40000);
    check(await activePhoto() === pausedPhoto, 'Rotation pauses behind dialogs');
    await rotationTab.getByRole('button', { name: '닫기', exact: true }).click();
    await rotationTab.emulateMedia({ reducedMotion: 'reduce' });
    const stillPhoto = await activePhoto();
    await rotationTab.clock.fastForward(40000);
    check(await activePhoto() === stillPhoto, 'Reduced motion keeps the photograph still');
    check(errors.length === 0, errors.join('\n'));
    return { passed: true, reports, rotatingBackgrounds: seen.size, pausedBehindDialogs: true, reducedMotion: true, pageErrors: errors };
  } finally {
    await Promise.all(contexts.map(context => context.close()));
  }
}
