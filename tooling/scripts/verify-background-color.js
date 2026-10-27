// Playwright CLI: --filename tooling/scripts/verify-background-color.js
async (page) => {
  const base = new URL(page.url()).origin;
  const check = (condition, message) => { if (!condition) throw Error(message); };
  const reports = [];
  for (const mobile of [false, true]) {
    const context = await page.context().browser().newContext({ viewport: { width: mobile ? 390 : 1536, height: mobile ? 844 : 960 }, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
    try {
      await context.addInitScript(() => {
        document.cookie = 'mf-language=ko; Path=/';
        localStorage.setItem('modfinder-intro-seen', '1');
      });
      const tab = await context.newPage();
      const errors = [];
      tab.on('pageerror', error => errors.push(error.message));
      const button = name => tab.getByRole('button', { name, exact: true });
      const openTheme = async () => { await button('설정 메뉴').click(); await button('테마').click(); await tab.locator('#background-color').waitFor(); };
      const color = () => tab.locator('#background-color').inputValue();
      const inspect = () => tab.evaluate(() => {
        const root = document.documentElement;
        const lens = document.querySelector('.theme-options button>.glass-control-surface');
        const data = lens?.getContext('2d').getImageData(0, 0, lens.width, lens.height).data;
        let hash = 1;
        if (data) for (let index = 0; index < data.length; index += 97) hash = Math.imul(hash, 31) + data[index] | 0;
        return { canvas: root.style.getPropertyValue('--canvas'), scheme: root.style.colorScheme, light: root.hasAttribute('data-light-theme'), stored: localStorage.getItem('modfinder-background-color'), glass: root.dataset.glass, lensHash: hash, overflow: root.scrollWidth > innerWidth };
      });
      const choose = async hex => {
        await tab.locator('#background-color').evaluate((input, value) => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }, hex);
        await tab.waitForFunction(value => document.documentElement.style.getPropertyValue('--canvas') === value && localStorage.getItem('modfinder-background-color') === value, hex);
        await tab.locator('.theme-options button>.glass-control-surface').first().waitFor({ state: 'visible' });
      };
      for (const [game, defaultColor] of [['minecraft-java', '#afc9ba'], ['stardew-valley', '#d0bf98']]) {
        await tab.goto(`${base}/?game=${game}`);
        await tab.locator('.atmosphere.is-ready').waitFor();
        await openTheme();
        check(await tab.locator('.theme-options button').count() === 2, 'Only Game default and Crimson remain');
        check(await button('게임 기본').count() === 1 && await button('크림슨').count() === 1, 'Expected two theme choices');
        check(await color() === defaultColor && await button('기본 색상으로').isDisabled(), 'Picker starts at game default');
        await tab.locator('#background-color').focus();
        await tab.keyboard.press('Tab');
        check(await tab.locator('.settings-back').evaluate(el => document.activeElement === el), 'Color picker participates in dialog focus trap');
        await choose('#e5d0b0');
        const light = await inspect();
        check(light.light && light.scheme === 'light' && light.glass === 'webgl', 'Light selection updates canvas and text while retaining refraction');
        await choose('#17252f');
        await tab.waitForFunction(hash => {
          const lens = document.querySelector('.theme-options button>.glass-control-surface');
          const pixels = lens.getContext('2d').getImageData(0, 0, lens.width, lens.height).data;
          let next = 1;
          for (let index = 0; index < pixels.length; index += 97) next = Math.imul(next, 31) + pixels[index] | 0;
          return next !== hash;
        }, light.lensHash);
        const dark = await inspect();
        check(!dark.light && dark.scheme === 'dark' && !dark.overflow, 'Dark selection changes readable text without overflow');
        await tab.screenshot({ path: `output/playwright/${game}-${mobile ? 'mobile' : 'desktop'}-color-picker.png` });
        await button('닫기').click();
        await tab.reload();
        await tab.locator('.atmosphere.is-ready').waitFor();
        await openTheme();
        check(await color() === '#17252f' && (await inspect()).stored === '#17252f', 'Chosen background survives reload');
        await button('크림슨').click();
        check(await color() === '#17252f', 'Chosen background also applies to Crimson');
        check(await tab.locator('.game-characters').count() === 0, 'Crimson keeps its own layout');
        await choose('#e5d0b0');
        check((await inspect()).light, 'Crimson supports light backgrounds');
        await button('기본 색상으로').click();
        await tab.waitForFunction(() => localStorage.getItem('modfinder-background-color') === null);
        check(await color() === '#130507' && !(await inspect()).light, 'Reset restores original Crimson');
        check(!await tab.locator('.atmosphere').evaluate(el => el.classList.contains('game-atmosphere')), 'Reset restores original photograph treatment');
        await button('게임 기본').click();
        check(await color() === defaultColor && (await inspect()).light, 'Reset restores game palette when switching back');
        await button('닫기').click();
        await tab.reload();
        await openTheme();
        check(await color() === defaultColor && await button('기본 색상으로').isDisabled(), 'Reset survives reload');
        if (mobile) {
          await tab.setViewportSize({ width: 320, height: 740 });
          check(!(await inspect()).overflow, 'Picker fits narrow mobile');
          await tab.screenshot({ path: `output/playwright/${game}-narrow-color-picker.png` });
          await tab.setViewportSize({ width: 390, height: 844 });
        }
        await button('닫기').click();
        reports.push({ game, mobile, themeChoices: 2, immediateCanvas: true, liveRefraction: true, adaptiveText: true, persistent: true, reset: true, keyboard: true });
      }
      check(errors.length === 0, errors.join('\n'));
    } finally { await context.close(); }
  }
  return { passed: true, reports };
}
