// Run with Playwright CLI: run-code --filename=tooling/scripts/verify-filter-card-pick.js
async (page) => {
  const assert = (value, message) => { if (!value) throw Error(message); };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.context().addCookies([{ name: 'mf-language', value: 'ko', url: page.url() }]);
  await page.route('**/v1/**', route => route.fulfill({ json: new URL(route.request().url()).pathname.endsWith('/minecraft/versions') ? { versions:['1.21.1','1.20.1'] } : { source: 'modrinth', status: 'empty', items: [], nextCursor: null, total: 0, fetchedAt: new Date().toISOString(), cached: false, appliedFilters: {}, unsupportedFilters: [], externalUrl: null, queryForwarded: true } }));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(new URL('/',page.url()).href);
  const button = name => page.getByRole('button', { name, exact: true });
  await button('검색 필터').click();
  assert(await button('전체 장르').count() === 0, 'Default genre card remains');
  await button('컨텐츠').click();
  const cards = page.locator('.deck-card[aria-pressed][aria-label]');
  const first = cards.nth(0);
  const second = cards.nth(1);
  const animation = card => card.evaluate(element => element.getAnimations().find(item => (item.id === 'filter-card-pick' || item.animationName === 'genre-card-pick'))?.playState);
  const finish = async () => {
    await page.locator('.deck-rail').evaluate(rail => {
      for (const card of rail.querySelectorAll('.deck-card')) {
        for (const item of card.getAnimations()) if ((item.id === 'filter-card-pick' || item.animationName === 'genre-card-pick')) item.finish();
      }
    });
  };
  // Dispatch rapid activations to exercise concurrent and repeated picks without
  // Playwright waiting for an already animated card to become stable.
  await first.dispatchEvent('click');
  assert(await first.getAttribute('aria-pressed') === 'true', 'Category selection was delayed');
  assert(await animation(first) === 'running', 'Category draw animation missing');
  await second.dispatchEvent('click');
  assert(await first.getAttribute('aria-pressed') === 'true' && await second.getAttribute('aria-pressed') === 'true', 'Multi-select lost a selection');
  await finish();
  await first.dispatchEvent('click');
  assert(await first.getAttribute('aria-pressed') === 'false', 'Rapid deselection failed');
  assert(await animation(first) === 'running', 'Category deselection animation missing after the selection effect finished');
  await first.dispatchEvent('click');
  assert(await first.evaluate(element => element.getAnimations().filter(item => (item.id === 'filter-card-pick' || item.animationName === 'genre-card-pick')).length) === 1, 'Repeated activation stacked animations');
  await page.locator('.deck-rail').evaluate(rail => {
    for (const card of rail.querySelectorAll('.deck-card')) {
      for (const item of card.getAnimations()) {
        if ((item.id === 'filter-card-pick' || item.animationName === 'genre-card-pick')) { item.pause(); item.currentTime = 190; }
      }
    }
  });
  assert(await first.evaluate(element => new DOMMatrix(getComputedStyle(element).transform).m42 < -25), 'Card did not rise out of the deck');
  await page.screenshot({ path: 'output/playwright/filter-card-pick-desktop.png' });
  await finish();
  assert(await page.getByRole('dialog', { name: '컨텐츠', exact: true }).count() === 1, 'Filter closed after multi-select');
  assert(await first.locator('.sort-selection').count() === 0 && await second.locator('.sort-selection').count() === 0, 'Genre selection still uses check marks');
  assert(await first.evaluate(element => getComputedStyle(element).opacity) === '1', 'Selected card disappeared');
  await first.dispatchEvent('click');
  await second.dispatchEvent('click');
  assert(await animation(first) === 'running' && await animation(second) === 'running', 'Clearing categories did not animate');
  assert(await first.getAttribute('aria-pressed') === 'false' && await second.getAttribute('aria-pressed') === 'false', 'Deselecting categories did not clear multi-select');
  await finish();
  await button('뒤로').click();
  await button('정렬 방법').click();
  await button('최근 업데이트순').dispatchEvent('click');
  assert(await button('최근 업데이트순').getAttribute('aria-pressed') === 'true', 'Sort selection failed');
  assert(await animation(button('최근 업데이트순')) === 'running', 'Sort draw animation missing');
  await finish();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await button('관련도순').dispatchEvent('click');
  assert(await button('관련도순').getAttribute('aria-pressed') === 'true' && !await animation(button('관련도순')), 'Reduced motion did not preserve selection without animation');
  await button('뒤로').click();
  await button('컨텐츠').click();
  await first.dispatchEvent('click');
  assert(await first.getAttribute('aria-pressed') === 'true' && !await animation(first), 'Reduced motion category selection failed');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 390, height: 844 });
  await first.evaluate(element => element.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'instant' }));
  await first.dispatchEvent('click');
  await first.dispatchEvent('click');
  assert(await animation(first) === 'running', 'Mobile draw animation missing');
  await first.evaluate(element => { const item = element.getAnimations().find(item => (item.id === 'filter-card-pick' || item.animationName === 'genre-card-pick')); item.pause(); item.currentTime = 190; });
  await page.screenshot({ path: 'output/playwright/filter-card-pick-mobile.png' });
  await finish();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile horizontal overflow');
  await button('닫기').click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  // Exercise each compatibility card after its preceding animation has fully
  // finished, on desktop and mobile. A stale pick effect must not mask a
  // missing deselection effect.
  for (const mobile of [false,true]) {
    await page.setViewportSize({width:mobile ? 390 : 1600,height:1000});
    await button('검색 필터').click();
    for (const [key,label,one,two,all] of [
      ['version','게임 버전','1.21.1','1.20.1','전체 버전'],
      ['loader','모드 로더','fabric','forge','전체 로더'],
      ['kind','프로젝트 종류','mod','modpack','전체 종류'],
    ]) {
      await button(label).click();
      const oneCard=page.locator(`[data-filter-id="${key}:${one}"]`);
      const twoCard=page.locator(`[data-filter-id="${key}:${two}"]`);
      assert(await button(all).count() === 0, `${key}: default card remains`);
      assert(await page.locator('.deck-card[aria-pressed="true"]').count() === 0, `${key}: selection has a default value`);
      // Let the versions response settle before recording the catalog order.
      if (key === 'version') await page.waitForFunction(() => document.querySelectorAll('.deck-card[data-filter-id]').length === 2);
      const order=await page.locator('.deck-card').evaluateAll(cards => cards.map(card => card.getAttribute('data-filter-id')));
      const sample=async card => {
        const state=await card.evaluate(el => {
          const effect=el.getAnimations().find(item => item.id === 'filter-card-pick');
          if (!effect) return null;
          effect.pause();
          const opacity=[40,190,380].map(time => { effect.currentTime=time; return getComputedStyle(el).opacity; });
          effect.currentTime=190;
          const style=getComputedStyle(el);
          return {opacity,y:new DOMMatrix(style.transform).m42,drop:parseFloat(style.getPropertyValue('--card-drop')) || 0};
        });
        assert(state && state.opacity.every(value => value === '1'), `${key}: card fades during a toggle`);
        assert(state.y < (mobile ? -9 : state.drop-25), `${key}: card toggle does not lift`);
        assert(await page.locator('.deck-card').evaluateAll(cards => cards.every(card => getComputedStyle(card).opacity === '1')), `${key}: sibling card fades`);
      };
      for (const selected of [true,false]) {
        await oneCard.dispatchEvent('click');
        assert(await oneCard.getAttribute('aria-pressed') === String(selected), `${key}: toggle state delayed`);
        assert(await animation(oneCard) === 'running', `${key}: ${selected ? 'selection' : 'deselection'} effect missing`);
        await sample(oneCard);
        if (!selected && key !== 'version') await page.screenshot({path:`output/playwright/${key}-deselect-${mobile ? 'mobile' : 'desktop'}.png`});
        await finish();
      }
      for (let i=0;i<4;i++) await oneCard.dispatchEvent('click');
      assert(await oneCard.getAttribute('aria-pressed') === 'false', `${key}: rapid toggles lost state`);
      assert(await oneCard.evaluate(el => el.getAnimations().filter(item => item.id === 'filter-card-pick').length) === 1, `${key}: rapid toggles stacked animations`);
      await sample(oneCard); await finish();
      await twoCard.dispatchEvent('click'); await finish();
      assert(JSON.stringify(await page.locator('.deck-card').evaluateAll(cards => cards.map(card => card.getAttribute('data-filter-id')))) === JSON.stringify(order), `${key}: selecting a card reordered the options`);
      await button('뒤로').click(); await button(label).click();
      assert(await twoCard.getAttribute('aria-pressed') === 'true' && !await animation(twoCard), `${key}: revisiting selections replays a default animation`);
      await page.emulateMedia({reducedMotion:'reduce'});
      await twoCard.dispatchEvent('click');
      assert(await twoCard.getAttribute('aria-pressed') === 'false' && !await animation(twoCard), `${key}: reduced motion deselection failed`);
      await twoCard.dispatchEvent('click');
      assert(await twoCard.getAttribute('aria-pressed') === 'true' && !await animation(twoCard), `${key}: reduced motion selection failed`);
      await page.emulateMedia({reducedMotion:'no-preference'});
      await twoCard.dispatchEvent('click');
      assert(await animation(twoCard) === 'running', `${key}: deselection effect did not resume`);
      await page.emulateMedia({reducedMotion:'reduce'});
      await page.waitForFunction(() => !document.querySelector('.game-deck').getAnimations({subtree:true}).some(item => item.id === 'filter-card-pick'));
      await page.emulateMedia({reducedMotion:'no-preference'});
      assert(await oneCard.getAttribute('aria-pressed') === 'false' && await twoCard.getAttribute('aria-pressed') === 'false', `${key}: final reset failed`);
      await button('뒤로').click();
      assert(await page.locator(`[data-filter-id="${key}"]`).getAttribute('aria-pressed') === 'false', `${key}: parent stayed selected after clearing its last option`);
    }
    assert(!['version','loader','kind'].some(key => new URL(page.url()).searchParams.has(key)), 'Cleared compatibility filters remain in the URL');
    await button('닫기').click();
  }
  await page.setViewportSize({width:1600,height:1000});
  await button('게임 바꾸기').click();
  await page.getByRole('textbox', { name: '게임 찾기', exact: true }).fill('스타듀 밸리');
  await button('스타듀 밸리').dispatchEvent('click');
  assert(await button('스타듀 밸리').evaluate(element => getComputedStyle(element).animationName) === 'card-pick', 'Original game draw animation changed');
  await page.getByRole('dialog', { name: '게임 선택', exact: true }).waitFor({ state: 'hidden' });
  await page.goto(new URL('/?game=all&genre=survival',page.url()).href);
  await button('검색 필터').click();
  const survival=page.locator('[data-genre-id="survival"]');
  assert(await survival.getAttribute('aria-pressed') === 'true' && !await animation(survival), 'Existing genre played an initial animation');
  await survival.dispatchEvent('click');
  assert(await animation(survival) === 'running', 'Global genre deselection effect missing');
  assert(await page.locator('.deck-card').evaluateAll(cards => cards.every(card => getComputedStyle(card).opacity === '1')), 'Global genre selection faded sibling cards');
  await page.getByRole('dialog',{name:'장르',exact:true}).waitFor({state:'hidden'});
  assert(!new URL(page.url()).searchParams.has('genre'), 'Global genre cannot be cleared without a default card');
  await button('검색 필터').click(); await button('생존').click();
  await page.getByRole('dialog',{name:'장르',exact:true}).waitFor({state:'hidden'});
  assert(new URL(page.url()).searchParams.get('genre') === 'survival', 'Global genre selection changed');
  assert(errors.length === 0, errors.join('\n'));
  return { checked: ['category draw and return', 'rapid multi-select and repeat', 'selection without checks', 'all reset', 'sort draw', 'reduced motion', 'mobile', 'original game selection', 'no default cards', 'compatibility selection and deselection', 'opacity throughout toggles', 'stable version order', 'global genre reset'], errors };
}
