// Run through the Playwright CLI against a local or deployed site.
async (page) => {
  const check = (value, message) => { if (!value) throw Error(message); };
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => { document.cookie = 'mf-language=ko; Path=/'; });
  await page.reload();
  const box = selector => page.locator(selector).boundingBox();
  const openCollection = async name => {
    await page.locator('.settings-fab').click();
    await page.getByRole('dialog', { name: '설정 메뉴', exact: true }).getByRole('button', { name, exact: true }).click();
  };
  for (const [width, height] of [[320,568], [390,844], [768,1024], [1375,900]]) {
    await page.setViewportSize({ width, height });
    await page.reload();
    const logo = await box('.page-brand');
    const settings = await box('.settings-fab');
    const search = await box('.search-box');
    const ranking = await box('.ranking-panel');
    check(logo.y <= 24 && Math.abs(logo.x + logo.width / 2 - width / 2) < 2, 'Logo placement');
    check(settings.x <= 20 && settings.y <= 24, 'Settings placement');
    check(search.y < 160 && ranking.y > search.y + search.height, 'Search and ranking placement');
    check(await page.locator('.ranking-list li').count() === 11, 'Eleven search ranking entries');
    await page.screenshot({ path:`output/playwright/home-top-${width}.png` });
    for (const name of ['즐겨찾기', '최근 기록']) {
      await openCollection(name);
      const collectionLogo = await box('.page-brand .brand-logo');
      check(collectionLogo.width === (width <= 650 ? 76 : 96), 'Collection logo matches results');
      check(collectionLogo.y <= 24, 'Collection logo at top');
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
      if (name === '즐겨찾기') {
        check(await page.locator('.folder-rail').getByRole('button', { name:'미분류',exact:true }).count() === 0, 'No default unfiled folder');
        check(await page.locator('.collection-panel .empty-state').count() === 0, 'No empty icon panel');
        const title = await box('.page-heading h1');
        check(Math.abs(title.x + title.width / 2 - width / 2) < 2, 'Favorites heading centered');
      }
      await page.screenshot({path:`output/playwright/collection-top-${name === '즐겨찾기' ? 'favorites' : 'history'}-${width}.png`});
      await page.getByRole('button', {name:'메인 화면으로 이동',exact:true}).click();
    }
  }
  return { topPlacement:true, collectionLogos:true, searchRankingRows:11, viewports:4 };
}
