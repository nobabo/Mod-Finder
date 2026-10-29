// Run through Playwright CLI; captures stay in output/playwright.
async (page) => {
  const check = (value, message) => { if (!value) throw Error(message); };
  const reports = [];
  for (const [mobile, width, accent] of [[true,390,'crimson'],[true,320,'cyan'],[false,1920,'cyan']]) {
    const context = await page.context().browser().newContext({ viewport:{width,height:844}, isMobile:mobile, hasTouch:mobile, reducedMotion:'reduce' });
    try {
      await context.addInitScript(theme => {
        document.cookie = 'mf-language=ko; Path=/';
        localStorage.setItem('modfinder-intro-seen','1');
        localStorage.setItem('modfinder-accent',theme);
      }, accent);
      const tab = await context.newPage();
      const errors = [];
      tab.on('pageerror', error => errors.push(error.message));
      await tab.route('**/v1/**', route => route.fulfill({json:{source:'modrinth',status:'empty',items:[],nextCursor:null,total:0,fetchedAt:new Date().toISOString(),cached:false,appliedFilters:{},unsupportedFilters:[],externalUrl:null,queryForwarded:true}}));
      await tab.goto(new URL('/',page.url()).href);
      const button = name => tab.getByRole('button',{name,exact:true});
      const reveal = async name => {
        for (let i=0; i<6 && !await button(name).isVisible(); i++) await button('다음 페이지').click();
      };
      const open = async name => { await reveal(name); await button(name).click(); };
      const selectedColor = card => card.evaluate(el => {
        const probe = document.createElement('span'); probe.style.color='var(--accent)'; el.append(probe);
        const accent = getComputedStyle(probe).color; probe.remove();
        return getComputedStyle(el).color === accent && getComputedStyle(el).borderTopColor === accent;
      });
      await button('검색 필터').click();
      check(await tab.getByRole('dialog',{name:'장르',exact:true}).count() === 1, 'Extra filter menu remains');
      check(await tab.getByRole('textbox').count() === 0, 'Genre search remains');
      check(await button('뒤로').count() === 0, 'Root has a redundant back button');
      for (const orb of ['정렬 방법','내림차순']) check(await button(orb).evaluate(el => { const r=el.getBoundingClientRect(); return r.width === r.height && getComputedStyle(el).borderRadius === '50%'; }), 'Sort control is not circular');
      await open('컨텐츠');
      const first = tab.locator('[data-genre-id="modrinth:adventure"]');
      const second = tab.locator('[data-genre-id="modrinth:technology"]');
      check(await first.getAttribute('aria-pressed') === 'false', 'Unexpected initial selection');
      await first.click(); await second.click();
      check(await selectedColor(first) && await selectedColor(second), 'Theme colors missing from selected cards');
      check(await first.locator('.sort-selection').count() === 0, 'Genre check mark returned');
      await tab.screenshot({path:`output/playwright/grouped-content-${width}.png`});
      await button('뒤로').click();
      check(await tab.locator('[data-filter-id="group:content"]').getAttribute('aria-pressed') === 'true', 'Content group does not reflect child selections');
      await open('시스템·최적화');
      for (const id of ['optimization','library','game-mechanics']) check(await tab.locator(`[data-genre-id="modrinth:${id}"]`).count() === 1, 'System category misplaced');
      await button('라이브러리').click();
      await tab.screenshot({path:`output/playwright/grouped-system-${width}.png`});
      await tab.keyboard.press('Escape');
      await open('컨텐츠');
      check(await first.getAttribute('aria-pressed') === 'true' && await second.getAttribute('aria-pressed') === 'true', 'Cross-group selection was lost');
      await first.click();
      check(await first.getAttribute('aria-pressed') === 'false' && await second.getAttribute('aria-pressed') === 'true', 'Independent deselection failed');
      await tab.keyboard.press('Escape');
      await button('전체 장르').click();
      check(new URL(tab.url()).searchParams.getAll('category').length === 0, 'All genres did not clear every group');
      await tab.keyboard.press('Escape');
      check(await tab.getByRole('dialog').count() === 0, 'Escape did not close root');
      check(await tab.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal overflow');
      await tab.goto(new URL('/?game=skyrim-se',page.url()).href);
      await button('검색 필터').click(); await open('시스템·최적화');
      await button('버그 수정').click();
      check(new URL(tab.url()).searchParams.get('category') === 'nexus:Bug Fixes', 'Source category ID changed');
      check(errors.length === 0,errors.join('\n'));
      reports.push({mobile,width,grouping:true,multiSelect:true,theme:true,keyboard:true,sourceIds:true,errors});
    } finally { await context.close(); }
  }
  return reports;
}
