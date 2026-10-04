// Run in a disposable Playwright CLI browser with run-code --filename=... .
async (page) => {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const title = 'UI Ranking Test Pack';
  const requests = [];
  const pattern = '**/v1/search?**';
  const routeSearch = async route => {
    const params = new URL(route.request().url()).searchParams;
    requests.push(Object.fromEntries(params));
    const source = params.get('source');
    const items = source === 'modrinth' ? [{
      key:'modrinth:minecraft:ui-ranking-test', id:'ui-ranking-test', source, scope:'minecraft', gameId:'minecraft-java',
      title, author:'UI test', summary:'', url:'https://modrinth.com/modpack/ui-ranking-test', iconUrl:null,
      updatedAt:null, versions:null, loaders:null, kind:'modpack', tags:[], rank:0,
      metrics:[{label:'다운로드',value:100}], fetchedAt:new Date().toISOString(),
    }] : [];
    await route.fulfill({ json:{ source, status:items.length ? 'success' : 'empty', items,
      nextCursor:null, total:items.length, fetchedAt:new Date().toISOString(), cached:false,
      appliedFilters:{kind:params.get('kind')}, unsupportedFilters:[], externalUrl:null, queryForwarded:false, message:'',
    }});
  };
  const saved = await page.evaluate(() => localStorage.getItem('modfinder:local:v1'));
  await page.route(pattern, routeSearch);
  try {
    await page.emulateMedia({reducedMotion:'reduce'});
    for (const [width,height] of [[390,844], [1440,1000]]) {
      await page.setViewportSize({width,height});
      await page.reload();
      await page.getByRole('button',{name:'다운로드 순위',exact:true}).click();
      const ranked = page.locator('.ranking-panel .mod-card').first();
      await ranked.waitFor();
      // Saving a ranked entry must remain independent of its search action.
      await ranked.locator('.save-button').click();
      check(await page.locator('.has-results').count() === 0, 'Bookmark unexpectedly navigated');
      await ranked.locator('.title-button').click();
      await page.locator('.has-results').waitFor();
      check(await page.locator('.sheet-backdrop').count() === 0, 'Ranking opened the detail sheet');
      check(await page.getByRole('searchbox',{name:'모드 검색어'}).inputValue() === title, 'Ranking did not search the original mod title');
      check(await page.evaluate(() => scrollY === 0), 'Ranking search did not start at the top');
      const image = page.locator('.results-content .mod-logo-link').first();
      await image.waitFor();
      check(await image.evaluate(el => {
        const s=getComputedStyle(el);
        return s.backgroundImage === 'none' && s.backgroundColor === 'rgba(0, 0, 0, 0)'
          && ['borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth'].every(key => s[key] === '4px');
      }), 'Mod image frame is not transparent with a 4px border');
      // Detail sheets should still work from normal search-result titles.
      await page.locator('.results-content .title-button').first().click();
      await page.locator('.sheet-backdrop').waitFor();
      await page.getByRole('button',{name:'닫기',exact:true}).click();
    }
    check(requests.some(r => r.query === title && r.gameId === 'minecraft-java' && r.kind === 'modpack'), 'Modpack search lost its game/type');
    return 'PASS: mobile and desktop download rankings navigate to search; bookmarks and result details retained; game/modpack filters retained; transparent 4px image frames.';
  } finally {
    await page.unroute(pattern, routeSearch);
    await page.evaluate(value => { if (value === null) localStorage.removeItem('modfinder:local:v1'); else localStorage.setItem('modfinder:local:v1',value); }, saved);
    await page.reload();
  }
}
