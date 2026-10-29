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
      const open = async () => { await button('검색 필터').click(); await button('장르').click(); };
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
        const group = tab.getByRole('group',{ name:item.label, exact:true });
        const option = name => group.getByRole('button',{ name, exact:true });
        await option(item.first).click();
        check(await group.isVisible(), `${item.key}: menu closed after first selection`);
        await option(item.second).click();
        check(await option(item.first).getAttribute('aria-pressed') === 'true', `${item.key}: first choice was lost`);
        check(await option(item.second).getAttribute('aria-pressed') === 'true', `${item.key}: second choice missing`);
        await active(item.key,true);
        await option(item.first).click();
        check(await option(item.first).getAttribute('aria-pressed') === 'false', `${item.key}: toggle did not deselect`);
        await active(item.key,true);
        await option(item.all).click();
        await active(item.key,false);
        await option(item.first).click();
        await option(item.second).click();
        await button(item.label).click();
      }
      // Wait for the bounded search queue to send every selected combination.
      await tab.waitForFunction(() => !document.querySelector('.results-loading'));
      await tab.screenshot({ path:`output/playwright/minecraft-multi-${mobile ? 'mobile' : 'desktop'}.png` });
      const saved = tab.url();
      for (const item of cases) check(new URL(saved).searchParams.getAll(item.key).length === 2, `${item.key}: URL lost selections`);
      await tab.reload();
      await open();
      for (const item of cases) await active(item.key,true);
      check(errors.length === 0, errors.join('\n'));
      const combinations = requests.filter(request => request.source === 'modrinth' && request.version && request.loader && request.kind);
      check(new Set(combinations.map(request => JSON.stringify([request.version,request.loader,request.kind]))).size === 8, 'API requests lost selected combinations');
      reports.push({ mobile, selectionsRestored:true, themedOnEffect:true, searchCombinations:8 });
    } finally { await context.close(); }
  }
  return reports;
}
