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
          const rankBox = ranking.getBoundingClientRect();
          const companions = [...ranking.querySelectorAll('.is-companion')].map(el => el.getBoundingClientRect());
          const decorations = [...document.querySelectorAll('.game-characters .is-companion')].map(el => el.getBoundingClientRect());
          const text = [];
          const walker = document.createTreeWalker(ranking, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) if (walker.currentNode.textContent.trim()) {
            const range = document.createRange(); range.selectNodeContents(walker.currentNode);
            text.push(...range.getClientRects());
          }
          const upperRight = art.querySelector('.artwork-search-right').getBoundingClientRect();
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
            searchCorners: representative.left >= box.left && representative.right < box.left + box.width * .45 && representative.bottom < box.top && upperRight.right <= box.right && upperRight.left > box.left + box.width * .6 && upperRight.bottom < box.top,
            foreground: Number(getComputedStyle(art).zIndex) > Number(getComputedStyle(form).zIndex),
            companions: companions.length,
            searchClear: [representative,upperRight].every(rect=>!overlaps(rect,box)),
            textClear: decorations.every(rect => text.every(label => !overlaps(rect, label))),
            filterClear: decorations.every(rect => !overlaps(rect, filter)),
            artworkInView: decorations.every(rect => rect.left >= 0 && rect.right <= innerWidth),
            brandTop: document.querySelector('.app-brand-header').getBoundingClientRect().top,
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
        check(report.representatives === 1 && report.searchCorners, 'Artwork follows the reference search corners');
        check(report.foreground && report.border.includes('gradient'), 'Full artwork remains visible over the search outline');
        check(report.companions === 0 && report.searchClear && report.textClear && report.filterClear, 'Two elements keep the entire search field and ranking clear');
        check(report.artworkInView && report.brandTop === 24, 'Artwork stays in view and MF is lowered by 16px');
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
        await button('크림슨').click();
        check(await tab.locator('html').getAttribute('data-game-theme') === null, 'Custom color overrides game palette');
        await button('자동 색상').click();
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
