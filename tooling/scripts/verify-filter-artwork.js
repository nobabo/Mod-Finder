// Playwright CLI: run-code --filename=tooling/scripts/verify-filter-artwork.js
async (page) => {
  const check=(value,message) => { if (!value) throw Error(message); };
  const reports=[];
  for (const mobile of [false,true]) {
    const context=await page.context().browser().newContext({viewport:{width:mobile ? 390 : 1536,height:960},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
    try {
      await context.addInitScript(() => { document.cookie='mf-language=ko; Path=/';localStorage.setItem('modfinder-intro-seen','1'); });
      const tab=await context.newPage();
      const errors=[];tab.on('pageerror',error => errors.push(error.message));
      await tab.route('**/v1/**',route => route.fulfill({json:{source:'modrinth',status:'empty',items:[],nextCursor:null,total:0,fetchedAt:new Date().toISOString(),cached:false,appliedFilters:{},unsupportedFilters:[],externalUrl:null,queryForwarded:true}}));
      const button=name => tab.getByRole('button',{name,exact:true});
      const hidden=() => tab.locator('.game-artwork-layer').evaluateAll(layers => layers.every(layer => getComputedStyle(layer).visibility === 'hidden'));
      for (const [game,group,option] of [['minecraft-java','모드 로더','Fabric'],['stardew-valley','컨텐츠','작물']]) {
        await tab.goto(new URL(`/?game=${game}`,page.url()).href);
        const anchor=tab.locator('[data-artwork-id]').first();
        await anchor.locator('button').focus();await tab.keyboard.press('ArrowRight');
        await tab.locator('.game-artwork-layer').first().waitFor({state:'visible'});
        const saved=await tab.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(key => key.startsWith('modfinder-artwork:')).map(key => [key,localStorage.getItem(key)])));
        const brand=await tab.locator('.app-brand-header').boundingBox();
        await button('검색 필터').click();
        await tab.screenshot({path:`output/playwright/filter-artwork-${game}-${mobile ? 'mobile' : 'desktop'}-open.png`});
        check(await hidden(),'Moved game artwork is still visible behind the filter picker');
        await button(group).click();
        for (const selected of [true,false,true,false]) {
          await button(option).click();
          check(await button(option).getAttribute('aria-pressed') === String(selected),'Filter toggle failed');
          check(await hidden(),'Toggling a filter revealed game artwork behind the picker');
          check(await tab.locator('.main').evaluate(el => getComputedStyle(el).visibility) === 'hidden','Page content appeared behind the picker');
          const current=await tab.locator('.app-brand-header').boundingBox();
          check(current.x === brand.x && current.y === brand.y,'App logo moved while toggling filters');
        }
        await button('닫기').click();
        await tab.locator('.game-artwork-layer').first().waitFor({state:'visible'});
        check(JSON.stringify(await tab.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(key => key.startsWith('modfinder-artwork:')).map(key => [key,localStorage.getItem(key)])))) === JSON.stringify(saved),'Filtering changed the saved artwork position');
        await button('게임 바꾸기').click();check(await hidden(),'Moved artwork leaked into the game picker');
        await button('닫기').click();await tab.locator('.game-artwork-layer').first().waitFor({state:'visible'});
        reports.push({mobile,game,movedArtworkHidden:true,togglesStable:true,positionPreserved:true,gamePicker:true});
      }
      check(errors.length === 0,errors.join('\n'));
    } finally { await context.close(); }
  }
  return reports;
}
