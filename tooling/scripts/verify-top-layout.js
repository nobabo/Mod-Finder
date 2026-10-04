// Run with the Playwright CLI; start the pre-change desktop baseline on port 1432.
async (page) => {
  const check = (value, message) => { if (!value) throw Error(message); };
  const url = page.url();
  const browser = page.context().browser();
  const contexts = [];
  const create = async (mobile, target, viewport) => {
    const context = await browser.newContext({ viewport, isMobile:mobile, hasTouch:mobile, reducedMotion:'reduce' });
    contexts.push(context);
    await context.addInitScript(() => {
      document.cookie = 'mf-language=ko; Path=/';
      localStorage.setItem('modfinder-intro-seen', '1');
      if (!localStorage.getItem('modfinder:local:v1')) localStorage.setItem('modfinder:local:v1', JSON.stringify({ favorites:[], folders:[], compared:[], favoriteGames:['minecraft-java'], history:Array.from({length:20}, (_,i) => ({gameId:'minecraft-java', query:`Search ${i}`})) }));
    });
    const tab = await context.newPage();
    await tab.goto(target);
    await tab.evaluate(() => document.fonts.ready);
    return tab;
  };
  const openCollection = async (tab, name) => {
    if (await tab.locator('.settings-fab').isVisible()) await tab.locator('.settings-fab').click();
    else await tab.getByRole('navigation', {name:'모바일 메뉴'}).getByRole('button', {name:'설정',exact:true}).click();
    await tab.getByRole('dialog', {name:'설정 메뉴',exact:true}).getByRole('button', {name,exact:true}).click();
  };
  const measure = tab => tab.evaluate(() => {
    const selectors = ['.hero-brand','.collection-brand','.search-box','.ranking-panel','.collection-panel:not(.ranking-panel)','.page-heading h1','.history-list','.folder-toolbar','.collection-panel .empty-state','.settings-fab','.mobile-nav'];
    return Object.fromEntries(selectors.map(selector => {
      const el = document.querySelector(selector);
      if (!el || getComputedStyle(el).display === 'none') return [selector,null];
      const rect = el.getBoundingClientRect();
      return [selector,[rect.x,rect.y,rect.width,rect.height]];
    }));
  });
  const same = (actual, expected, label) => {
    for (const key of Object.keys(expected)) {
      const a = actual[key], b = expected[key];
      check(a === null && b === null || a && b && a.every((value,index) => Math.abs(value - b[index]) < 1), `${label}: ${key} changed from ${JSON.stringify(b)} to ${JSON.stringify(a)}`);
    }
  };
  const folderDeletion = async (tab, mobile) => {
    await tab.getByRole('button', {name:'새 폴더',exact:true}).click();
    await tab.locator('#folder-name').fill('Layout check');
    await tab.getByRole('button', {name:'저장',exact:true}).click();
    await tab.getByRole('button', {name:'폴더 삭제',exact:true}).click();
    check(await tab.locator('.folder-rail').getByRole('button', {name:mobile ? '전체' : '미분류',exact:true}).getAttribute('aria-pressed') === 'true', 'Folder deletion selected the wrong list');
  };
  try {
    for (const [width,height] of [[390,844],[768,1024],[1375,900],[1920,1080]]) {
      const current = await create(false,url,{width,height});
      const before = await create(false,'http://127.0.0.1:1432',{width,height});
      check(await current.locator('.mobile-header').count() === 0, 'Mobile header appeared on PC');
      check(await current.locator('.ranking-list li').count() === 10, 'PC ranking count changed');
      same(await measure(current),await measure(before),`PC home ${width}`);
      await current.screenshot({path:`output/playwright/desktop-restored-home-${width}.png`});
      for (const name of ['즐겨찾기','최근 기록']) {
        await openCollection(current,name); await openCollection(before,name);
        same(await measure(current),await measure(before),`PC ${name} ${width}`);
        if (name === '즐겨찾기') {
          check(await current.locator('.folder-rail').getByRole('button', {name:'미분류',exact:true}).count() === 1, 'PC unfiled button missing');
          if (width === 1920) await folderDeletion(current,false);
        }
        await current.screenshot({path:`output/playwright/desktop-restored-${name === '즐겨찾기' ? 'favorites' : 'history'}-${width}.png`});
        await current.getByRole('button',{name:'메인 화면으로 이동',exact:true}).click();
        await before.getByRole('button',{name:'메인 화면으로 이동',exact:true}).click();
      }
    }
    for (const [width,height] of [[320,568],[390,844],[768,1024],[844,390]]) {
      const mobile = await create(true,url,{width,height});
      check(await mobile.evaluate(() => matchMedia('(hover: none) and (pointer: coarse)').matches), 'Touch device was not emulated');
      check(await mobile.locator('.mobile-nav').count() === 0, 'Mobile bottom navigation remains');
      const header = await mobile.locator('.mobile-header').boundingBox();
      const settings = await mobile.locator('.settings-fab').boundingBox();
      const filter = await mobile.locator('.filter-orb').boundingBox();
      const search = await mobile.locator('.search-box').boundingBox();
      check(header.y === 0 && settings.x >= 0 && settings.x <= 20 && Math.abs(settings.y - filter.y) < 1, 'Mobile header alignment');
      check(search.y >= header.y + header.height + 40, 'Home search was not lowered below the header');
      check(await mobile.locator('.mobile-header').evaluate(el => getComputedStyle(el).backgroundColor === 'rgba(0, 0, 0, 0)' && getComputedStyle(el).backdropFilter === 'none'), 'Header hides the cover photograph');
      const backdrop = await mobile.locator('.atmosphere').boundingBox();
      check(backdrop.y === 0 && backdrop.width >= width && backdrop.height >= height, 'Photograph does not cover the mobile viewport');
      check(await mobile.locator('.atmosphere-fallback').last().evaluate(el => getComputedStyle(el).backgroundSize === 'cover' && el.style.backgroundImage.includes('url(')), 'Cover photograph missing');
      check(await mobile.locator('.ranking-list').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length) === 2, 'Mobile ranking is not two columns');
      const rows = await mobile.locator('.ranking-list li').evaluateAll(items => items.map(el => {const r=el.getBoundingClientRect();return {x:r.x,y:r.y};}));
      check(rows.length === 10 && Math.abs(rows[0].y-rows[1].y) < 1 && rows[0].x < rows[1].x, 'Ranking items do not occupy both columns');
      await mobile.screenshot({path:`output/playwright/mobile-header-home-${width}.png`});
      for (const name of ['즐겨찾기','최근 기록']) {
        await openCollection(mobile,name);
        const logo = await mobile.locator('.page-brand .brand-logo').boundingBox();
        check(logo.width === (width <= 650 ? 76 : 96), 'Collection logo size');
        if (name === '즐겨찾기') {
          check(await mobile.locator('.folder-rail').getByRole('button',{name:'미분류',exact:true}).count() === 0, 'Mobile unfiled button remains');
          check(await mobile.locator('.collection-panel .empty-state').count() === 0, 'Mobile empty icon panel remains');
          const title = await mobile.locator('.page-heading h1').boundingBox();
          check(Math.abs(title.x+title.width/2-width/2) < 1, 'Mobile favorite heading not centered');
          if (width === 390) await folderDeletion(mobile,true);
        } else {
          await mobile.evaluate(() => window.scrollTo(0,200));
          check(await mobile.evaluate(() => scrollY > 0), 'Scroll check did not scroll');
          const after = await mobile.locator('.settings-fab').boundingBox();
          const afterLogo = await mobile.locator('.page-brand .brand-logo').boundingBox();
          check(Math.abs(after.y-settings.y) < 1 && Math.abs(afterLogo.y-logo.y) < 1, 'Header controls drifted while scrolling');
          await mobile.locator('.settings-fab').click();
          await mobile.getByRole('dialog',{name:'설정 메뉴',exact:true}).getByRole('button',{name:'닫기',exact:true}).click();
        }
        check(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal overflow on mobile');
        await mobile.screenshot({path:`output/playwright/mobile-header-${name === '즐겨찾기' ? 'favorites' : 'history'}-${width}.png`});
        await mobile.getByRole('button',{name:'메인 화면으로 이동',exact:true}).click();
      }
      await mobile.locator('.filter-orb').click();
      await mobile.getByRole('button',{name:'닫기',exact:true}).click();
      await mobile.locator('#mod-query').fill('sodium');
      await mobile.locator('.search-submit').click();
      await mobile.locator('.has-results').waitFor();
      check(await mobile.locator('.mobile-header .home-logo').count() === 1 && await mobile.locator('.results-brand').count() === 0, 'Results logo duplicated');
      await mobile.getByRole('button',{name:'메인 화면으로 이동',exact:true}).click();
    }
    return { desktopMatchesBefore:true, desktopViewports:4, mobileViewports:4, mobileRankingColumns:2, mobileBottomNav:false, fixedHeaderAfterScroll:true };
  } finally { for (const context of contexts) await context.close(); }
}
