// Playwright CLI: run-code --filename tooling/scripts/verify-artwork-drag.js
async (page) => {
  const base = new URL(page.url()).origin;
  const check = (value, message) => { if (!value) throw Error(message); };
  const games = ['minecraft-java', 'stardew-valley', 'skyrim-se', 'lethal-company', 'rimworld', 'valheim', 'terraria', 'project-zomboid', 'cyberpunk-2077', 'baldurs-gate-3', 'fallout-4', 'risk-of-rain-2', 'cities-skylines', 'dont-starve-together'];
  const errors = [];
  const reports = [];
  const context = await page.context().browser().newContext({ viewport: { width: 1536, height: 960 }, reducedMotion: 'reduce' });
  const initialize = () => {
    document.cookie = 'mf-language=ko; Path=/';
    localStorage.setItem('modfinder-intro-seen', '1');
  };
  await context.addInitScript(initialize);
  const tab = await context.newPage();
  tab.on('pageerror', error => errors.push(error.message));
  const art = id => tab.locator(`[data-artwork-position="${id}"] button, [data-artwork-id="${id}"]>button`);
  const placed = id => tab.locator(`[data-artwork-position="${id}"]`);
  const stored = id => tab.evaluate(key => localStorage.getItem(`modfinder-artwork:${key}`), id);
  const ready = async () => {
    await tab.locator('.game-characters-search').waitFor();
    await tab.locator('.game-character img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
    await tab.evaluate(() => document.fonts.ready);
  };
  const dragTo = async (id, left, top, release = true) => {
    const box = await art(id).boundingBox();
    const x = box.x + box.width / 2, y = box.y + Math.min(25, box.height / 2);
    await tab.mouse.move(x, y);
    await tab.mouse.down();
    await tab.mouse.move(x + left - box.x, y + top - box.y, { steps: 14 });
    if (release) await tab.mouse.up();
  };
  const inside = async id => {
    const box = await art(id).boundingBox();
    const size = tab.viewportSize();
    check(box.x >= 7 && box.y >= 7 && box.x + box.width <= size.width - 7 && box.y + box.height <= size.height - 7, `${id}: stays in viewport ${JSON.stringify(box)}`);
  };
  try {
    for (const game of games) {
      await tab.goto(`${base}/?game=${game}`);
      await ready();
      const representative = tab.locator('.game-characters-search .is-representative>.movable-artwork');
      check(await representative.count() === 1, `${game}: has one main image`);
      check(await representative.locator('img').evaluate(img => img.naturalWidth > 0), `${game}: bundled image decodes`);
      check(await tab.locator('.movable-artwork:focus-visible').count() === 0, `${game}: initial artwork does not steal keyboard focus`);
      check(await tab.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${game}: no horizontal overflow`);
      if (game === 'skyrim-se') await tab.screenshot({ path: 'output/playwright/skyrim-home-logo.png' });
      reports.push({ game, homeImage: true });
    }

    await tab.goto(`${base}/?game=minecraft-java`);
    await ready();
    const steve = 'minecraft-java:steve';
    await art(steve).click({ position: { x: 45, y: 20 } });
    check(await stored(steve) === null, 'Click without a drag keeps the original layout');
    await dragTo(steve, 160, 180);
    check(await stored(steve) !== null, 'Mouse drag persists');
    let box = await art(steve).boundingBox();
    check(Math.abs(box.x - 160) < 2 && Math.abs(box.y - 180) < 2, `Artwork follows the mouse without clipping: ${JSON.stringify(box)}`);
    const saved = await stored(steve);
    await tab.reload();
    await ready();
    await placed(steve).waitFor();
    box = await art(steve).boundingBox();
    check(Math.abs(box.x - 160) < 2 && Math.abs(box.y - 180) < 2, 'Reload restores the layout');
    await dragTo(steve, 420, 170, false);
    await tab.keyboard.press('Escape');
    await tab.mouse.up();
    check(await stored(steve) === saved, 'Escape cancels without persisting a partial drag');
    box = await art(steve).boundingBox();
    check(Math.abs(box.x - 160) < 2, 'Escape restores the previous position');
    check(await tab.locator(`[data-artwork-id="${steve}"]`).evaluate(anchor => {
      const rect = anchor.getBoundingClientRect();
      return !anchor.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + 20));
    }), 'The original location leaves no invisible drag target');
    await dragTo('minecraft-java:alex', 1040, 230);
    check(await placed(steve).count() === 1 && await placed('minecraft-java:alex').count() === 1, 'Companions move independently');
    await dragTo(steve, 650, 380);
    const hit = await art(steve).evaluate(el => {
      const box = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(box.x + box.width / 2, box.y + 20));
    });
    check(hit, 'Placed artwork remains draggable above the search and ranking panels');
    await tab.screenshot({ path: 'output/playwright/minecraft-artwork-dragged.png' });
    await dragTo(steve, -1000, -1000);
    await inside(steve);
    await tab.setViewportSize({ width: 390, height: 844 });
    await inside(steve);
    check(await tab.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Resize does not introduce horizontal overflow');
    await tab.screenshot({ path: 'output/playwright/artwork-mobile-restored.png' });
    await tab.setViewportSize({ width: 1536, height: 960 });
    const placeholder = await tab.locator('#mod-query').getAttribute('placeholder');
    const icon = await tab.locator('.game-orb img').getAttribute('src');
    await tab.getByRole('button', { name: '설정 메뉴', exact: true }).click();
    await tab.getByRole('dialog', { name: '설정 메뉴', exact: true }).waitFor();
    check(await art(steve).isDisabled(), 'Modal prevents background dragging');
    check(await tab.locator('#mod-query').getAttribute('placeholder') === placeholder && await tab.locator('.game-orb img').getAttribute('src') === icon, 'Settings preserve search placeholder and game icon');
    await tab.getByRole('button', { name: '닫기', exact: true }).click();
    await art(steve).focus();
    await tab.keyboard.press('ArrowRight');
    check(JSON.parse(await stored(steve)).x > 0, 'Keyboard moves artwork');
    await tab.keyboard.press('Home');
    check(await stored(steve) === null && await placed(steve).count() === 0, 'Home resets one image to its original anchor');
    check(await stored('minecraft-java:alex') !== null, 'Reset preserves other images');

    await tab.getByRole('button', { name: '게임 바꾸기', exact: true }).click();
    await tab.getByRole('textbox', { name: '게임 찾기', exact: true }).fill('스타듀');
    await tab.getByRole('button', { name: '스타듀 밸리', exact: true }).click();
    await tab.locator('[data-artwork-id="stardew-valley:junimo"]').waitFor();
    await ready();
    check(await stored('stardew-valley:junimo') === null, 'Game switch starts with an independent layout');
    await dragTo('stardew-valley:junimo', 200, 220);
    await tab.screenshot({ path: 'output/playwright/stardew-artwork-dragged.png' });
    await art('stardew-valley:junimo').dblclick();
    check(await stored('stardew-valley:junimo') === null, 'Double-click restores the original placement');
    await tab.goto(`${base}/?game=skyrim-se`);
    await ready();
    await dragTo('skyrim-se:logo', 120, 150);
    check(await stored('skyrim-se:logo') !== null, 'Other games use the same draggable behavior');
    box = await art('skyrim-se:logo').boundingBox();
    check(Math.abs(box.x - 120) < 2 && Math.abs(box.y - 150) < 2, 'Wordmarks do not jump when detached from their anchor');
    await tab.screenshot({ path: 'output/playwright/skyrim-logo-dragged.png' });

    const mobile = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    try {
      await mobile.addInitScript(initialize);
      const touchTab = await mobile.newPage();
      touchTab.on('pageerror', error => errors.push(error.message));
      await touchTab.goto(`${base}/?game=stardew-valley`);
      const image = touchTab.locator('[data-artwork-id="stardew-valley:junimo"] button');
      await image.locator('img').evaluate(img => img.decode());
      const rect = await image.boundingBox();
      const cdp = await mobile.newCDPSession(touchTab);
      const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x, y }] });
      const x = rect.x + rect.width / 2, y = rect.y + 15;
      await touch('touchStart', x, y);
      await touch('touchMove', x + 30, y - 50);
      await touch('touchMove', x + 60, y - 110);
      await touch('touchEnd');
      check(await touchTab.evaluate(() => localStorage.getItem('modfinder-artwork:stardew-valley:junimo')) !== null, 'Native touch drag persists');
      await touchTab.screenshot({ path: 'output/playwright/artwork-touch-dragged.png' });
    } finally { await mobile.close(); }
    check(errors.length === 0, `No browser errors: ${errors.join(', ')}`);
    return { passed: true, games: reports, mouse: true, touch: true, persistence: true, viewportBounds: true, cancellation: true, keyboard: true, reset: true, overlays: true, errors };
  } finally { await context.close(); }
}
