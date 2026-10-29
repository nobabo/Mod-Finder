// Playwright CLI: run-code --filename=tooling/scripts/verify-glass-rendering.js
async (page) => {
  const base = new URL(page.url()).origin;
  const check = (value, message) => { if (!value) throw Error(message); };
  const reports = [];
  for (const mobile of [false, true]) {
    const context = await page.context().browser().newContext({ viewport: { width: mobile ? 390 : 1024, height: mobile ? 844 : 960 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 3 : 1 });
    try {
      await context.addInitScript(() => { localStorage.setItem('modfinder-intro-seen', '1'); document.cookie = 'mf-language=ko; Path=/'; });
      const tab = await context.newPage();
      const errors = [];
      tab.on('pageerror', error => errors.push(error.message));
      await tab.route('**/v1/**', route => route.fulfill({ json: { source: 'modrinth', status: 'empty', items: [], nextCursor: null, total: 0, fetchedAt: new Date().toISOString(), cached: false, appliedFilters: {}, unsupportedFilters: [], externalUrl: null, queryForwarded: true } }));
      const button = name => tab.getByRole('button', { name, exact: true });
      const verifySurfaces = async (label, selector) => {
        // Allow entry/scroll/selection transitions to reach their final geometry.
        await tab.waitForTimeout(500);
        const result = await tab.evaluate(selector => {
          const visible = [...document.querySelectorAll(selector)].filter(element => {
            const r = element.getBoundingClientRect();
            return r.width && r.height && r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight && getComputedStyle(element).visibility !== 'hidden' && !element.closest('[inert], [aria-hidden="true"]');
          });
          const painted = visible.every(element => {
            const canvas = element.querySelector(':scope > .glass-control-surface');
            if (!canvas || !canvas.width || !canvas.height) return false;
            const color = canvas.getContext('2d').getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
            return color[3] === 255 && color[0] + color[1] + color[2] > 0;
          });
          const gl = document.querySelector('.atmosphere-canvas').getContext('webgl');
          return { count: visible.length, painted, glError: gl.getError(), ready: document.documentElement.dataset.glass };
        }, selector);
        check(result.count > 0 && result.painted && result.glError === 0 && result.ready === 'webgl', `${label}: ${JSON.stringify(result)}`);
        reports.push({ mobile, label, visible: result.count });
      };
      await tab.goto(`${base}/?game=minecraft-java`);
      await tab.locator('.atmosphere.is-ready').waitFor();
      await button('게임 바꾸기').click();
      await verifySurfaces('game cards', '.game-deck .deck-card');
      if (mobile) {
        await button('다음 페이지').click();
        await verifySurfaces('next card page', '.game-deck .deck-card');
        await button('이전 페이지').click();
      } else {
        await tab.locator('.deck-rail').evaluate(rail => { rail.scrollLeft = rail.scrollWidth; });
        await verifySurfaces('far edge cards', '.game-deck .deck-card');
        await tab.locator('.deck-rail').evaluate(rail => { rail.scrollLeft = 0; });
      }
      await verifySurfaces('returning cards', '.game-deck .deck-card');
      await tab.screenshot({ path: `output/playwright/glass-verified-games-${mobile ? 'mobile' : 'desktop'}.png` });
      await button('닫기').click();
      await button('검색 필터').click();
      await button('컨텐츠').click();
      const first = tab.locator('.deck-card[data-genre-id]').first();
      await first.dispatchEvent('click');
      check(await first.getAttribute('aria-pressed') === 'true', 'Category selection failed');
      await verifySurfaces('selected genre cards', '.game-deck .deck-card');
      await button('닫기').click();
      await button('설정 메뉴').click();
      await verifySurfaces('settings cards', '.settings-menu nav button');
      await tab.emulateMedia({ reducedMotion: 'reduce' });
      await button('테마').click();
      await verifySurfaces('reduced-motion theme options', '.preference-panel .theme-options button');
      await tab.screenshot({ path: `output/playwright/glass-verified-settings-${mobile ? 'mobile' : 'desktop'}.png` });
      await button('닫기').click();
      const canRestore = await tab.evaluate(() => {
        const gl = document.querySelector('.atmosphere-canvas').getContext('webgl');
        const extension = gl.getExtension('WEBGL_lose_context');
        if (!extension) return false;
        window.restoreGlassContext = () => extension.restoreContext();
        extension.loseContext();
        return true;
      });
      check(canRestore, 'Context loss test requires WEBGL_lose_context');
      await tab.waitForFunction(() => document.documentElement.dataset.glass === 'fallback');
      await tab.evaluate(() => window.restoreGlassContext());
      await tab.locator('.atmosphere.is-ready').waitFor();
      await verifySurfaces('context restoration', '.search-box');
      check(errors.length === 0, errors.join('\n'));
    } finally { await context.close(); }
  }
  return { passed: true, reports };
}
