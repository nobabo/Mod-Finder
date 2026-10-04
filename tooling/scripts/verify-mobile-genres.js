// Run through Playwright CLI with the app open; captures stay in output/playwright.
async (page) => {
  const check = (value, message) => { if (!value) throw Error(message); };
  const contexts = [];
  const errors = [];
  const create = async (mobile, width, accent = 'crimson') => {
    const context = await page.context().browser().newContext({ viewport:{width,height:844}, isMobile:mobile, hasTouch:mobile, reducedMotion:'no-preference' });
    contexts.push(context);
    await context.addInitScript(theme => {
      document.cookie = 'mf-language=ko; Path=/';
      localStorage.setItem('modfinder-intro-seen', '1');
      localStorage.setItem('modfinder-accent', theme);
    }, accent);
    const tab = await context.newPage();
    tab.on('pageerror', error => errors.push(error.message));
    await tab.route('**/v1/**', route => route.fulfill({json:{source:'modrinth',status:'empty',items:[],nextCursor:null,total:0,fetchedAt:new Date().toISOString(),cached:false,appliedFilters:{},unsupportedFilters:[],externalUrl:null,queryForwarded:true}}));
    await tab.goto(page.url());
    await tab.evaluate(() => document.fonts.ready);
    return tab;
  };
  const button = (tab,name) => tab.getByRole('button',{name,exact:true});
  const openGenres = async tab => {
    await button(tab,'검색 필터').click();
    await button(tab,'장르').click();
  };
  const cards = tab => tab.locator('.picker-grid:not([inert]) [data-genre-id]');
  const finish = async tab => tab.locator('.game-deck').evaluate(el => {
    for (const animation of el.getAnimations({subtree:true})) if (animation.animationName === 'genre-card-pick' || animation.constructor.name === 'CSSTransition') animation.finish();
  });
  const gray = card => card.evaluate(el => getComputedStyle(el).filter === 'grayscale(1)');
  const selectedColor = card => card.evaluate(el => {
    const style = getComputedStyle(el);
    const probe = document.createElement('span');
    probe.style.color = 'var(--accent)'; el.append(probe);
    const accent = getComputedStyle(probe).color; probe.remove();
    return style.filter === 'none' && style.color === accent && style.borderTopColor === accent;
  });
  try {
    const mobile = await create(true,390);
    await openGenres(mobile);
    check(await mobile.locator('.mobile-genre-deck').count() === 1, 'Mobile genre styling absent');
    check(await mobile.locator('.picker-grid:not([inert]) .deck-card').evaluateAll(items => items.every(el => getComputedStyle(el).filter === 'grayscale(1)')), 'Initial utility cards are not monochrome');
    await button(mobile,'다음 페이지').click();
    const first = cards(mobile).nth(0), second = cards(mobile).nth(1);
    check(await gray(first) && await gray(second), 'Unselected genres are not monochrome');
    await mobile.screenshot({path:'output/playwright/mobile-genres-monochrome.png'});
    await first.dispatchEvent('click');
    check(await first.getAttribute('aria-pressed') === 'true', 'Genre selection delayed');
    check(await first.evaluate(el => el.getAnimations().some(animation => animation.animationName === 'genre-card-pick')), 'Mobile draw animation absent');
    await first.evaluate(el => {
      const animation = el.getAnimations().find(animation => animation.animationName === 'genre-card-pick');
      animation.pause(); animation.currentTime = 190;
    });
    check(await first.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m42 < -10), 'Selected genre did not lift');
    await mobile.screenshot({path:'output/playwright/mobile-genre-draw.png'});
    await finish(mobile);
    check(await selectedColor(first) && await gray(second), 'Only the selected genre should use the theme');
    check(await first.locator('.sort-selection').count() === 0, 'Mobile selection still has a check mark');
    await second.dispatchEvent('click');
    await first.dispatchEvent('click');
    await first.dispatchEvent('click');
    check(await first.getAttribute('aria-pressed') === 'true' && await second.getAttribute('aria-pressed') === 'true', 'Rapid multi-select lost selection');
    check(await first.evaluate(el => el.getAnimations().filter(animation => animation.animationName === 'genre-card-pick').length) === 1, 'Repeated selection stacked draw animations');
    await finish(mobile);
    await mobile.screenshot({path:'output/playwright/mobile-genres-selected.png'});
    await first.dispatchEvent('click'); await finish(mobile);
    check(await gray(first) && await selectedColor(second), 'Deselection did not restore monochrome');
    await button(mobile,'이전 페이지').click();
    await button(mobile,'전체 장르').click();
    await button(mobile,'다음 페이지').click(); await finish(mobile);
    check(await gray(cards(mobile).nth(0)) && await gray(cards(mobile).nth(1)), 'All genres did not reset');
    await mobile.emulateMedia({reducedMotion:'reduce'});
    await cards(mobile).nth(0).dispatchEvent('click');
    check(await selectedColor(cards(mobile).nth(0)), 'Reduced motion lost selection color');
    check(await cards(mobile).nth(0).evaluate(el => getComputedStyle(el).animationName === 'none'), 'Reduced motion still animates');
    await button(mobile,'이전 페이지').click();
    for (const name of ['게임 버전','모드 로더','프로젝트 종류']) {
      await button(mobile,name).click();
      const dropdown = mobile.getByRole('group',{name,exact:true});
      await dropdown.locator(':scope > .glass-control-surface').waitFor({state:'attached'});
      await mobile.waitForFunction(() => document.documentElement.dataset.glass === 'webgl');
      const lens = await dropdown.locator(':scope > .glass-control-surface').evaluate(el => {
        const rect = el.getBoundingClientRect(); const parent = el.parentElement.getBoundingClientRect();
        return {width:el.width,height:el.height,visible:getComputedStyle(el).visibility,aligned:Math.abs(rect.width-parent.width)<3 && Math.abs(rect.height-parent.height)<3};
      });
      check(lens.width > 1 && lens.height > 1 && lens.visible === 'visible' && lens.aligned, `${name}: liquid glass lens missing or misaligned`);
      check(await dropdown.evaluate(el => getComputedStyle(el).backdropFilter === 'none'), 'WebGL dropdown still blurs the lens');
      if (name === '프로젝트 종류') {
        await mobile.screenshot({path:'output/playwright/mobile-liquid-glass-dropdown.png'});
        await dropdown.getByRole('button',{name:'모드팩',exact:true}).click();
        await button(mobile,name).click();
        check(await dropdown.getByRole('button',{name:'모드팩',exact:true}).getAttribute('aria-pressed') === 'true', 'Dropdown selection did not persist');
      }
      await dropdown.getByRole('button').first().click();
      check(await dropdown.count() === 0, 'Dropdown did not close after selection');
    }
    await button(mobile,'프로젝트 종류').click();
    await mobile.evaluate(() => { document.documentElement.dataset.glass = 'fallback'; });
    check(await mobile.locator('.filter-dropdown').evaluate(el => getComputedStyle(el).backdropFilter.includes('blur')), 'Dropdown fallback lost its glass background');
    await mobile.locator('.filter-dropdown').getByRole('button').first().click();
    check(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile genre picker overflows horizontally');
    const cyan = await create(true,320,'cyan');
    await cyan.emulateMedia({reducedMotion:'reduce'});
    await openGenres(cyan); await button(cyan,'다음 페이지').click();
    await cards(cyan).nth(0).click();
    check(await selectedColor(cards(cyan).nth(0)) && await gray(cards(cyan).nth(1)), 'Selection did not follow the second theme');
    check(await cyan.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '320px picker overflows');
    await cyan.screenshot({path:'output/playwright/mobile-genres-cyan-320.png'});
    const desktop = await create(false,1920);
    await openGenres(desktop);
    check(await desktop.locator('.mobile-genre-deck').count() === 0, 'Mobile genre styling leaked onto PC');
    const desktopCard = desktop.locator('[data-genre-id]').first();
    await desktopCard.dispatchEvent('click');
    check(await desktopCard.locator('.sort-selection').count() === 1, 'PC genre selection check changed');
    check(await desktopCard.evaluate(el => el.getAnimations().some(animation => animation.id === 'filter-card-pick')), 'PC genre draw animation changed');
    await button(desktop,'프로젝트 종류').dispatchEvent('click');
    check(await desktop.locator('.filter-dropdown.is-liquid-glass').count() === 0, 'Mobile dropdown change leaked onto PC');
    check(errors.length === 0, errors.join('\n'));
    return {mobileMonochrome:true,themeSelection:true,drawEffect:true,multiSelect:true,reducedMotion:true,dropdownGlass:true,dropdownFallback:true,pcPreserved:true,errors};
  } finally { for (const context of contexts) await context.close(); }
}
