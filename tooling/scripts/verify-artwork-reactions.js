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
      for (const [game, color] of [['minecraft-java', '#18645266'], ['stardew-valley', '#50351566']]) {
        await tab.goto(`${base}/?game=${game}`);
        await tab.locator('.atmosphere.is-ready').waitFor();
        await tab.locator('.game-character img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
        check(Math.abs(Number(await tab.locator('.atmosphere').getAttribute('data-photo-alpha')) - parseInt(color.slice(7,9),16) / 255) < .001, 'Game default preserves its photo transparency');
        const art = tab.locator('.game-character .artwork-reaction');
        check(await art.count() === 2, 'Both game elements have reactions');
        const brand = tab.locator('.app-brand-header .brand-logo');
        check(await brand.evaluate(el=>el.closest('.app-brand-header').getBoundingClientRect().top===56 && !el.closest('.artwork-reaction') && getComputedStyle(el).animationName==='none'),'MF stays static at its lower position');
        const targets = [tab.locator('.game-logo.artwork-reaction'), ...await art.all()];
        const react = async target => {
          const hit = await target.evaluate(el => {
            const box = el.getBoundingClientRect();
            for (const y of [.5, .25, .75, .1, .9]) for (const x of [.5, .25, .75, .1, .9]) {
              const point = { x: box.x + box.width * x, y: box.y + box.height * y };
              const top = document.elementFromPoint(point.x, point.y);
              if (top && (top === el || el.contains(top))) return point;
            }
            return null;
          });
          check(hit, 'Artwork has a reachable pointer position');
          if (mobile) await tab.touchscreen.tap(hit.x, hit.y); else await tab.mouse.move(hit.x, hit.y);
        };
        for (let index = 0; index < targets.length; index++) {
          const target = targets[index];
          await react(target);
          const handle = await target.elementHandle();
          await tab.waitForFunction(el => el.classList.contains('is-reacting'), handle);
          const reaction = await target.evaluate(el => {
            for (const animation of el.getAnimations({ subtree: true })) { animation.pause(); animation.currentTime = 240; }
            const motion = getComputedStyle(el.querySelector('.artwork-motion'));
            const ring = getComputedStyle(el.querySelector('.artwork-ripple'), '::before');
            return { name: motion.animationName, iterations: motion.animationIterationCount, y: new DOMMatrixReadOnly(motion.transform).m42, scaleY:new DOMMatrixReadOnly(motion.transform).m22, opacity: Number(ring.opacity), circle: ring.width === ring.height && ring.borderRadius === '50%', waves: el.getAnimations({ subtree: true }).filter(animation => animation.animationName === 'artwork-ripple').length };
          });
          check(reaction.name === 'artwork-pop' && reaction.iterations === '1' && reaction.y < -2.8 && reaction.y >= -7.1 && reaction.scaleY < 1.03, 'One short upward hop');
          check(reaction.opacity > .1 && reaction.circle && reaction.waves === 2, 'Two visible circular ripples');
          if (index === 1) await tab.screenshot({ path: `output/playwright/${game}-${mobile ? 'mobile' : 'desktop'}-artwork-pop.png` });
          await target.evaluate(el => { for (const animation of el.getAnimations({ subtree: true })) animation.play(); });
          await tab.waitForFunction(el => !el.classList.contains('is-reacting'), handle);
          check(await target.locator('.artwork-motion').evaluate(el => getComputedStyle(el).transform === 'none'), 'Returns to rest while pointer stays over the image');
          if (mobile && index === 0) {
            await tab.locator('.game-deck').waitFor({ state: 'visible' });
            await tab.getByRole('button', { name: '닫기', exact: true }).click();
          }
          if (index === 1 && !mobile) {
            await tab.mouse.move(15, 100);
            await react(target);
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
        await react(target);
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
