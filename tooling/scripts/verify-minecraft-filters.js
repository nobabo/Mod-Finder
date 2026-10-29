// Run through Playwright CLI with the development app open.
async (page) => {
  const check = (value, message) => { if (!value) throw Error(message); };
  const cases = [
    { key:'version', label:'게임 버전', first:'1.21.1', second:'1.20.1', all:'전체 버전' },
    { key:'loader', label:'모드 로더', first:'Fabric', second:'Forge', all:'전체 로더' },
    { key:'kind', label:'프로젝트 종류', first:'모드', second:'모드팩', all:'전체 종류' },
  ];
  const reports = [];
  for (const mobile of [false, true]) {
    const context = await page.context().browser().newContext({ viewport:{ width:mobile ? 390 : 1600, height:1000 }, isMobile:mobile, hasTouch:mobile, reducedMotion:'reduce' });
    try {
      await context.addInitScript(() => {
        document.cookie = 'mf-language=ko; Path=/';
        localStorage.setItem('modfinder-intro-seen','1');
        localStorage.setItem('modfinder-background-color','#8254ca80');
      });
      const tab = await context.newPage();
      const errors = [];
      tab.on('pageerror', error => errors.push(error.message));
      const requests = [];
      await tab.route('**/v1/**', async route => {
        const url = new URL(route.request().url());
        if (url.pathname.endsWith('/minecraft/versions')) return route.fulfill({ json:{ versions:['1.21.1','1.20.1'] } });
        if (url.pathname.endsWith('/search')) requests.push(Object.fromEntries(url.searchParams));
        return route.fulfill({ json:{ source:url.searchParams.get('source') ?? 'modrinth', status:'empty', items:[], nextCursor:null, total:0, fetchedAt:new Date().toISOString(), cached:false, appliedFilters:{}, unsupportedFilters:[], externalUrl:null, queryForwarded:true } });
      });
      await tab.goto(new URL('/',page.url()).href);
      const button = name => tab.getByRole('button',{ name, exact:true });
      const reveal = async name => {
        for (let i = 0; i < 6 && !await button(name).isVisible(); i++) await button('다음 페이지').click();
      };
      const open = async () => {
        await button('검색 필터').click();
        check(await tab.getByRole('dialog', {name:'장르',exact:true}).count() === 1, 'Filters did not open directly to genres');
        check(await tab.getByRole('textbox', {name:'장르',exact:true}).count() === 0, 'Genre search is still visible');
      };
      const active = async (key, expected) => {
        const card = tab.locator(`[data-filter-id="${key}"]`);
        check(await card.getAttribute('aria-pressed') === String(expected), `${key}: incorrect selection state`);
        const themed = await card.evaluate(el => {
          const probe = document.createElement('span');
          probe.style.color = 'var(--accent)'; el.append(probe);
          const accent = getComputedStyle(probe).color; probe.remove();
          return getComputedStyle(el).borderTopColor === accent && getComputedStyle(el.querySelector('svg')).stroke.includes('theme-icon-gradient');
        });
        check(themed === expected, `${key}: incorrect theme ON effect`);
      };
      await open();
      for (const item of cases) {
        await active(item.key,false);
        await button(item.label).click();
        const group = tab.getByRole('dialog',{ name:item.label, exact:true });
        check(await group.locator('.filter-dropdown').count() === 0, 'Filter still uses a dropdown');
        const option = name => group.getByRole('button',{ name, exact:true });
        const pick = async name => { await reveal(name); await option(name).click(); };
        await pick(item.first);
        check(await group.isVisible(), `${item.key}: menu closed after first selection`);
        await pick(item.second);
        check(await option(item.first).getAttribute('aria-pressed') === 'true', `${item.key}: first choice was lost`);
        check(await option(item.second).getAttribute('aria-pressed') === 'true', `${item.key}: second choice missing`);
        await pick(item.first);
        check(await option(item.first).getAttribute('aria-pressed') === 'false', `${item.key}: toggle did not deselect`);
        await pick(item.all);
        await button('뒤로').click();
        await active(item.key,false);
        await button(item.label).click();
        await pick(item.first);
        await pick(item.second);
        await button('뒤로').click();
        await active(item.key,true);
      }
      // Wait for the bounded search queue to send every selected combination.
      await tab.waitForFunction(() => !document.querySelector('.results-loading'));
      await tab.screenshot({ path:`output/playwright/minecraft-multi-${mobile ? 'mobile' : 'desktop'}.png` });
      await button('내림차순').click();
      check(new URL(tab.url()).searchParams.get('direction') === 'asc', 'Direction did not update the URL');
      check(await button('오름차순').isVisible(), 'Ascending state missing');
      await button('정렬 방법').click();
      await button('최근 업데이트순').click();
      check(new URL(tab.url()).searchParams.get('sort') === 'updated', 'Sort criterion lost');
      await button('뒤로').click();
      const saved = tab.url();
      for (const item of cases) check(new URL(saved).searchParams.getAll(item.key).length === 2, `${item.key}: URL lost selections`);
      await tab.reload();
      await open();
      for (const item of cases) await active(item.key,true);
      check(await button('오름차순').isVisible(), 'Direction was not restored');
      await button('정렬 방법').click();
      check(await button('최근 업데이트순').getAttribute('aria-pressed') === 'true', 'Sort was not restored');
      check(errors.length === 0, errors.join('\n'));
      const combinations = requests.filter(request => request.source === 'modrinth' && request.version && request.loader && request.kind);
      check(new Set(combinations.map(request => JSON.stringify([request.version,request.loader,request.kind]))).size === 8, 'API requests lost selected combinations');
      reports.push({ mobile, selectionsRestored:true, themedOnEffect:true, searchCombinations:8 });
    } finally { await context.close(); }
  }
  return reports;
}
