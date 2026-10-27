// Playwright CLI: --filename tooling/scripts/verify-artwork-reactions.js
async (page) => {
  const base = new URL(page.url()).origin;
  const check = (condition, message) => { if (!condition) throw Error(message); };
  const reports = [];
  for (const mobile of [false, true]) {
    const context = await page.context().browser().newContext({ viewport: { width: mobile ? 390 : 1536, height: mobile ? 844 : 960 }, isMobile: mobile, hasTouch: mobile, reducedMotion: 'no-preference' });
    try {
      await context.addInitScript(() => {
        localStorage.setItem('modfinder-intro-seen', '1');
        document.cookie = 'mf-language=ko; Path=/';
      });
      const tab = await context.newPage();
      const errors = [];
      tab.on('pageerror', error => errors.push(error.message));
      for (const [game, canvas] of [['minecraft-java', '#14251f'], ['stardew-valley', '#29221c']]) {
        await tab.goto(`${base}/?game=${game}`);
        await tab.locator('.atmosphere.is-ready').waitFor();
        await tab.locator('.game-character img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
        check(await tab.locator('html').evaluate((el, color) => el.style.getPropertyValue('--canvas') === color, canvas), 'Darker game default');
        const art = tab.locator('.game-character .artwork-reaction');
        check(await art.count() === 5, 'All five character images have reactions');
        const targets = [tab.locator(mobile ? '.mobile-header .brand-art' : '.hero-brand .brand-art'), tab.locator('.game-logo.artwork-reaction'), ...await art.all()];
        for (let index = 0; index < targets.length; index++) {
          const target = targets[index];
          if (mobile) await target.tap(); else await target.hover();
          const handle = await target.elementHandle();
          await tab.waitForFunction(el => el.classList.contains('is-reacting'), handle);
          const reaction = await target.evaluate(el => {
            for (const animation of el.getAnimations({ subtree: true })) { animation.pause(); animation.currentTime = 240; }
            const motion = getComputedStyle(el.querySelector('.artwork-motion'));
            const ring = getComputedStyle(el.querySelector('.artwork-ripple'), '::before');
            return { name: motion.animationName, iterations: motion.animationIterationCount, y: new DOMMatrixReadOnly(motion.transform).m42, opacity: Number(ring.opacity), circle: ring.width === ring.height && ring.borderRadius === '50%', waves: el.getAnimations({ subtree: true }).filter(animation => animation.animationName === 'artwork-ripple').length };
          });
          check(reaction.name === 'artwork-pop' && reaction.iterations === '1' && reaction.y < -3, 'One short upward hop');
          check(reaction.opacity > .1 && reaction.circle && reaction.waves === 2, 'Two visible circular ripples');
          if (index === 2) await tab.screenshot({ path: `output/playwright/${game}-${mobile ? 'mobile' : 'desktop'}-artwork-pop.png` });
          await target.evaluate(el => { for (const animation of el.getAnimations({ subtree: true })) animation.play(); });
          await tab.waitForFunction(el => !el.classList.contains('is-reacting'), handle);
          check(await target.locator('.artwork-motion').evaluate(el => getComputedStyle(el).transform === 'none'), 'Returns to rest while pointer stays over the image');
          if (mobile && index === 1) {
            await tab.locator('.game-deck').waitFor({ state: 'visible' });
            await tab.getByRole('button', { name: '닫기', exact: true }).click();
          }
          if (index === 2 && !mobile) {
            await tab.mouse.move(15, 100);
            await target.hover();
            check(await target.evaluate(el => el.classList.contains('is-reacting')), 'Leaving and returning replays the reaction');
            await tab.mouse.move(15, 100);
            check(await target.evaluate(el => el.classList.contains('is-reacting')), 'Quick pointer exit does not cut the reaction short');
            await tab.waitForFunction(el => !el.classList.contains('is-reacting'), handle);
          }
        }
        const input = tab.locator('#mod-query');
        await input.click();
        check(await input.evaluate(el => el === document.activeElement), 'Decorations do not block search focus');
        await tab.emulateMedia({ reducedMotion: 'reduce' });
        const target = art.first();
        if (mobile) await target.tap(); else await target.hover();
        check(await target.evaluate(el => !el.classList.contains('is-reacting') && el.getAnimations({ subtree: true }).length === 0), 'Reduced motion suppresses hops and ripples');
        await tab.emulateMedia({ reducedMotion: 'no-preference' });
        await tab.getByRole('button', { name: '게임 바꾸기', exact: true }).click();
        await tab.locator('.game-deck').waitFor({ state: 'visible' });
        await tab.getByRole('button', { name: '닫기', exact: true }).click();
        check(!(await tab.locator('html').evaluate(el => el.scrollWidth > innerWidth)), 'No horizontal overflow');
        reports.push({ game, mobile, darkerDefault: true, reactiveImages: targets.length, hop: true, circularWaves: true, oneShot: true, reducedMotion: true, searchAndGamePicker: true });
      }
      check(errors.length === 0, errors.join('\n'));
    } finally { await context.close(); }
  }
  return { passed: true, reports };
}
