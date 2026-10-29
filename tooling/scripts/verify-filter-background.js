// Run through Playwright CLI; captures stay in output/playwright.
async (page) => {
  const check = (value, message) => { if (!value) throw Error(message); };
  const reports = [];
  for (const mobile of [false,true]) {
    const label = mobile ? 'mobile' : 'desktop';
    const context = await page.context().browser().newContext({viewport:{width:mobile ? 390 : 1600,height:1000},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
    try {
      await context.addInitScript(() => {
        document.cookie = 'mf-language=ko; Path=/';
        localStorage.setItem('modfinder-intro-seen','1');
      });
      const tab = await context.newPage();
      const errors = [];
      tab.on('pageerror', error => errors.push(error.message));
      await tab.route('**/v1/**', route => route.fulfill({json:new URL(route.request().url()).pathname.endsWith('/minecraft/versions')
        ? {versions:['1.21.1','1.20.1']}
        : {source:'modrinth',status:'empty',items:[],nextCursor:null,total:0,fetchedAt:new Date().toISOString(),cached:false,appliedFilters:{},unsupportedFilters:[],externalUrl:null,queryForwarded:true}}));
      await tab.goto(new URL('/',page.url()).href);
      const button = name => tab.getByRole('button',{name,exact:true});
      const open = async name => {
        for (let i=0;i<5 && !await button(name).isVisible();i++) await button('다음 페이지').click();
        await button(name).click();
      };
      const background = async (selector,selected) => {
        await tab.waitForFunction(({selector,filter}) => {
          const surface = document.querySelector(selector)?.querySelector(':scope > .glass-control-surface');
          return surface?.width > 0 && surface.height > 0 && getComputedStyle(surface).visibility === 'visible' && getComputedStyle(surface).filter === filter;
        },{selector,filter:selected ? 'none' : 'grayscale(1)'});
        check(await tab.locator(selector).getAttribute('aria-pressed') === String(selected),'Background is out of sync with selection');
        check(await tab.locator('.atmosphere-canvas').evaluate(el => getComputedStyle(el).filter) === 'none','Whole scene was desaturated');
      };
      await button('검색 필터').click();
      for (const [name,selector] of [
        ['게임 버전','[data-filter-id="version:1.21.1"]'],
        ['모드 로더','[data-filter-id="loader:fabric"]'],
        ['프로젝트 종류','[data-filter-id="kind:mod"]'],
        ['컨텐츠','[data-genre-id="modrinth:adventure"]'],
        ['정렬 방법','[data-filter-id="sort:updated"]'],
      ]) {
        await open(name);
        await background(selector,false);
        const card = tab.locator(selector);
        if (name === '모드 로더') await card.screenshot({path:`output/playwright/filter-background-${label}-off-card.png`});
        await card.click(); await background(selector,true);
        if (name === '모드 로더') {
          check(await card.evaluate(el => {
            const probe=document.createElement('span');probe.style.color='var(--accent)';el.append(probe);
            const accent=getComputedStyle(probe).color;probe.remove();return getComputedStyle(el).borderTopColor === accent;
          }),'Selected outline lost its theme color');
          await card.screenshot({path:`output/playwright/filter-background-${label}-on-card.png`});
          await tab.screenshot({path:`output/playwright/filter-background-${label}-mixed.png`});
        }
        if (name === '정렬 방법') await button('다운로드순').click(); else await card.click();
        await background(selector,false);
        if (name === '모드 로더') await card.screenshot({path:`output/playwright/filter-background-${label}-off-again-card.png`});
        await button('뒤로').click();
      }
      await open('모드 로더');
      const fabric=tab.locator('[data-filter-id="loader:fabric"]');
      await tab.evaluate(() => { document.documentElement.dataset.glass='fallback'; });
      check(await fabric.evaluate(el => getComputedStyle(el).backdropFilter.includes('grayscale(1)')),'Fallback background is not grayscale');
      await fabric.click();
      await tab.waitForFunction(() => document.querySelector('[data-filter-id="loader:fabric"]').getAttribute('aria-pressed') === 'true');
      check(await fabric.evaluate(el => !getComputedStyle(el).backdropFilter.includes('grayscale')), 'Fallback selected background stayed grayscale');
      await tab.screenshot({path:`output/playwright/filter-background-${label}-fallback.png`});
      await fabric.screenshot({path:`output/playwright/filter-background-${label}-fallback-on-card.png`});
      await tab.locator('[data-filter-id="loader:forge"]').screenshot({path:`output/playwright/filter-background-${label}-fallback-off-card.png`});
      await tab.evaluate(() => { document.documentElement.dataset.glass='webgl'; });
      await button('닫기').click();
      await button('게임 바꾸기').click();
      const game=tab.getByRole('button',{name:'스타듀 밸리',exact:true});
      if (mobile) await tab.getByRole('textbox',{name:'게임 찾기',exact:true}).fill('스타듀 밸리');
      await game.locator(':scope > .glass-control-surface').waitFor({state:'attached'});
      check(await game.locator(':scope > .glass-control-surface').evaluate(el => getComputedStyle(el).filter) === 'none','Game picker background was changed');
      check(errors.length === 0,errors.join('\n'));
      reports.push({mobile,grayscaleOff:true,colorOn:true,colorOutline:true,fallback:true,gamePickerPreserved:true,errors});
    } finally { await context.close(); }
  }
  return reports;
}
