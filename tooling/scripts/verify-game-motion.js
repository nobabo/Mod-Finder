// Playwright CLI: --filename tooling/scripts/verify-game-motion.js
async (page) => {
  const base = new URL(page.url()).origin;
  const check = (condition, message) => { if (!condition) throw Error(message); };
  const reports = [];
  for (const [name, game, preference] of [
    ['minecraft', 'minecraft-java', 'game'], ['stardew', 'stardew-valley', 'game'],
    ['crimson', 'minecraft-java', 'crimson'],
  ]) {
    const context = await page.context().browser().newContext({ viewport: { width: 1536, height: 960 }, reducedMotion: 'no-preference' });
    try {
      await context.addInitScript(value => {
        localStorage.setItem('modfinder-theme', value);
        localStorage.setItem('modfinder-intro-seen', '1');
        document.cookie = 'mf-language=ko; Path=/';
      }, preference);
      const tab = await context.newPage();
      const errors = [];
      tab.on('pageerror', error => errors.push(error.message));
      await tab.goto(`${base}/?game=${game}`);
      await tab.locator('.atmosphere.is-ready').waitFor();
      await tab.locator('.search-box>.glass-control-surface').waitFor({ state: 'visible' });
      const inspect = () => tab.evaluate(() => {
        const scene = document.querySelector('.atmosphere');
        const surface = document.querySelector('.search-box>.glass-control-surface');
        const pixels = surface.getContext('2d').getImageData(0, 0, surface.width, surface.height).data;
        let hash = 1;
        for (let index = 0; index < pixels.length; index += 97) hash = Math.imul(hash, 31) + pixels[index] | 0;
        return {
          offset: parseFloat(scene.style.getPropertyValue('--background-x')),
          logo: getComputedStyle(document.querySelector('.brand-logo')).transform,
          character: document.querySelector('.character-art') ? getComputedStyle(document.querySelector('.character-art')).transform : null,
          glass: document.documentElement.dataset.glass,
          lensHash: hash,
          source: scene.dataset.background,
          order: scene.dataset.backgroundOrder,
        };
      });
      await tab.mouse.move(100, 160);
      await tab.waitForFunction(() => parseFloat(document.querySelector('.atmosphere').style.getPropertyValue('--background-x')) < -5.25);
      const left = await inspect();
      await tab.mouse.move(1430, 790);
      await tab.waitForFunction(() => parseFloat(document.querySelector('.atmosphere').style.getPropertyValue('--background-x')) > 5.25);
      const right = await inspect();
      check(left.glass === 'webgl' && right.glass === 'webgl', `${name}: shared WebGL renderer`);
      check(right.offset - left.offset > 9 && Math.abs(right.offset) <= 7, `${name}: bounded, real background parallax`);
      check(left.lensHash !== right.lensHash, `${name}: refracted pixels respond`);
      check(left.logo === right.logo, `${name}: logo stays still until hovered`);
      if (preference === 'game') check(left.character === right.character, `${name}: characters stay still until hovered`);
      await tab.screenshot({ path: `output/playwright/${name}-interactive-glass.png` });
      await tab.getByRole('button', { name: '설정 메뉴', exact: true }).click();
      const card = tab.getByRole('button', { name: '즐겨찾기', exact: true });
      await card.locator('.glass-control-surface').waitFor({ state: 'visible' });
      check(await card.locator('.glass-control-surface').evaluate(canvas => canvas.width > 0 && canvas.getContext('2d').getImageData(10, 10, 1, 1).data[3] > 0), `${name}: option card has actual refracted pixels`);
      const recommendation = tab.getByRole('switch', { name: '맞춤 추천', exact: true });
      if (await recommendation.getAttribute('aria-checked') === 'false') check(await recommendation.evaluate(el => getComputedStyle(el).filter) === 'none', `${name}: inactive card does not turn its glass photograph gray`);
      await tab.screenshot({ path: `output/playwright/${name}-interactive-settings.png` });
      await tab.getByRole('button', { name: '닫기', exact: true }).click();
      const starts = [right.source];
      const orders = new Set([right.order]);
      for (let attempt = 0; attempt < 3; attempt++) {
        await tab.reload();
        await tab.locator('.atmosphere.is-ready').waitFor();
        const next = await tab.locator('.atmosphere').evaluate(el => ({ source: el.dataset.background, order: el.dataset.backgroundOrder }));
        check(next.source !== starts.at(-1), `${name}: reload never repeats its last photograph`);
        starts.push(next.source); orders.add(next.order);
      }
      check(orders.size > 1, `${name}: photograph order is shuffled, not a fixed sequence`);
      check(errors.length === 0, `${name}: ${errors.join(', ')}`);
      reports.push({ theme: name, webgl: true, parallax: true, refractionPixels: true, pointerFollowingArtwork: false, distinctOrders: orders.size, starts });
    } finally {
      await context.close();
    }
  }
  return { passed: true, reports };
}
