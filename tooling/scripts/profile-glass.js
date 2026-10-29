// Playwright CLI: run-code --filename=tooling/scripts/profile-glass.js
async (page) => {
  const base = new URL(page.url()).origin;
  const label = base.includes('127.0.0.1') ? 'local' : 'production';
  const context = await page.context().browser().newContext({ viewport: { width: 1536, height: 960 }, reducedMotion: 'no-preference' });
  try {
    await context.addInitScript(() => {
      localStorage.setItem('modfinder-intro-seen', '1');
      document.cookie = 'mf-language=ko; Path=/';
      const sources = new WeakSet();
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        const result = getContext.call(this, type, ...args);
        if (type === 'webgl') sources.add(this);
        return result;
      };
      const drawImage = CanvasRenderingContext2D.prototype.drawImage;
      const drawArrays = WebGLRenderingContext.prototype.drawArrays;
      window.glassProfile = { copies: 0, draws: 0, copyMs: 0, copiedPixels: 0 };
      CanvasRenderingContext2D.prototype.drawImage = function (source, ...args) {
        const start = performance.now();
        const result = drawImage.call(this, source, ...args);
        if (sources.has(source)) {
          const stats = window.glassProfile;
          stats.copies++;
          stats.copyMs += performance.now() - start;
          stats.copiedPixels += args.length === 8 ? args[2] * args[3] : source.width * source.height;
        }
        return result;
      };
      WebGLRenderingContext.prototype.drawArrays = function (...args) {
        window.glassProfile.draws++;
        return drawArrays.apply(this, args);
      };
    });
    const tab = await context.newPage();
    const client = await context.newCDPSession(tab);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const errors = [];
    tab.on('pageerror', error => errors.push(error.message));
    await tab.route('**/v1/**', route => route.fulfill({ json: { source: 'modrinth', status: 'empty', items: [], nextCursor: null, total: 0, fetchedAt: new Date().toISOString(), cached: false, appliedFilters: {}, unsupportedFilters: [], externalUrl: null, queryForwarded: true } }));
    const button = name => tab.getByRole('button', { name, exact: true });
    const measure = async (name, railSelector) => {
      await tab.mouse.move(tab.viewportSize().width / 2, 10);
      await tab.waitForTimeout(600);
      const result = await tab.evaluate(async selector => {
        const rail = document.querySelector(selector);
        const max = Math.min(1800, rail.scrollWidth - rail.clientWidth);
        window.glassProfile = { copies: 0, draws: 0, copyMs: 0, copiedPixels: 0 };
        const intervals = [];
        let last = performance.now();
        const start = last;
        for (let frame = 0; frame < 60; frame++) {
          await new Promise(requestAnimationFrame);
          const now = performance.now(); intervals.push(now - last); last = now;
          rail.scrollLeft = max * (frame < 30 ? frame / 30 : (60 - frame) / 30);
        }
        await new Promise(requestAnimationFrame);
        const stats = { ...window.glassProfile };
        const surfaces = [...document.querySelectorAll('.glass-control-surface')];
        const inView = element => { const r = element.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight; };
        const visible = surfaces.filter(surface => inView(surface.parentElement));
        const offscreenPixels = surfaces.filter(surface => !inView(surface.parentElement)).reduce((sum, surface) => sum + surface.width * surface.height, 0);
        intervals.sort((a, b) => a - b);
        return { ...stats, elapsedMs: Math.round(performance.now() - start), frameP95Ms: Math.round(intervals[Math.floor(intervals.length * .95)]), surfaces: surfaces.length, visible: visible.length, offscreenPixels };
      }, railSelector);
      await tab.screenshot({ path: `output/playwright/glass-${label}-${tab.viewportSize().width}-${name}.png` });
      const idleCopies = await tab.evaluate(async () => { const before = window.glassProfile.copies; await new Promise(resolve => setTimeout(resolve, 250)); return window.glassProfile.copies - before; });
      return { name, width: tab.viewportSize().width, ...result, copyMs: Math.round(result.copyMs), idleCopies };
    };
    const reports = [];
    for (const width of [1536, 1024]) {
      await tab.setViewportSize({ width, height: 960 });
      await tab.goto(`${base}/?game=minecraft-java`);
      await tab.locator('.atmosphere.is-ready').waitFor();
      await button('게임 바꾸기').click();
      reports.push(await measure('games', '.deck-rail'));
      await button('닫기').click();
      await button('검색 필터').click();
      await button('컨텐츠').click();
      reports.push(await measure('genres', '.deck-rail'));
      await button('닫기').click();
      await button('설정 메뉴').click();
      reports.push(await measure('settings', '.settings-rail'));
    }
    if (errors.length) throw Error(errors.join('\n'));
    return { base, cpuThrottle: 4, reports, errors };
  } finally { await context.close(); }
}
